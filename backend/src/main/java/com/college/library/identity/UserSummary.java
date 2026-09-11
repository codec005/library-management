package com.college.library.identity;

import java.util.Set;
import java.util.UUID;

public record UserSummary(
    UUID id,
    String fullName,
    String department,
    Set<UserRole> roles,
    boolean active,
    String rollNumber
) {
    static UserSummary from(UserAccount user) {
        String rollNumber = user.getIdentifiers().stream()
            .filter(identifier -> identifier.getType() == IdentifierType.ROLL_NUMBER)
            .map(UserIdentifier::getValue)
            .findFirst()
            .orElse(null);

        return new UserSummary(
            user.getId(),
            user.getFullName(),
            user.getDepartment(),
            user.getRoles(),
            user.isActive(),
            rollNumber
        );
    }
}
