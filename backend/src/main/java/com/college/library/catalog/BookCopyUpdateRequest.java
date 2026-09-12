package com.college.library.catalog;

import jakarta.validation.constraints.NotBlank;

public record BookCopyUpdateRequest(
    @NotBlank String shelfLocation
) {
}
