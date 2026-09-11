package com.college.library.audit;

import java.time.Instant;
import java.util.UUID;

public record AuditEventResponse(
    UUID id,
    AuditAction action,
    UUID actorUserId,
    String targetType,
    UUID targetId,
    String details,
    Instant createdAt
) {
    static AuditEventResponse from(AuditEvent event) {
        return new AuditEventResponse(
            event.getId(),
            event.getAction(),
            event.getActorUserId(),
            event.getTargetType(),
            event.getTargetId(),
            event.getDetails(),
            event.getCreatedAt()
        );
    }
}
