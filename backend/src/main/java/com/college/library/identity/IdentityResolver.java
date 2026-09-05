package com.college.library.identity;

import java.util.Optional;

public interface IdentityResolver {

    Optional<UserIdentifier> resolve(IdentifierType type, String value);
}
