package com.college.library.circulation;

import com.college.library.audit.AuditAction;
import com.college.library.audit.AuditLogger;
import com.college.library.catalog.BookCopy;
import com.college.library.catalog.BookCopyRepository;
import com.college.library.catalog.BookCopyStatus;
import com.college.library.catalog.ScanType;
import com.college.library.identity.IdentifierType;
import com.college.library.identity.UserAccount;
import com.college.library.identity.UserAccountRepository;
import com.college.library.identity.UserIdentifierRepository;
import com.college.library.identity.UserRole;
import jakarta.transaction.Transactional;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class CirculationService implements CirculationUseCase {

    private static final int RENEWAL_DAYS = 7;

    private final BookCopyRepository bookCopyRepository;
    private final UserAccountRepository userAccountRepository;
    private final UserIdentifierRepository userIdentifierRepository;
    private final CirculationTransactionRepository circulationTransactionRepository;
    private final AuditLogger auditLogger;

    public CirculationService(
        BookCopyRepository bookCopyRepository,
        UserAccountRepository userAccountRepository,
        UserIdentifierRepository userIdentifierRepository,
        CirculationTransactionRepository circulationTransactionRepository,
        AuditLogger auditLogger
    ) {
        this.bookCopyRepository = bookCopyRepository;
        this.userAccountRepository = userAccountRepository;
        this.userIdentifierRepository = userIdentifierRepository;
        this.circulationTransactionRepository = circulationTransactionRepository;
        this.auditLogger = auditLogger;
    }

    @Override
    @Transactional
    public CirculationResponse issue(IssueRequest request, UUID actorUserId) {
        UserAccount actor = findActor(actorUserId);
        BookCopy copy = bookCopyRepository.findByIdForUpdate(request.bookCopyId())
            .orElseThrow(() -> new IllegalArgumentException("Book copy not found"));
        UserAccount borrower = userAccountRepository.findById(request.borrowerId())
            .orElseThrow(() -> new IllegalArgumentException("Borrower not found"));

        if (!actor.getId().equals(borrower.getId()) || !hasAnyRole(borrower, UserRole.STUDENT, UserRole.FACULTY)) {
            throw new IllegalStateException("Students and faculty can issue books only to themselves");
        }

        return issueCopyToBorrower(copy, borrower);
    }

    @Override
    @Transactional
    public CirculationResponse issueByIdentifier(IssueByIdentifierRequest request, UUID actorUserId) {
        UserAccount actor = findActor(actorUserId);
        String borrowerIdentifier = cleanValue(request.borrowerIdentifier());
        String bookScanValue = cleanValue(request.bookScanValue());
        UserAccount borrower = userIdentifierRepository
            .findByTypeAndValue(request.borrowerIdentifierType(), borrowerIdentifier)
            .filter(identifier -> identifier.getUser().isActive())
            .orElseThrow(() -> new IllegalArgumentException("Student not found for the entered identifier"))
            .getUser();
        BookCopy copy = resolveBookCopy(request.bookScanType(), bookScanValue);

        boolean borrowerSelfIssue = actor.getId().equals(borrower.getId())
            && hasAnyRole(borrower, UserRole.STUDENT, UserRole.FACULTY);
        boolean staffIssue = borrower.getRoles().contains(UserRole.STUDENT)
            && hasAnyRole(actor, UserRole.LIBRARIAN, UserRole.ADMIN, UserRole.SUPER_ADMIN);

        if (!borrowerSelfIssue && !staffIssue) {
            throw new IllegalStateException("Only students or faculty can issue to themselves, or librarian/admin can issue to a student");
        }

        return issueCopyToBorrower(copy, borrower);
    }

    private String cleanValue(String value) {
        return value == null ? "" : value.trim();
    }

    private CirculationResponse issueCopyToBorrower(BookCopy copy, UserAccount borrower) {
        if (!hasAnyRole(borrower, UserRole.STUDENT, UserRole.FACULTY)) {
            throw new IllegalStateException("Only students or faculty can borrow books");
        }

        if (copy.getStatus() != BookCopyStatus.AVAILABLE) {
            throw new IllegalStateException("Book copy is not available for issue");
        }

        LocalDate issuedOn = LocalDate.now();
        CirculationTransaction transaction = new CirculationTransaction(
            copy,
            borrower,
            issuedOn,
            issuedOn.plusDays(copy.getBook().getLoanPeriodDays())
        );
        copy.markIssued();

        CirculationTransaction savedTransaction = circulationTransactionRepository.save(transaction);
        auditLogger.record(AuditAction.BOOK_ISSUE, borrower.getId(), "BookCopy", copy.getId(), copy.getAccessionNumber());
        return CirculationResponse.from(savedTransaction);
    }

    private BookCopy resolveBookCopy(ScanType scanType, String scanValue) {
        java.util.Optional<BookCopy> copy = switch (scanType) {
            case QR -> bookCopyRepository.findByQrCodeValueForUpdate(scanValue);
            case RFID -> bookCopyRepository.findByRfidTagUidHashForUpdate(scanValue);
        };

        return copy.orElseThrow(() -> new IllegalArgumentException("Book copy not found"));
    }

    @Override
    @Transactional
    public CirculationResponse returnCopy(UUID bookCopyId, UUID actorUserId) {
        UserAccount actor = findActor(actorUserId);

        if (!hasAnyRole(actor, UserRole.LIBRARIAN, UserRole.ADMIN, UserRole.SUPER_ADMIN)) {
            throw new IllegalStateException("Only librarian or admin can return issued books");
        }

        BookCopy copy = bookCopyRepository.findByIdForUpdate(bookCopyId)
            .orElseThrow(() -> new IllegalArgumentException("Book copy not found"));
        CirculationTransaction transaction = circulationTransactionRepository
            .findByBookCopyAndStatus(copy, CirculationStatus.ISSUED)
            .orElseThrow(() -> new IllegalStateException("Book copy is not currently issued"));

        transaction.markReturned(LocalDate.now());
        auditLogger.record(
            AuditAction.BOOK_RETURN,
            transaction.getBorrower().getId(),
            "BookCopy",
            copy.getId(),
            copy.getAccessionNumber()
        );
        return CirculationResponse.from(transaction);
    }

    @Override
    @Transactional
    public CirculationResponse renew(UUID transactionId, UUID actorUserId) {
        UserAccount actor = findActor(actorUserId);

        if (!hasAnyRole(actor, UserRole.LIBRARIAN, UserRole.ADMIN, UserRole.SUPER_ADMIN)) {
            throw new IllegalStateException("Only librarian or admin can renew issued books");
        }

        CirculationTransaction transaction = circulationTransactionRepository.findById(transactionId)
            .orElseThrow(() -> new IllegalArgumentException("Transaction not found"));

        if (transaction.getStatus() != CirculationStatus.ISSUED) {
            throw new IllegalStateException("Only issued books can be renewed");
        }

        transaction.renew(RENEWAL_DAYS);
        auditLogger.record(
            AuditAction.BOOK_RENEW,
            transaction.getBorrower().getId(),
            "CirculationTransaction",
            transaction.getId(),
            "Renewed for " + RENEWAL_DAYS + " days"
        );
        return CirculationResponse.from(transaction);
    }

    @Override
    @Transactional
    public List<CirculationResponse> listIssuedBooksForUser(UUID borrowerId, UUID actorUserId) {
        UserAccount actor = findActor(actorUserId);
        UserAccount borrower = userAccountRepository.findById(borrowerId)
            .filter(UserAccount::isActive)
            .orElseThrow(() -> new IllegalArgumentException("Borrower not found"));

        boolean viewingSelf = actor.getId().equals(borrower.getId());
        boolean staffViewingStudent = borrower.getRoles().contains(UserRole.STUDENT)
            && hasAnyRole(actor, UserRole.FACULTY, UserRole.LIBRARIAN, UserRole.ADMIN, UserRole.SUPER_ADMIN);
        boolean staffViewingFaculty = borrower.getRoles().contains(UserRole.FACULTY)
            && hasAnyRole(actor, UserRole.LIBRARIAN, UserRole.ADMIN, UserRole.SUPER_ADMIN);

        if (!viewingSelf && !staffViewingStudent && !staffViewingFaculty) {
            throw new IllegalStateException("You are not allowed to view issued books for this user");
        }

        return circulationTransactionRepository.findByBorrowerAndStatus(borrower, CirculationStatus.ISSUED)
            .stream()
            .map(CirculationResponse::from)
            .toList();
    }

    private UserAccount findActor(UUID actorUserId) {
        if (actorUserId == null) {
            throw new IllegalStateException("Actor user is required");
        }

        return userAccountRepository.findById(actorUserId)
            .filter(UserAccount::isActive)
            .orElseThrow(() -> new IllegalArgumentException("Actor user not found"));
    }

    private boolean hasAnyRole(UserAccount user, UserRole... allowedRoles) {
        return java.util.Set.of(allowedRoles).stream().anyMatch(user.getRoles()::contains);
    }
}
