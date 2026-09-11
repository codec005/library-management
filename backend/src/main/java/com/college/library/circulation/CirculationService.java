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
import com.college.library.identity.UserIdentifier;
import com.college.library.identity.UserIdentifierRepository;
import com.college.library.identity.UserRole;
import jakarta.transaction.Transactional;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class CirculationService implements CirculationUseCase {

    private static final int DEFAULT_RENEWAL_DAYS = 7;

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
    public CirculationResponse issue(IssueRequest request, UUID actorUserId) { //actoruserid determines which user is logged in and request has the details to which user has to get which book
        UserAccount actor = findActor(actorUserId); // get user and verify whether it is a valid user(if it is a student/faculty then only they can allot books to themselves)
        BookCopy copy = bookCopyRepository.findByIdForUpdate(request.bookCopyId())
            .orElseThrow(() -> new IllegalArgumentException("Book copy not found"));
        UserAccount borrower = userAccountRepository.findById(request.borrowerId())
            .orElseThrow(() -> new IllegalArgumentException("Borrower not found"));

        if (!actor.getId().equals(borrower.getId()) || !hasAnyRole(borrower, UserRole.STUDENT, UserRole.FACULTY)) {
            throw new IllegalStateException("Students and faculty can issue books only to themselves"); // if studenty or faculty are trying to issue book to nsomeone else other than themselves then throw this error
        }

        return issueCopyToBorrower(copy, borrower, actor, request.loanDays());
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
            .orElseThrow(() -> new IllegalArgumentException("Borrower not found for the entered identifier"))
            .getUser();
        BookCopy copy = resolveBookCopy(request.bookScanType(), bookScanValue);

        boolean borrowerSelfIssue = actor.getId().equals(borrower.getId())
            && hasAnyRole(borrower, UserRole.STUDENT, UserRole.FACULTY);
        boolean staffIssue = hasAnyRole(borrower, UserRole.STUDENT, UserRole.FACULTY)
            && hasAnyRole(actor, UserRole.LIBRARIAN, UserRole.ADMIN, UserRole.SUPER_ADMIN);

        if (!borrowerSelfIssue && !staffIssue) {
            throw new IllegalStateException(
                "Only students or faculty can issue to themselves, or librarian/admin can issue to a student or faculty member"
            );
        }

        return issueCopyToBorrower(copy, borrower, actor, request.loanDays());
    }

    private String cleanValue(String value) {
        return value == null ? "" : value.trim();
    }

    private CirculationResponse issueCopyToBorrower(
        BookCopy copy,
        UserAccount borrower,
        UserAccount actor,
        Integer requestedLoanDays
    ) {
        if (!hasAnyRole(borrower, UserRole.STUDENT, UserRole.FACULTY)) {
            throw new IllegalStateException("Only students or faculty can borrow books");
        }

        if (copy.getStatus() != BookCopyStatus.AVAILABLE) {
            throw new IllegalStateException("Book copy is not available for issue");
        }

        int maxLoanDays = copy.getBook().getLoanPeriodDays();
        int loanDays = requestedLoanDays == null ? maxLoanDays : requestedLoanDays;
        if (loanDays < 1 || loanDays > maxLoanDays) {
            throw new IllegalArgumentException(
                "Borrow days must be between 1 and the book loan period (" + maxLoanDays + " days)"
            );
        }

        LocalDate issuedOn = LocalDate.now();
        CirculationTransaction transaction = new CirculationTransaction(
            copy,
            borrower,
            issuedOn,
            issuedOn.plusDays(loanDays)
        );
        copy.markIssued();

        CirculationTransaction savedTransaction = circulationTransactionRepository.save(transaction);
        String auditDetails = copy.getAccessionNumber()
            + " to "
            + borrowerLabel(borrower)
            + " for "
            + loanDays
            + " days";
        auditLogger.record(AuditAction.BOOK_ISSUE, actor.getId(), "BookCopy", copy.getId(), auditDetails);
        return CirculationResponse.from(savedTransaction);
    }

    private BookCopy resolveBookCopy(ScanType scanType, String scanValue) {
        java.util.Optional<BookCopy> copy = switch (scanType) {
            case QR -> bookCopyRepository.findByQrCodeValueForUpdate(scanValue);
            case RFID -> bookCopyRepository.findByRfidTagUidHashForUpdate(scanValue);
            case SSN -> bookCopyRepository.findBySsnNumberForUpdate(scanValue);
        };

        return copy.orElseThrow(() -> new IllegalArgumentException("Book copy not found"));
    }

    @Override
    @Transactional
    public CirculationResponse returnCopy(UUID bookCopyId, boolean resetFine, UUID actorUserId) {
        UserAccount actor = findActor(actorUserId);

        if (!hasAnyRole(actor, UserRole.LIBRARIAN, UserRole.ADMIN, UserRole.SUPER_ADMIN)) {
            throw new IllegalStateException("Only librarian or admin can return issued books");
        }

        BookCopy copy = bookCopyRepository.findByIdForUpdate(bookCopyId)
            .orElseThrow(() -> new IllegalArgumentException("Book copy not found"));
        CirculationTransaction transaction = circulationTransactionRepository
            .findByBookCopyAndStatus(copy, CirculationStatus.ISSUED)
            .orElseThrow(() -> new IllegalStateException("Book copy is not currently issued"));

        return completeReturn(transaction, copy, resetFine, actor);
    }

    @Override
    @Transactional
    public CirculationResponse returnByIdentifier(ReturnByIdentifierRequest request, UUID actorUserId) {
        UserAccount actor = findActor(actorUserId);

        if (!hasAnyRole(actor, UserRole.LIBRARIAN, UserRole.ADMIN, UserRole.SUPER_ADMIN)) {
            throw new IllegalStateException("Only librarian or admin can return issued books");
        }

        if (request.borrowerIdentifierType() != IdentifierType.ROLL_NUMBER
            && request.borrowerIdentifierType() != IdentifierType.QR_CREDENTIAL) {
            throw new IllegalArgumentException("Return requires student/faculty roll number/staff code or QR");
        }

        String borrowerIdentifier = cleanValue(request.borrowerIdentifier());
        String bookScanValue = cleanValue(request.bookScanValue());
        UserAccount borrower = userIdentifierRepository
            .findByTypeAndValue(request.borrowerIdentifierType(), borrowerIdentifier)
            .filter(identifier -> identifier.getUser().isActive())
            .orElseThrow(() -> new IllegalArgumentException("Borrower not found for the entered identifier"))
            .getUser();

        if (!hasAnyRole(borrower, UserRole.STUDENT, UserRole.FACULTY)) {
            throw new IllegalStateException("Only student or faculty loans can be returned with this flow");
        }

        CirculationTransaction transaction = resolveIssuedTransaction(borrower, request.bookScanType(), bookScanValue);
        BookCopy copy = bookCopyRepository.findByIdForUpdate(transaction.getBookCopy().getId())
            .orElseThrow(() -> new IllegalArgumentException("Book copy not found"));
        CirculationTransaction lockedTransaction = circulationTransactionRepository
            .findByBookCopyAndStatus(copy, CirculationStatus.ISSUED)
            .orElseThrow(() -> new IllegalStateException("Book copy is not currently issued"));

        if (!lockedTransaction.getBorrower().getId().equals(borrower.getId())) {
            throw new IllegalStateException("This book is not issued to the scanned borrower");
        }

        boolean resetFine = Boolean.TRUE.equals(request.resetFine());
        return completeReturn(lockedTransaction, copy, resetFine, actor);
    }

    private CirculationTransaction resolveIssuedTransaction(
        UserAccount borrower,
        ScanType bookScanType,
        String bookScanValue
    ) {
        List<CirculationTransaction> matches = circulationTransactionRepository.findIssuedMatchesForBorrower(
            borrower,
            CirculationStatus.ISSUED,
            bookScanValue
        );

        if (matches.isEmpty() && bookScanType == ScanType.RFID) {
            BookCopy copy = bookCopyRepository.findByRfidTagUidHashForUpdate(bookScanValue)
                .orElseThrow(() -> new IllegalArgumentException("Book copy not found"));
            CirculationTransaction transaction = circulationTransactionRepository
                .findByBookCopyAndStatus(copy, CirculationStatus.ISSUED)
                .orElseThrow(() -> new IllegalStateException("Book copy is not currently issued"));
            if (!transaction.getBorrower().getId().equals(borrower.getId())) {
                throw new IllegalStateException("This book is not issued to the scanned borrower");
            }
            return transaction;
        }

        if (matches.isEmpty()) {
            throw new IllegalArgumentException("No issued book matched this borrower and book identifier");
        }
        if (matches.size() > 1) {
            throw new IllegalStateException("Multiple issued copies matched. Use the book copy QR or accession number.");
        }
        return matches.getFirst();
    }

    private CirculationResponse completeReturn(
        CirculationTransaction transaction,
        BookCopy copy,
        boolean resetFine,
        UserAccount actor
    ) {
        transaction.markReturned(LocalDate.now(), resetFine);
        UserAccount borrower = transaction.getBorrower();
        String auditDetails = borrowerLabel(borrower) + " · " + copy.getAccessionNumber()
            + (resetFine ? " (fine reset)" : "");
        auditLogger.record(
            AuditAction.BOOK_RETURN,
            actor.getId(),
            "BookCopy",
            copy.getId(),
            auditDetails
        );
        return CirculationResponse.from(transaction);
    }

    @Override
    @Transactional
    public CirculationResponse renew(UUID transactionId, Integer renewalDays, UUID actorUserId) {
        UserAccount actor = findActor(actorUserId);

        if (!hasAnyRole(actor, UserRole.LIBRARIAN, UserRole.ADMIN, UserRole.SUPER_ADMIN)) {
            throw new IllegalStateException("Only librarian or admin can renew issued books");
        }

        CirculationTransaction transaction = circulationTransactionRepository.findById(transactionId)
            .orElseThrow(() -> new IllegalArgumentException("Transaction not found"));

        if (transaction.getStatus() != CirculationStatus.ISSUED) {
            throw new IllegalStateException("Only issued books can be renewed");
        }

        int maxRenewalDays = transaction.getBookCopy().getBook().getLoanPeriodDays();
        int days = renewalDays == null ? Math.min(DEFAULT_RENEWAL_DAYS, maxRenewalDays) : renewalDays;
        if (days < 1 || days > maxRenewalDays) {
            throw new IllegalArgumentException(
                "Renewal days must be between 1 and the book loan period (" + maxRenewalDays + " days)"
            );
        }

        transaction.renew(days);
        UserAccount borrower = transaction.getBorrower();
        String accessionNumber = transaction.getBookCopy().getAccessionNumber();
        String auditDetails = borrowerLabel(borrower) + " · " + accessionNumber + " · " + days + " days";
        auditLogger.record(
            AuditAction.BOOK_RENEW,
            actor.getId(),
            "CirculationTransaction",
            transaction.getId(),
            auditDetails
        );
        return CirculationResponse.from(transaction);
    }

    private String borrowerLabel(UserAccount borrower) {
        String borrowerCode = userIdentifierRepository
            .findByUserAndType(borrower, IdentifierType.ROLL_NUMBER)
            .map(UserIdentifier::getValue)
            .orElse(null);
        if (borrowerCode == null || borrowerCode.isBlank()) {
            return borrower.getFullName();
        }
        return borrower.getFullName() + " (" + borrowerCode + ")";
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
            .map(this::toCirculationResponse)
            .toList();
    }

    @Override
    @Transactional
    public BookCopyHistoryResponse getBookCopyHistory(UUID bookCopyId, UUID actorUserId) {
        UserAccount actor = findActor(actorUserId);

        if (!hasAnyRole(actor, UserRole.LIBRARIAN, UserRole.ADMIN, UserRole.SUPER_ADMIN)) {
            throw new IllegalStateException("Only librarian or admin can view book copy history");
        }

        BookCopy copy = bookCopyRepository.findById(bookCopyId)
            .orElseThrow(() -> new IllegalArgumentException("Book copy not found"));

        List<CirculationResponse> loans = circulationTransactionRepository
            .findByBookCopyOrderByIssuedOnDesc(copy)
            .stream()
            .map(this::toCirculationResponse)
            .toList();

        return new BookCopyHistoryResponse(
            copy.getId(),
            copy.getSsnNumber(),
            copy.getAccessionNumber(),
            copy.getBook().getTitle(),
            copy.getBook().getAuthor(),
            copy.getShelfLocation(),
            copy.getStatus(),
            loans
        );
    }

    private CirculationResponse toCirculationResponse(CirculationTransaction transaction) {
        String borrowerCode = userIdentifierRepository
            .findByUserAndType(transaction.getBorrower(), IdentifierType.ROLL_NUMBER)
            .map(UserIdentifier::getValue)
            .orElse(null);
        return CirculationResponse.from(transaction, borrowerCode);
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
