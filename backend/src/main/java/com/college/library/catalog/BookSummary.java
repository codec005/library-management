package com.college.library.catalog;

public record BookSummary(
    String ssnNumber,
    String title,
    String author,
    String publisher,
    String category,
    long finePerDay,
    int loanPeriodDays,
    long totalCopies,
    long availableCopies
) {
    static BookSummary from(Book book) {
        long activeCopies = book.getCopies().stream()
            .filter(copy -> copy.getStatus() != BookCopyStatus.REMOVED)
            .count();
        long availableCopies = book.getCopies().stream()
            .filter(copy -> copy.getStatus() == BookCopyStatus.AVAILABLE)
            .count();

        return new BookSummary(
            book.getSsnNumber(),
            book.getTitle(),
            book.getAuthor(),
            book.getPublisher(),
            book.getCategory(),
            book.getFinePerDay(),
            book.getLoanPeriodDays(),
            activeCopies,
            availableCopies
        );
    }
}
