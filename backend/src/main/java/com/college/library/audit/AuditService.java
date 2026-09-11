package com.college.library.audit;

import com.college.library.identity.IdentifierType;
import com.college.library.identity.UserAccount;
import com.college.library.identity.UserAccountRepository;
import com.college.library.identity.UserIdentifier;
import com.college.library.identity.UserIdentifierRepository;
import com.college.library.identity.UserRole;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditService implements AuditLogger, AuditUseCase {

    private final AuditEventRepository auditEventRepository;
    private final UserAccountRepository userAccountRepository;
    private final UserIdentifierRepository userIdentifierRepository;

    public AuditService(
        AuditEventRepository auditEventRepository,
        UserAccountRepository userAccountRepository,
        UserIdentifierRepository userIdentifierRepository
    ) {
        this.auditEventRepository = auditEventRepository;
        this.userAccountRepository = userAccountRepository;
        this.userIdentifierRepository = userIdentifierRepository;
    }

    @Override
    public void record(AuditAction action, UUID actorUserId, String targetType, UUID targetId, String details) {
        auditEventRepository.save(new AuditEvent(action, actorUserId, targetType, targetId, details));
    }

    @Override
    @Transactional(readOnly = true)
    public List<AuditEventResponse> listEvents(UUID actorUserId, LocalDate fromDate, LocalDate toDate, AuditAction action) {
        findAdmin(actorUserId);

        LocalDate from = fromDate == null ? LocalDate.now().minusDays(7) : fromDate;
        LocalDate to = toDate == null ? LocalDate.now() : toDate;

        if (to.isBefore(from)) {
            throw new IllegalArgumentException("To date cannot be before from date");
        }

        ZoneId zone = ZoneId.systemDefault();
        Instant fromInclusive = from.atStartOfDay(zone).toInstant();
        Instant toExclusive = to.plusDays(1).atStartOfDay(zone).toInstant();

        List<AuditEvent> events = action == null
            ? auditEventRepository.findByCreatedAtBetweenOrderByCreatedAtDesc(fromInclusive, toExclusive)
            : auditEventRepository.findByActionAndCreatedAtBetweenOrderByCreatedAtDesc(action, fromInclusive, toExclusive);

        return events.stream()
            .map(this::toResponse)
            .toList();
    }

    private AuditEventResponse toResponse(AuditEvent event) {
        String doneBy = resolveUserLabel(event.getActorUserId());
        String targetUser = "UserAccount".equals(event.getTargetType())
            ? resolveUserLabel(event.getTargetId())
            : null;
        String actionLabel = actionLabel(event.getAction());
        String summary = buildSummary(event, doneBy, targetUser);

        return new AuditEventResponse(
            event.getId(),
            event.getAction().name(),
            actionLabel,
            summary,
            doneBy,
            event.getCreatedAt()
        );
    }

    private String buildSummary(AuditEvent event, String doneBy, String targetUser) {
        String details = event.getDetails() == null || event.getDetails().isBlank() ? null : event.getDetails();

        return switch (event.getAction()) {
            case PASSWORD_LOGIN -> doneBy + " logged in with password"
                + loginMethodSuffix(details);
            case SCAN_LOGIN -> doneBy + " logged in by scan"
                + loginMethodSuffix(details);
            case USER_REGISTER -> {
                String registeredUser = rememberedUserLabel(details, targetUser);
                if (details != null && details.toLowerCase().contains("guest")) {
                    yield registeredUser + " self-registered as student";
                }
                yield doneBy + " registered " + registeredUser + " as " + registeredRole(details);
            }
            case USER_REMOVE -> doneBy + " deleted user " + rememberedUserLabel(details, targetUser);
            case USER_UPDATE -> doneBy + " updated user " + rememberedUserLabel(details, targetUser)
                + (details == null ? "" : " (" + registeredRole(details) + ")");
            case USER_QR_GENERATE -> doneBy + " generated QR for " + rememberedUserLabel(details, targetUser);
            case BOOK_ADD -> doneBy + " added book" + (details == null ? "" : " " + details);
            case BOOK_REMOVE -> doneBy + " removed " + (event.getTargetType() == null ? "book" : friendlyTarget(event.getTargetType()))
                + (details == null ? "" : " " + details);
            case BOOK_SCAN -> "Book copy scanned"
                + (details == null ? "" : " by " + details);
            case BOOK_ISSUE -> doneBy + " issued book copy"
                + (details == null ? "" : " " + details);
            case BOOK_RETURN -> doneBy + " returned book copy"
                + (details == null ? "" : " " + details);
            case BOOK_RENEW -> doneBy + " renewed book"
                + (details == null ? "" : " · " + details);
        };
    }

    private String resolveUserLabel(UUID userId) {
        if (userId == null) {
            return "System";
        }

        return userAccountRepository.findById(userId)
            .map(user -> {
                String roll = userIdentifierRepository.findByUserAndType(user, IdentifierType.ROLL_NUMBER)
                    .map(UserIdentifier::getValue)
                    .orElse(null);
                return roll == null || roll.isBlank()
                    ? user.getFullName()
                    : user.getFullName() + " (" + roll + ")";
            })
            .orElse("Unknown user");
    }

    private String actionLabel(AuditAction action) {
        return switch (action) {
            case PASSWORD_LOGIN -> "Password login";
            case SCAN_LOGIN -> "Scan login";
            case BOOK_SCAN -> "Book scan";
            case BOOK_ISSUE -> "Book issued";
            case BOOK_RETURN -> "Book returned";
            case BOOK_RENEW -> "Book renewed";
            case USER_REGISTER -> "User registered";
            case USER_REMOVE -> "User deleted";
            case USER_UPDATE -> "User updated";
            case BOOK_ADD -> "Book added";
            case BOOK_REMOVE -> "Book removed";
            case USER_QR_GENERATE -> "User QR generated";
        };
    }

    private String rememberedUserLabel(String details, String targetUser) {
        if (targetUser != null && !targetUser.equals("Unknown user") && !targetUser.equals("System")) {
            return targetUser;
        }

        if (details == null || details.isBlank()) {
            return "a user account";
        }

        String[] parts = details.split("·");
        if (parts.length >= 2) {
            String first = parts[0].trim();
            String second = parts[1].trim();

            // Older format: "STUDENT · Full Name"
            if (first.matches("^[A-Z_]+$")) {
                return second;
            }

            // Newer format: "Full Name (ROLL) · ROLE"
            return first;
        }

        if (details.toLowerCase().contains("guest")) {
            return "a guest student";
        }

        return details;
    }

    private String registeredRole(String details) {
        if (details == null || details.isBlank()) {
            return "user";
        }

        String[] parts = details.split("·");
        String rolePart = parts[0].trim();
        if (parts.length >= 2 && !rolePart.matches("^[A-Z_]+$")) {
            rolePart = parts[parts.length - 1].trim();
            if (rolePart.equalsIgnoreCase("guest registration")) {
                rolePart = parts.length >= 2 ? parts[parts.length - 2].trim() : "STUDENT";
            }
        }

        return rolePart.toLowerCase().replace('_', ' ');
    }

    private String loginMethodSuffix(String details) {
        if (details == null || details.isBlank()) {
            return "";
        }

        String[] parts = details.split("·");
        String methodPart = parts[parts.length - 1].trim();
        return " using " + friendlyIdentifier(methodPart);
    }

    private String friendlyIdentifier(String value) {
        return switch (value) {
            case "ROLL_NUMBER" -> "roll number";
            case "COLLEGE_EMAIL" -> "college email";
            case "PHONE_NUMBER" -> "phone number";
            case "QR_CREDENTIAL" -> "QR code";
            case "RFID_CARD" -> "RFID card";
            case "QR" -> "QR";
            case "RFID" -> "RFID";
            case "SSN" -> "SSN";
            default -> value.toLowerCase().replace('_', ' ');
        };
    }

    private String friendlyTarget(String targetType) {
        return switch (targetType) {
            case "UserAccount" -> "user";
            case "Book" -> "book";
            case "BookCopy" -> "book copy";
            case "CirculationTransaction" -> "loan";
            default -> targetType;
        };
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
