package com.college.library.auth;

import com.college.library.identity.UserRole;
import java.util.Set;
import java.util.UUID;

public record LoginResponse(
    UUID userId,
    String fullName,
    Set<UserRole> roles,
    String accessToken
) {
}
