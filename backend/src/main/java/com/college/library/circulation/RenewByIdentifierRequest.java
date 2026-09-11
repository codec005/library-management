package com.college.library.circulation;

import com.college.library.catalog.ScanType;
import com.college.library.identity.IdentifierType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record RenewByIdentifierRequest(
    @NotNull IdentifierType borrowerIdentifierType,
    @NotBlank String borrowerIdentifier,
    @NotNull ScanType bookScanType,
    @NotBlank String bookScanValue,
    @Min(1) Integer renewalDays
) {
}
