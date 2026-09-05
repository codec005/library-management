package com.college.library.catalog;

import java.util.UUID;

public record BookSummary(
    UUID id,
    String title,
    String author,
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
            book.getId(),
            book.getTitle(),
            book.getAuthor(),
            book.getCategory(),
            book.getFinePerDay(),
            book.getLoanPeriodDays(),
            activeCopies,
            availableCopies
        );
    }
}
