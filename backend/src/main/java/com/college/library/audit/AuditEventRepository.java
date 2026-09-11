package com.college.library.audit;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditEventRepository extends JpaRepository<AuditEvent, UUID> {

    List<AuditEvent> findByCreatedAtBetweenOrderByCreatedAtDesc(Instant fromInclusive, Instant toExclusive);

    List<AuditEvent> findByActionAndCreatedAtBetweenOrderByCreatedAtDesc(
        AuditAction action,
        Instant fromInclusive,
        Instant toExclusive
    );
}
