package com.college.library.audit;

import com.college.library.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "audit_events")
public class AuditEvent extends BaseEntity {

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AuditAction action;

    private UUID actorUserId;

    private String targetType;

    private UUID targetId;

    @Column(nullable = false)
    private String details;

    protected AuditEvent() {
    }

    public AuditEvent(AuditAction action, UUID actorUserId, String targetType, UUID targetId, String details) {
        this.action = action;
        this.actorUserId = actorUserId;
        this.targetType = targetType;
        this.targetId = targetId;
        this.details = details;
    }
}
