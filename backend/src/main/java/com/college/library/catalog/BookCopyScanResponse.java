package com.college.library.catalog;

import java.util.UUID;

public record BookCopyScanResponse(
    UUID copyId,
    String ssnNumber,
    String bookSsnNumber,
    String accessionNumber,
    String title,
    String author,
    String shelfLocation,
    BookCopyStatus status,
    int loanPeriodDays
) {
    static BookCopyScanResponse from(BookCopy copy) {
        return new BookCopyScanResponse(
            copy.getId(),
            copy.getSsnNumber(),
            copy.getBook().getSsnNumber(),
            copy.getAccessionNumber(),
            copy.getBook().getTitle(),
            copy.getBook().getAuthor(),
            copy.getShelfLocation(),
            copy.getStatus(),
            copy.getBook().getLoanPeriodDays()
        );
    }
}
