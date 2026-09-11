package com.college.library.catalog;

import com.college.library.common.PageResponse;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CatalogService {

    PageResponse<BookSummary> searchBooks(String query, boolean availableOnly, int page, int size);

    Optional<BookCopyScanResponse> scanCopy(ScanType type, String value, UUID actorUserId);

    BookSummary addBook(BookCreateRequest request, UUID actorUserId);

    BookSummary updateBook(String ssnNumber, BookUpdateRequest request, UUID actorUserId);

    void removeBook(String ssnNumber, UUID actorUserId);

    List<BookCopySummary> listBookCopies(String ssnNumber, UUID actorUserId);

    BookCopySummary getBookCopyByQrCode(String qrCodeValue, UUID actorUserId);

    void removeBookCopyByQrCode(String qrCodeValue, UUID actorUserId);
}
