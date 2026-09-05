package com.college.library.identity;

import java.util.Set;
import java.util.UUID;

public record UserSummary(
    UUID id,
    String fullName,
    String department,
    Set<UserRole> roles,
    boolean active
) {
    static UserSummary from(UserAccount user) {
        return new UserSummary(user.getId(), user.getFullName(), user.getDepartment(), user.getRoles(), user.isActive());
    }
}
