package com.college.library.audit;

import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class AuditService implements AuditLogger {

    private final AuditEventRepository auditEventRepository;

    public AuditService(AuditEventRepository auditEventRepository) {
        this.auditEventRepository = auditEventRepository;
    }

    @Override
    public void record(AuditAction action, UUID actorUserId, String targetType, UUID targetId, String details) {
        auditEventRepository.save(new AuditEvent(action, actorUserId, targetType, targetId, details));
    }
}
