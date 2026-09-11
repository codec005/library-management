package com.college.library.audit;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface AuditUseCase {

    void record(AuditAction action, UUID actorUserId, String targetType, UUID targetId, String details);

    List<AuditEventResponse> listEvents(UUID actorUserId, LocalDate fromDate, LocalDate toDate, AuditAction action);
}
