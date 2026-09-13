package com.college.library.identity;

import jakarta.validation.constraints.NotBlank;

public record AdminPasswordResetRequest(
    @NotBlank String newPassword
) {
}
