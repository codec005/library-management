package com.college.library.catalog;

import java.util.UUID;

public record BookCopySummary(
    UUID copyId,
    String ssnNumber,
    String title,
    String accessionNumber,
    String qrCodeValue,
    String shelfLocation,
    BookCopyStatus status
) {
    static BookCopySummary from(BookCopy copy) {
        return new BookCopySummary(
            copy.getId(),
            copy.getSsnNumber(),
            copy.getBook().getTitle(),
            copy.getAccessionNumber(),
            copy.getQrCodeValue(),
            copy.getShelfLocation(),
            copy.getStatus()
        );
    }
}
