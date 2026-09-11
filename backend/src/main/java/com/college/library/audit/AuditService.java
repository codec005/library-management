package com.college.library.audit;

import com.college.library.identity.UserAccount;
import com.college.library.identity.UserAccountRepository;
import com.college.library.identity.UserRole;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditService implements AuditLogger, AuditUseCase {

    private final AuditEventRepository auditEventRepository;
    private final UserAccountRepository userAccountRepository;

    public AuditService(AuditEventRepository auditEventRepository, UserAccountRepository userAccountRepository) {
        this.auditEventRepository = auditEventRepository;
        this.userAccountRepository = userAccountRepository;
    }

    @Override
    public void record(AuditAction action, UUID actorUserId, String targetType, UUID targetId, String details) {
        auditEventRepository.save(new AuditEvent(action, actorUserId, targetType, targetId, details));
    }

    @Override
    @Transactional(readOnly = true)
    public List<AuditEventResponse> listEvents(UUID actorUserId) {
        findAdmin(actorUserId);
        return auditEventRepository.findAll().stream()
            .sorted(Comparator.comparing(AuditEvent::getCreatedAt).reversed())
            .map(AuditEventResponse::from)
            .toList();
    }

    private UserAccount findAdmin(UUID actorUserId) {
        if (actorUserId == null) {
            throw new IllegalStateException("Actor user is required");
        }

        UserAccount actor = userAccountRepository.findById(actorUserId)
            .filter(UserAccount::isActive)
            .orElseThrow(() -> new IllegalArgumentException("Actor user not found"));

        if (Set.of(UserRole.ADMIN, UserRole.SUPER_ADMIN).stream().noneMatch(actor.getRoles()::contains)) {
            throw new IllegalStateException("Only admin can view audit logs");
        }

        return actor;
    }
}
