package com.college.library.audit;

import java.util.UUID;

public interface AuditLogger {

    void record(AuditAction action, UUID actorUserId, String targetType, UUID targetId, String details);
}
