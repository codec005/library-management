package com.college.library.circulation;

import com.college.library.catalog.ScanType;
import com.college.library.identity.IdentifierType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record IssueByIdentifierRequest(
    @NotNull IdentifierType borrowerIdentifierType,
    @NotBlank String borrowerIdentifier,
    @NotNull ScanType bookScanType,
    @NotBlank String bookScanValue
) {
}
