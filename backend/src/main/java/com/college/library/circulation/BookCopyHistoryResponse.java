package com.college.library.circulation;

import com.college.library.catalog.BookCopyStatus;
import java.util.List;
import java.util.UUID;

public record BookCopyHistoryResponse(
    UUID copyId,
    String ssnNumber,
    String accessionNumber,
    String title,
    String author,
    String shelfLocation,
    BookCopyStatus status,
    List<CirculationResponse> loans
) {
}
