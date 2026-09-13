package com.college.library.identity;

import jakarta.validation.constraints.NotBlank;

public record ChangePasswordRequest(
    @NotBlank String oldPassword,
    @NotBlank String newPassword
) {
}
