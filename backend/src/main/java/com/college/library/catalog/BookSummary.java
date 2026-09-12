package com.college.library.catalog;

import java.util.Objects;
import java.util.stream.Collectors;

public record BookSummary(
    String ssnNumber,
    String title,
    String author,
    String publisher,
    String category,
    long finePerDay,
    int loanPeriodDays,
    long totalCopies,
    long availableCopies,
    String shelfLocation
) {
    static BookSummary from(Book book) {
        long activeCopies = book.getCopies().stream()
            .filter(copy -> copy.getStatus() != BookCopyStatus.REMOVED)
            .count();
        long availableCopies = book.getCopies().stream()
            .filter(copy -> copy.getStatus() == BookCopyStatus.AVAILABLE)
            .count();
        String shelfLocation = book.getCopies().stream()
            .filter(copy -> copy.getStatus() != BookCopyStatus.REMOVED)
            .map(BookCopy::getShelfLocation)
            .filter(Objects::nonNull)
            .map(String::trim)
            .filter(value -> !value.isEmpty())
            .distinct()
            .collect(Collectors.joining(" / "));

        return new BookSummary(
            book.getSsnNumber(),
            book.getTitle(),
            book.getAuthor(),
            book.getPublisher(),
            book.getCategory(),
            book.getFinePerDay(),
            book.getLoanPeriodDays(),
            activeCopies,
            availableCopies,
            shelfLocation.isEmpty() ? null : shelfLocation
        );
    }
}
