package com.college.library.catalog;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;

public record BookCreateRequest(
    @NotBlank String title,
    @NotBlank String author,
    String isbn,
    String publisher,
    @NotBlank String category,
    @NotBlank String shelfLocation,
    @Min(0) long finePerDay,
    @Min(1) @Max(14) int loanPeriodDays,
    @Min(1) int copyCount
) {
}
