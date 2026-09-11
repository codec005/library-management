package com.college.library.catalog;

import com.college.library.audit.AuditAction;
import com.college.library.audit.AuditLogger;
import com.college.library.circulation.CirculationTransactionRepository;
import com.college.library.common.PageResponse;
import com.college.library.identity.UserAccount;
import com.college.library.identity.UserAccountRepository;
import com.college.library.identity.UserRole;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DefaultCatalogService implements CatalogService {

    private final BookRepository bookRepository;
    private final BookCopyRepository bookCopyRepository;
    private final UserAccountRepository userAccountRepository;
    private final CirculationTransactionRepository circulationTransactionRepository;
    private final AuditLogger auditLogger;

    public DefaultCatalogService(
        BookRepository bookRepository,
        BookCopyRepository bookCopyRepository,
        UserAccountRepository userAccountRepository,
        CirculationTransactionRepository circulationTransactionRepository,
        AuditLogger auditLogger
    ) {
        this.bookRepository = bookRepository;
        this.bookCopyRepository = bookCopyRepository;
        this.userAccountRepository = userAccountRepository;
        this.circulationTransactionRepository = circulationTransactionRepository;
        this.auditLogger = auditLogger;
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<BookSummary> searchBooks(
        String query,
        String category,
        String author,
        String publisher,
        boolean availableOnly,
        boolean groupByTitle,
        int page,
        int size
    ) {
        String cleanedQuery = cleanValue(query);
        String cleanedCategory = cleanValue(category);
        String cleanedAuthor = cleanValue(author);
        String cleanedPublisher = cleanValue(publisher);
        var pageable = PageResponse.pageable(page, size, Sort.by("title").ascending());

        if (!cleanedQuery.isEmpty()) {
            var exact = bookRepository.findBySsnNumberIgnoreCase(cleanedQuery);
            if (exact.isPresent()) {
                Book book = exact.get();
                boolean matchesFilters = matchesCatalogFilters(book, cleanedCategory, cleanedAuthor, cleanedPublisher);
                boolean include = matchesFilters && (!availableOnly || book.getCopies().stream()
                    .anyMatch(copy -> copy.getStatus() == BookCopyStatus.AVAILABLE));
                if (include) {
                    return PageResponse.from(new PageImpl<>(List.of(BookSummary.from(book)), pageable, 1));
                }
                return PageResponse.from(org.springframework.data.domain.Page.empty(pageable));
            }
        }

        if (groupByTitle) {
            // Kept for API compatibility; Full Catalogue uses searchGroupedBooks.
            return searchBooksGroupedByTitle(
                cleanedQuery,
                cleanedCategory,
                cleanedAuthor,
                cleanedPublisher,
                availableOnly,
                page,
                size
            );
        }

        return PageResponse.from(
            bookRepository
                .search(cleanedQuery, cleanedCategory, cleanedAuthor, cleanedPublisher, availableOnly, pageable)
                .map(BookSummary::from)
        );
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<GroupedBookSummary> searchGroupedBooks(
        String query,
        String category,
        String author,
        String publisher,
        boolean availableOnly,
        int page,
        int size
    ) {
        String cleanedQuery = cleanValue(query);
        String cleanedCategory = cleanValue(category);
        String cleanedAuthor = cleanValue(author);
        String cleanedPublisher = cleanValue(publisher);
        var pageable = PageResponse.pageable(page, size);

        var titlePage = bookRepository.searchTitleGroups(
            cleanedQuery,
            cleanedCategory,
            cleanedAuthor,
            cleanedPublisher,
            availableOnly,
            pageable
        );

        List<GroupedBookSummary> content = titlePage.getContent().stream()
            .map(this::toGroupedBookSummary)
            .toList();

        return new PageResponse<>(
            content,
            titlePage.getNumber(),
            titlePage.getSize(),
            titlePage.getTotalElements(),
            titlePage.getTotalPages()
        );
    }

    @Override
    @Transactional(readOnly = true)
    public List<BookSummary> listBooksByTitle(String title) {
        String cleanedTitle = cleanValue(title);
        if (cleanedTitle.isEmpty()) {
            return List.of();
        }
        return bookRepository.findEditionsByTitle(cleanedTitle).stream()
            .map(BookSummary::from)
            .toList();
    }

    private GroupedBookSummary toGroupedBookSummary(Object[] row) {
        return new GroupedBookSummary(
            stringValue(row[0]),
            stringValue(row[1]),
            stringValue(row[2]),
            stringValue(row[3]),
            longValue(row[4]),
            longValue(row[5]),
            longValue(row[6])
        );
    }

    private static String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private static long longValue(Object value) {
        if (value == null) {
            return 0L;
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        return Long.parseLong(String.valueOf(value));
    }

    private PageResponse<BookSummary> searchBooksGroupedByTitle(
        String query,
        String category,
        String author,
        String publisher,
        boolean availableOnly,
        int page,
        int size
    ) {
        PageResponse<GroupedBookSummary> grouped = searchGroupedBooks(
            query,
            category,
            author,
            publisher,
            availableOnly,
            page,
            size
        );
        if (grouped.content().isEmpty()) {
            return new PageResponse<>(List.of(), grouped.page(), grouped.size(), 0, 0);
        }
        // Compatibility only: load editions for the titles on this page.
        List<BookSummary> editions = grouped.content().stream()
            .flatMap(item -> listBooksByTitle(item.title()).stream())
            .toList();
        return new PageResponse<>(
            editions,
            grouped.page(),
            grouped.size(),
            grouped.totalElements(),
            grouped.totalPages()
        );
    }

    @Override
    @Transactional(readOnly = true)
    public List<String> listCategories() {
        return bookRepository.findDistinctCategories();
    }

    private boolean matchesCatalogFilters(Book book, String category, String author, String publisher) {
        if (!category.isEmpty() && !category.equalsIgnoreCase(book.getCategory())) {
            return false;
        }
        if (!author.isEmpty() && !book.getAuthor().toLowerCase().startsWith(author.toLowerCase())) {
            return false;
        }
        if (!publisher.isEmpty()) {
            String bookPublisher = book.getPublisher() == null ? "" : book.getPublisher();
            if (!bookPublisher.toLowerCase().startsWith(publisher.toLowerCase())) {
                return false;
            }
        }
        return true;
    }

    @Override
    @Transactional
    public Optional<BookCopyScanResponse> scanCopy(ScanType type, String value, UUID actorUserId) {
        Optional<BookCopyScanResponse> response = switch (type) {
            case QR -> bookCopyRepository.findByQrCodeValue(value).map(BookCopyScanResponse::from);
            case RFID -> bookCopyRepository.findByRfidTagUidHash(value).map(BookCopyScanResponse::from);
            case SSN -> bookCopyRepository.findBySsnNumber(value).map(BookCopyScanResponse::from);
        };

        response.ifPresent(scan -> auditLogger.record(
            AuditAction.BOOK_SCAN,
            actorUserId,
            "BookCopy",
            scan.copyId(),
            type.name() + " · " + value
        ));
        return response;
    }

    @Override
    @Transactional
    public BookSummary addBook(BookCreateRequest request, UUID actorUserId) {
        UserAccount actor = findCatalogManager(actorUserId);
        String baseSsn = cleanValue(request.ssnNumber());

        if (bookRepository.existsById(baseSsn)) {
            throw new IllegalStateException("SSN number already exists");
        }

        Book book = new Book(
            baseSsn,
            request.title(),
            request.author(),
            request.publisher(),
            request.category(),
            request.finePerDay(),
            request.loanPeriodDays()
        );

        for (int index = 1; index <= request.copyCount(); index++) {
            String copySsn = request.copyCount() == 1 ? baseSsn : baseSsn + "-" + index;
            String accessionNumber = "ACC-" + copySsn;
            String qrCodeValue = "BOOK-QR-" + copySsn;
            book.addCopy(new BookCopy(copySsn, accessionNumber, qrCodeValue, request.shelfLocation()));
        }

        Book savedBook = bookRepository.save(book);
        auditLogger.record(
            AuditAction.BOOK_ADD,
            actor.getId(),
            "Book",
            null,
            savedBook.getSsnNumber() + ": " + savedBook.getTitle()
        );
        return BookSummary.from(savedBook);
    }

    @Override
    @Transactional
    public BookSummary updateBook(String ssnNumber, BookUpdateRequest request, UUID actorUserId) {
        UserAccount actor = findCatalogManager(actorUserId);
        Book book = bookRepository.findById(cleanValue(ssnNumber))
            .orElseThrow(() -> new IllegalArgumentException("Book not found"));

        book.updateDetails(
            request.title().trim(),
            request.author().trim(),
            request.publisher() == null || request.publisher().isBlank() ? null : request.publisher().trim(),
            request.category().trim(),
            request.finePerDay(),
            request.loanPeriodDays()
        );

        Book savedBook = bookRepository.save(book);
        auditLogger.record(
            AuditAction.BOOK_UPDATE,
            actor.getId(),
            "Book",
            null,
            savedBook.getSsnNumber()
                + ": "
                + savedBook.getTitle()
                + " · fine Rs "
                + savedBook.getFinePerDay()
                + "/day · loan "
                + savedBook.getLoanPeriodDays()
                + " days"
        );
        return BookSummary.from(savedBook);
    }

    @Override
    @Transactional
    public void removeBook(String ssnNumber, UUID actorUserId) {
        UserAccount actor = findCatalogManager(actorUserId);
        Book book = bookRepository.findById(cleanValue(ssnNumber))
            .orElseThrow(() -> new IllegalArgumentException("Book not found"));

        ensureNoIssuedCopies(book);
        deleteCirculationHistory(book);
        bookRepository.delete(book);
        auditLogger.record(
            AuditAction.BOOK_REMOVE,
            actor.getId(),
            "Book",
            null,
            book.getSsnNumber() + ": " + book.getTitle()
        );
    }

    @Override
    @Transactional(readOnly = true)
    public List<BookCopySummary> listBookCopies(String ssnNumber, UUID actorUserId) {
        findCatalogManager(actorUserId);
        Book book = bookRepository.findById(cleanValue(ssnNumber))
            .orElseThrow(() -> new IllegalArgumentException("Book not found"));

        return book.getCopies().stream()
            .map(BookCopySummary::from)
            .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public BookCopySummary getBookCopyByQrCode(String qrCodeValue, UUID actorUserId) {
        findCatalogManager(actorUserId);
        BookCopy copy = bookCopyRepository.findByQrCodeValue(qrCodeValue)
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

        Book book = copy.getBook();
        String bookSsn = book.getSsnNumber();
        String copySsn = copy.getSsnNumber();
        UUID copyId = copy.getId();
        circulationTransactionRepository.deleteByBookCopy(copy);
        bookCopyRepository.delete(copy);

        if (bookCopyRepository.countByBook(book) == 0) {
            bookRepository.delete(book);
        }

        auditLogger.record(
            AuditAction.BOOK_REMOVE,
            actor.getId(),
            "BookCopy",
            copyId,
            copySsn + " (" + bookSsn + ")"
        );
    }

    private void ensureNoIssuedCopies(Book book) {
        boolean hasIssuedCopy = book.getCopies().stream()
            .anyMatch(copy -> copy.getStatus() == BookCopyStatus.ISSUED);

        if (hasIssuedCopy) {
            throw new IllegalStateException("Issued book copies must be returned before removal");
        }
    }

    private void deleteCirculationHistory(Book book) {
        book.getCopies().forEach(circulationTransactionRepository::deleteByBookCopy);
    }

    private String cleanValue(String value) {
        return value == null ? "" : value.trim();
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
