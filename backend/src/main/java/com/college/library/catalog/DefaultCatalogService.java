package com.college.library.catalog;

import com.college.library.audit.AuditAction;
import com.college.library.audit.AuditLogger;
import com.college.library.identity.UserAccount;
import com.college.library.identity.UserAccountRepository;
import com.college.library.identity.UserRole;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DefaultCatalogService implements CatalogService {

    private final BookRepository bookRepository;
    private final BookCopyRepository bookCopyRepository;
    private final UserAccountRepository userAccountRepository;
    private final AuditLogger auditLogger;

    public DefaultCatalogService(
        BookRepository bookRepository,
        BookCopyRepository bookCopyRepository,
        UserAccountRepository userAccountRepository,
        AuditLogger auditLogger
    ) {
        this.bookRepository = bookRepository;
        this.bookCopyRepository = bookCopyRepository;
        this.userAccountRepository = userAccountRepository;
        this.auditLogger = auditLogger;
    }

    @Override
    @Transactional(readOnly = true)
    public List<BookSummary> searchBooks(String query) {
        List<Book> books = query.isBlank()
            ? bookRepository.findAll()
            : bookRepository.findByTitleContainingIgnoreCaseOrAuthorContainingIgnoreCaseOrCategoryContainingIgnoreCase(
                query,
                query,
                query
            );

        return books.stream().map(BookSummary::from).toList();
    }

    @Override
    @Transactional
    public Optional<BookCopyScanResponse> scanCopy(ScanType type, String value) {
        Optional<BookCopyScanResponse> response = switch (type) {
            case QR -> bookCopyRepository.findByQrCodeValue(value)
                .filter(copy -> copy.getStatus() != BookCopyStatus.REMOVED)
                .map(BookCopyScanResponse::from);
            case RFID -> bookCopyRepository.findByRfidTagUidHash(value)
                .filter(copy -> copy.getStatus() != BookCopyStatus.REMOVED)
                .map(BookCopyScanResponse::from);
        };

        response.ifPresent(scan -> auditLogger.record(AuditAction.BOOK_SCAN, null, "BookCopy", scan.copyId(), type.name()));
        return response;
    }

    @Override
    @Transactional
    public BookSummary addBook(BookCreateRequest request, UUID actorUserId) {
        UserAccount actor = findCatalogManager(actorUserId);
        Book book = new Book(
            request.title(),
            request.author(),
            request.isbn(),
            request.publisher(),
            request.category(),
            request.finePerDay(),
            request.loanPeriodDays()
        );
        String normalizedTitle = request.title().replaceAll("[^A-Za-z0-9]", "").toUpperCase();

        for (int index = 1; index <= request.copyCount(); index++) {
            String accessionNumber = "ACC-" + normalizedTitle + "-" + System.currentTimeMillis() + "-" + index;
            book.addCopy(new BookCopy(accessionNumber, "BOOK-QR-" + accessionNumber, request.shelfLocation()));
        }

        Book savedBook = bookRepository.save(book);
        auditLogger.record(AuditAction.BOOK_ADD, actor.getId(), "Book", savedBook.getId(), savedBook.getTitle());
        return BookSummary.from(savedBook);
    }

    @Override
    @Transactional
    public void removeBook(UUID bookId, UUID actorUserId) {
        UserAccount actor = findCatalogManager(actorUserId);
        Book book = bookRepository.findById(bookId)
            .orElseThrow(() -> new IllegalArgumentException("Book not found"));

        bookRepository.delete(book);
        auditLogger.record(AuditAction.BOOK_REMOVE, actor.getId(), "Book", bookId, book.getTitle());
    }

    @Override
    @Transactional(readOnly = true)
    public List<BookCopySummary> listBookCopies(UUID bookId, UUID actorUserId) {
        findCatalogManager(actorUserId);
        Book book = bookRepository.findById(bookId)
            .orElseThrow(() -> new IllegalArgumentException("Book not found"));

        return book.getCopies().stream()
            .filter(copy -> copy.getStatus() != BookCopyStatus.REMOVED)
            .map(BookCopySummary::from)
            .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public BookCopySummary getBookCopyByQrCode(String qrCodeValue, UUID actorUserId) {
        findCatalogManager(actorUserId);
        BookCopy copy = bookCopyRepository.findByQrCodeValue(qrCodeValue)
            .filter(bookCopy -> bookCopy.getStatus() != BookCopyStatus.REMOVED)
            .orElseThrow(() -> new IllegalArgumentException("Book copy not found"));

        return BookCopySummary.from(copy);
    }

    @Override
    @Transactional
    public void removeBookCopyByQrCode(String qrCodeValue, UUID actorUserId) {
        UserAccount actor = findCatalogManager(actorUserId);
        BookCopy copy = bookCopyRepository.findByQrCodeValueForUpdate(qrCodeValue)
            .orElseThrow(() -> new IllegalArgumentException("Book copy not found"));

        if (copy.getStatus() == BookCopyStatus.ISSUED) {
            throw new IllegalStateException("Issued book copies must be returned before removal");
        }

        UUID copyId = copy.getId();
        String accessionNumber = copy.getAccessionNumber();
        copy.markRemoved();
        auditLogger.record(AuditAction.BOOK_REMOVE, actor.getId(), "BookCopy", copyId, accessionNumber);
    }

    private UserAccount findCatalogManager(UUID actorUserId) {
        if (actorUserId == null) {
            throw new IllegalStateException("Actor user is required");
        }

        UserAccount actor = userAccountRepository.findById(actorUserId)
            .filter(UserAccount::isActive)
            .orElseThrow(() -> new IllegalArgumentException("Actor user not found"));

        if (!hasAnyRole(actor, UserRole.LIBRARIAN, UserRole.ADMIN, UserRole.SUPER_ADMIN)) {
            throw new IllegalStateException("Only librarian or admin can manage books");
        }

        return actor;
    }

    private boolean hasAnyRole(UserAccount user, UserRole... allowedRoles) {
        return Set.of(allowedRoles).stream().anyMatch(user.getRoles()::contains);
    }
}
