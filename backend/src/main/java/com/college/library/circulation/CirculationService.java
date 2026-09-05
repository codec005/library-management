package com.college.library.circulation;

import com.college.library.audit.AuditAction;
import com.college.library.audit.AuditLogger;
import com.college.library.catalog.Book;
import com.college.library.catalog.BookCopy;
import com.college.library.catalog.BookCopyRepository;
import com.college.library.catalog.BookCopyStatus;
import com.college.library.catalog.BookRepository;
import com.college.library.identity.UserAccount;
import com.college.library.identity.UserAccountRepository;
import jakarta.transaction.Transactional;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class CirculationService implements CirculationUseCase {

    private static final int DEFAULT_LOAN_DAYS = 14;
    private static final int RENEWAL_DAYS = 7;
    private static final int RESERVATION_EXPIRY_DAYS = 3;

    private final BookRepository bookRepository;
    private final BookCopyRepository bookCopyRepository;
    private final UserAccountRepository userAccountRepository;
    private final CirculationTransactionRepository circulationTransactionRepository;
    private final BookReservationRepository bookReservationRepository;
    private final AuditLogger auditLogger;

    public CirculationService(
        BookRepository bookRepository,
        BookCopyRepository bookCopyRepository,
        UserAccountRepository userAccountRepository,
        CirculationTransactionRepository circulationTransactionRepository,
        BookReservationRepository bookReservationRepository,
        AuditLogger auditLogger
    ) {
        this.bookRepository = bookRepository;
        this.bookCopyRepository = bookCopyRepository;
        this.userAccountRepository = userAccountRepository;
        this.circulationTransactionRepository = circulationTransactionRepository;
        this.bookReservationRepository = bookReservationRepository;
        this.auditLogger = auditLogger;
    }

    @Override
    @Transactional
    public CirculationResponse issue(IssueRequest request) {
        BookCopy copy = bookCopyRepository.findById(request.bookCopyId())
            .orElseThrow(() -> new IllegalArgumentException("Book copy not found"));
        UserAccount borrower = userAccountRepository.findById(request.borrowerId())
            .orElseThrow(() -> new IllegalArgumentException("Borrower not found"));

        if (copy.getStatus() != BookCopyStatus.AVAILABLE) {
            throw new IllegalStateException("Book copy is not available for issue");
        }

        LocalDate issuedOn = LocalDate.now();
        CirculationTransaction transaction = new CirculationTransaction(
            copy,
            borrower,
            issuedOn,
            issuedOn.plusDays(DEFAULT_LOAN_DAYS)
        );
        copy.markIssued();

        CirculationTransaction savedTransaction = circulationTransactionRepository.save(transaction);
        auditLogger.record(AuditAction.BOOK_ISSUE, borrower.getId(), "BookCopy", copy.getId(), copy.getAccessionNumber());
        return CirculationResponse.from(savedTransaction);
    }

    @Override
    @Transactional
    public CirculationResponse returnCopy(UUID bookCopyId) {
        BookCopy copy = bookCopyRepository.findById(bookCopyId)
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
    public CirculationResponse renew(UUID transactionId) {
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
    public ReservationResponse reserve(ReserveRequest request) {
        Book book = bookRepository.findById(request.bookId())
            .orElseThrow(() -> new IllegalArgumentException("Book not found"));
        UserAccount borrower = userAccountRepository.findById(request.borrowerId())
            .orElseThrow(() -> new IllegalArgumentException("Borrower not found"));

        LocalDate requestedOn = LocalDate.now();
        BookReservation reservation = new BookReservation(
            book,
            borrower,
            requestedOn,
            requestedOn.plusDays(RESERVATION_EXPIRY_DAYS)
        );

        BookReservation savedReservation = bookReservationRepository.save(reservation);
        auditLogger.record(AuditAction.BOOK_RESERVE, borrower.getId(), "Book", book.getId(), book.getTitle());
        return ReservationResponse.from(savedReservation);
    }
}
