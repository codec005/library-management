package com.college.library.identity;

import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class JpaIdentityResolver implements IdentityResolver {

    private final UserIdentifierRepository userIdentifierRepository;

    public JpaIdentityResolver(UserIdentifierRepository userIdentifierRepository) {
        this.userIdentifierRepository = userIdentifierRepository;
    }

    @Override
    public Optional<UserIdentifier> resolve(IdentifierType type, String value) {
        return userIdentifierRepository.findByTypeAndValue(type, value);
    }
}
