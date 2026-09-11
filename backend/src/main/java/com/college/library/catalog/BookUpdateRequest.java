package com.college.library.catalog;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record BookUpdateRequest(
    @NotBlank String title,
    @NotBlank String author,
    String publisher,
    @NotBlank String category,
    @Min(0) long finePerDay,
    @Min(1) @Max(14) int loanPeriodDays
) {
}
