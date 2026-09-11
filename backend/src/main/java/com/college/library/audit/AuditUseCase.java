package com.college.library.audit;

import com.college.library.common.PageResponse;
import java.time.LocalDate;
import java.util.UUID;

public interface AuditUseCase {

    void record(AuditAction action, UUID actorUserId, String targetType, UUID targetId, String details);

    PageResponse<AuditEventResponse> listEvents(
        UUID actorUserId,
        LocalDate fromDate,
        LocalDate toDate,
        AuditAction action,
        int page,
        int size
    );
}
