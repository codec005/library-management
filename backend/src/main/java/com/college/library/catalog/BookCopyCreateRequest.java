package com.college.library.catalog;

import jakarta.validation.constraints.NotBlank;

public record BookCopyCreateRequest(
    @NotBlank String ssnNumber,
    @NotBlank String shelfLocation
) {
}
