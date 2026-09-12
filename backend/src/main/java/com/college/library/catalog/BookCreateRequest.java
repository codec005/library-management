package com.college.library.catalog;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record BookCreateRequest(
    @NotBlank String title,
    @NotBlank String author,
    String publisher,
    @NotBlank String category,
    @Min(0) long finePerDay,
    @Min(1) @Max(14) int loanPeriodDays,
    @NotEmpty List<@Valid BookCopyCreateRequest> copies
) {
}
