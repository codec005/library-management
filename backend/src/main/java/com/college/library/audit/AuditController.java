package com.college.library.audit;

import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/audit")
public class AuditController {

    private static final String ACTOR_HEADER = "X-Actor-User-Id";

    private final AuditUseCase auditUseCase;

    public AuditController(AuditUseCase auditUseCase) {
        this.auditUseCase = auditUseCase;
    }

    @GetMapping("/events")
    ResponseEntity<List<AuditEventResponse>> listEvents(@RequestHeader(ACTOR_HEADER) UUID actorUserId) {
        return ResponseEntity.ok(auditUseCase.listEvents(actorUserId));
    }
}
