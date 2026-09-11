package com.college.library.audit;

import java.time.Instant;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditEventRepository extends JpaRepository<AuditEvent, UUID> {

    Page<AuditEvent> findByCreatedAtBetween(Instant fromInclusive, Instant toExclusive, Pageable pageable);

    Page<AuditEvent> findByActionAndCreatedAtBetween(
        AuditAction action,
        Instant fromInclusive,
        Instant toExclusive,
        Pageable pageable
    );
}
