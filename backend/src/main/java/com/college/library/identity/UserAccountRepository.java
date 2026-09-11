package com.college.library.identity;

import java.util.Collection;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserAccountRepository extends JpaRepository<UserAccount, UUID> {

    @Query(
        value = """
            select distinct u from UserAccount u
            where u.active = true
            and (
              lower(u.fullName) like lower(concat(:query, '%'))
              or lower(u.department) like lower(concat(:query, '%'))
              or exists (
                select 1 from UserIdentifier i
                where i.user = u
                  and i.type = com.college.library.identity.IdentifierType.ROLL_NUMBER
                  and (
                    lower(i.value) = lower(:query)
                    or lower(i.value) like lower(concat(:query, '%'))
                  )
              )
            )
            and (
              :restrictRoles = false
              or exists (
                select 1 from u.roles role where role in :roles
              )
            )
            """,
        countQuery = """
            select count(distinct u) from UserAccount u
            where u.active = true
            and (
              lower(u.fullName) like lower(concat(:query, '%'))
              or lower(u.department) like lower(concat(:query, '%'))
              or exists (
                select 1 from UserIdentifier i
                where i.user = u
                  and i.type = com.college.library.identity.IdentifierType.ROLL_NUMBER
                  and (
                    lower(i.value) = lower(:query)
                    or lower(i.value) like lower(concat(:query, '%'))
                  )
              )
            )
            and (
              :restrictRoles = false
              or exists (
                select 1 from u.roles role where role in :roles
              )
            )
            """
    )
    Page<UserAccount> searchActiveUsersPrefix(
        @Param("query") String query,
        @Param("restrictRoles") boolean restrictRoles,
        @Param("roles") Collection<UserRole> roles,
        Pageable pageable
    );

    @Query(
        value = """
            select u from UserAccount u
            where u.active = true
            and (
              :restrictRoles = false
              or exists (
                select 1 from u.roles role where role in :roles
              )
            )
            """,
        countQuery = """
            select count(u) from UserAccount u
            where u.active = true
            and (
              :restrictRoles = false
              or exists (
                select 1 from u.roles role where role in :roles
              )
            )
            """
    )
    Page<UserAccount> findActiveUsers(
        @Param("restrictRoles") boolean restrictRoles,
        @Param("roles") Collection<UserRole> roles,
        Pageable pageable
    );
}
