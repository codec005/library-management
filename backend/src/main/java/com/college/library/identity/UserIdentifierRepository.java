package com.college.library.identity;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserIdentifierRepository extends JpaRepository<UserIdentifier, UUID> {

    Optional<UserIdentifier> findByTypeAndValue(IdentifierType type, String value);

    @Query("select identifier from UserIdentifier identifier join fetch identifier.user where identifier.type = :type and identifier.value = :value")
    Optional<UserIdentifier> findWithUserByTypeAndValue(@Param("type") IdentifierType type, @Param("value") String value);

    Optional<UserIdentifier> findByUserAndType(UserAccount user, IdentifierType type);
}
