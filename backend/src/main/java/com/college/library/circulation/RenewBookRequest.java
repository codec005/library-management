package com.college.library.circulation;

import jakarta.validation.constraints.Min;

public record RenewBookRequest(
    @Min(1) Integer renewalDays
) {
}
