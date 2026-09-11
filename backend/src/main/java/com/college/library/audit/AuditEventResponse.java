package com.college.library.audit;

import java.time.Instant;
import java.util.UUID;

public record AuditEventResponse(
    UUID id,
    String action,
    String actionLabel,
    String summary,
    String doneBy,
    Instant createdAt
) {
}
