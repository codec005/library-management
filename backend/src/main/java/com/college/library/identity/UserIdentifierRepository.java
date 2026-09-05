package com.college.library.identity;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserIdentifierRepository extends JpaRepository<UserIdentifier, UUID> {

    Optional<UserIdentifier> findByTypeAndValue(IdentifierType type, String value);
}
