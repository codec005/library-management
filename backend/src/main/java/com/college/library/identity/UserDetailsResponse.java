package com.college.library.identity;

import java.util.List;
import java.util.Set;
import java.util.UUID;

public record UserDetailsResponse(
    UUID id,
    String fullName,
    String department,
    Set<UserRole> roles,
    boolean active,
    List<UserIdentifierSummary> identifiers
) {
    static UserDetailsResponse from(UserAccount user) {
        return new UserDetailsResponse(
            user.getId(),
            user.getFullName(),
            user.getDepartment(),
            user.getRoles(),
            user.isActive(),
            user.getIdentifiers().stream().map(UserIdentifierSummary::from).toList()
        );
    }
}
