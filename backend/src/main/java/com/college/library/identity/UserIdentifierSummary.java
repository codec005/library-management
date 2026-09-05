package com.college.library.identity;

public record UserIdentifierSummary(
    IdentifierType type,
    String value,
    boolean verified
) {
    static UserIdentifierSummary from(UserIdentifier identifier) {
        return new UserIdentifierSummary(identifier.getType(), identifier.getValue(), identifier.isVerified());
    }
}
