package com.college.library.auth;

import com.college.library.identity.IdentifierType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ScanLoginRequest(
    @NotNull IdentifierType identifierType,
    @NotBlank String identifier
) {
}
