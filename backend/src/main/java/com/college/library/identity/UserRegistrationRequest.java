package com.college.library.identity;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record UserRegistrationRequest(
    @NotBlank String fullName,
    @NotBlank String department,
    @NotBlank String rollNumber,
    String collegeEmail,
    @NotBlank String password,
    @NotNull UserRole role
) {
}
