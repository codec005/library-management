package com.college.library.catalog;

public record GroupedBookSummary(
    String title,
    String author,
    String publisher,
    String category,
    long editionCount,
    long totalCopies,
    long availableCopies
) {
}
