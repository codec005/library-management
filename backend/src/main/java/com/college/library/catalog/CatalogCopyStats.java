package com.college.library.catalog;

public record CatalogCopyStats(
    long availableCopies,
    long issuedCopies
) {
}
