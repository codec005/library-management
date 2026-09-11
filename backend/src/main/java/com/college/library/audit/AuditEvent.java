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

    @Column(length = 255)
    private String actorLabel;

    private String targetType;

    private UUID targetId;

    @Column(nullable = false)
    private String details;

    protected AuditEvent() {
    }

    public AuditEvent(
        AuditAction action,
        UUID actorUserId,
        String actorLabel,
        String targetType,
        UUID targetId,
        String details
    ) {
        this.action = action;
        this.actorUserId = actorUserId;
        this.actorLabel = actorLabel;
        this.targetType = targetType;
        this.targetId = targetId;
        this.details = details;
    }

    public AuditAction getAction() {
        return action;
    }

    public UUID getActorUserId() {
        return actorUserId;
    }

    public String getActorLabel() {
        return actorLabel;
    }

    public String getTargetType() {
        return targetType;
    }

    public UUID getTargetId() {
        return targetId;
    }

    public String getDetails() {
        return details;
    }
}
