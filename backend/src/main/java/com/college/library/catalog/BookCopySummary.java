package com.college.library.catalog;

import java.util.UUID;

public record BookCopySummary(
    UUID copyId,
    String ssnNumber,
    String bookSsnNumber,
    String title,
    String author,
    String publisher,
    String category,
    long finePerDay,
    int loanPeriodDays,
    String accessionNumber,
    String qrCodeValue,
    String shelfLocation,
    BookCopyStatus status
) {
    static BookCopySummary from(BookCopy copy) {
        Book book = copy.getBook();
        return new BookCopySummary(
            copy.getId(),
            copy.getSsnNumber(),
            book.getSsnNumber(),
            book.getTitle(),
            book.getAuthor(),
            book.getPublisher(),
            book.getCategory(),
            book.getFinePerDay(),
            book.getLoanPeriodDays(),
            copy.getAccessionNumber(),
            copy.getQrCodeValue(),
            copy.getShelfLocation(),
            copy.getStatus()
        );
    }
}
