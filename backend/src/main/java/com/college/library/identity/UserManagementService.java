package com.college.library.identity;

import com.college.library.audit.AuditAction;
import com.college.library.audit.AuditLogger;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserManagementService implements UserManagementUseCase {

    private final UserAccountRepository userAccountRepository;
    private final UserIdentifierRepository userIdentifierRepository;
    private final UserCredentialRepository userCredentialRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogger auditLogger;

    public UserManagementService(
        UserAccountRepository userAccountRepository,
        UserIdentifierRepository userIdentifierRepository,
        UserCredentialRepository userCredentialRepository,
        PasswordEncoder passwordEncoder,
        AuditLogger auditLogger
    ) {
        this.userAccountRepository = userAccountRepository;
        this.userIdentifierRepository = userIdentifierRepository;
        this.userCredentialRepository = userCredentialRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditLogger = auditLogger;
    }

    @Override
    @Transactional
    public UserSummary selfRegisterStudent(UserRegistrationRequest request) {
        if (request.role() != UserRole.STUDENT) {
            throw new IllegalStateException("Guests can register only student accounts");
        }

        UserAccount student = createUser(request);
        auditLogger.record(AuditAction.USER_REGISTER, null, "UserAccount", student.getId(), "guest student registration");
        return UserSummary.from(student);
    }

    @Override
    @Transactional
    public UserSummary registerUser(UserRegistrationRequest request, UUID actorUserId) {
        UserAccount actor = findActor(actorUserId);

        if (request.role() == UserRole.STUDENT && !hasAnyRole(actor, UserRole.LIBRARIAN, UserRole.ADMIN, UserRole.SUPER_ADMIN)) {
            throw new IllegalStateException("Only librarian or admin can register students");
        }

        if ((request.role() == UserRole.LIBRARIAN || request.role() == UserRole.ADMIN)
            && !hasAnyRole(actor, UserRole.ADMIN, UserRole.SUPER_ADMIN)) {
            throw new IllegalStateException("Only admin can register librarian or admin accounts");
        }

        if (request.role() != UserRole.STUDENT && request.role() != UserRole.LIBRARIAN && request.role() != UserRole.ADMIN) {
            throw new IllegalStateException("This registration flow supports only student, librarian, and admin accounts");
        }

        UserAccount user = createUser(request);
        auditLogger.record(AuditAction.USER_REGISTER, actor.getId(), "UserAccount", user.getId(), request.role().name());
        return UserSummary.from(user);
    }

    @Override
    @Transactional
    public void removeStudent(UUID studentId, UUID actorUserId) {
        removeUser(studentId, actorUserId);
    }

    @Override
    @Transactional
    public void removeUser(UUID userId, UUID actorUserId) {
        UserAccount actor = findActor(actorUserId);
        UserAccount targetUser = userAccountRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (targetUser.getRoles().contains(UserRole.STUDENT)
            && !hasAnyRole(actor, UserRole.LIBRARIAN, UserRole.ADMIN, UserRole.SUPER_ADMIN)) {
            throw new IllegalStateException("Only librarian or admin can remove students");
        }

        if (targetUser.getRoles().contains(UserRole.LIBRARIAN)
            && !hasAnyRole(actor, UserRole.ADMIN, UserRole.SUPER_ADMIN)) {
            throw new IllegalStateException("Only admin can remove librarians");
        }

        if (targetUser.getRoles().contains(UserRole.ADMIN)) {
            if (!hasAnyRole(actor, UserRole.ADMIN, UserRole.SUPER_ADMIN)) {
                throw new IllegalStateException("Only admin can remove another admin");
            }

            if (actor.getId().equals(targetUser.getId())) {
                throw new IllegalStateException("Admin cannot remove their own account");
            }
        }

        if (targetUser.getRoles().contains(UserRole.SUPER_ADMIN)) {
            throw new IllegalStateException("Super admin accounts cannot be removed from this screen");
        }

        targetUser.deactivate();
        auditLogger.record(AuditAction.USER_REMOVE, actor.getId(), "UserAccount", targetUser.getId(), "user deactivated");
    }

    @Override
    @Transactional
    public UserQrCredentialResponse getUserQrCredential(UUID userId, UUID actorUserId) {
        UserAccount actor = findActor(actorUserId);

        if (!hasAnyRole(actor, UserRole.LIBRARIAN, UserRole.ADMIN, UserRole.SUPER_ADMIN)) {
            throw new IllegalStateException("Only librarian or admin can generate user QR codes");
        }

        UserAccount user = userAccountRepository.findById(userId)
            .filter(UserAccount::isActive)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));

        String qrCredential = userIdentifierRepository.findByUserAndType(user, IdentifierType.QR_CREDENTIAL)
            .orElseGet(() -> createQrCredential(user))
            .getValue();

        auditLogger.record(AuditAction.USER_QR_GENERATE, actor.getId(), "UserAccount", user.getId(), "QR credential requested");
        return new UserQrCredentialResponse(user.getId(), user.getFullName(), qrCredential);
    }

    @Override
    @Transactional(readOnly = true)
    public UserDetailsResponse getUserDetails(UUID userId, UUID actorUserId) {
        UserAccount actor = findActor(actorUserId);
        UserAccount user = userAccountRepository.findById(userId)
            .filter(UserAccount::isActive)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));

        boolean viewingSelf = actor.getId().equals(user.getId());
        boolean staffViewingStudent = user.getRoles().contains(UserRole.STUDENT)
            && hasAnyRole(actor, UserRole.LIBRARIAN, UserRole.ADMIN, UserRole.SUPER_ADMIN);
        boolean adminViewingStaff = hasAnyRole(actor, UserRole.ADMIN, UserRole.SUPER_ADMIN);

        if (!viewingSelf && !staffViewingStudent && !adminViewingStaff) {
            throw new IllegalStateException("You are not allowed to view this user");
        }

        return UserDetailsResponse.from(user);
    }

    @Override
    @Transactional(readOnly = true)
    public UserDetailsResponse getStudentDetailsByIdentifier(IdentifierType identifierType, String identifier, UUID actorUserId) {
        UserAccount actor = findActor(actorUserId);

        if (!hasAnyRole(actor, UserRole.LIBRARIAN, UserRole.ADMIN, UserRole.SUPER_ADMIN)) {
            throw new IllegalStateException("Only librarian or admin can check students");
        }

        UserAccount user = userIdentifierRepository.findByTypeAndValue(identifierType, cleanValue(identifier))
            .filter(userIdentifier -> userIdentifier.getUser().isActive())
            .orElseThrow(() -> new IllegalArgumentException("Student not found for the entered identifier"))
            .getUser();

        if (!user.getRoles().contains(UserRole.STUDENT)) {
            throw new IllegalStateException("The entered identifier does not belong to a student");
        }

        return UserDetailsResponse.from(user);
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserSummary> listUsers() {
        return userAccountRepository.findAll().stream()
            .filter(UserAccount::isActive)
            .map(UserSummary::from)
            .toList();
    }

    private UserAccount createUser(UserRegistrationRequest request) {
        ensureIdentifierAvailable(IdentifierType.ROLL_NUMBER, request.rollNumber());

        UserAccount user = new UserAccount(request.fullName(), request.department(), Set.of(request.role()));
        user.addIdentifier(new UserIdentifier(IdentifierType.ROLL_NUMBER, request.rollNumber(), true));
        user.addIdentifier(new UserIdentifier(IdentifierType.QR_CREDENTIAL, "USER-QR-" + request.rollNumber(), true));

        if (request.collegeEmail() != null && !request.collegeEmail().isBlank()) {
            ensureIdentifierAvailable(IdentifierType.COLLEGE_EMAIL, request.collegeEmail());
            user.addIdentifier(new UserIdentifier(IdentifierType.COLLEGE_EMAIL, request.collegeEmail(), true));
        }

        UserAccount savedUser = userAccountRepository.save(user);
        userCredentialRepository.save(new UserCredential(savedUser, passwordEncoder.encode(request.password())));
        return savedUser;
    }

    private void ensureIdentifierAvailable(IdentifierType type, String value) {
        userIdentifierRepository.findByTypeAndValue(type, value)
            .ifPresent(identifier -> {
                throw new IllegalStateException(type + " already exists");
            });
    }

    private String cleanValue(String value) {
        return value == null ? "" : value.trim();
    }

    private UserIdentifier createQrCredential(UserAccount user) {
        String baseValue = userIdentifierRepository.findByUserAndType(user, IdentifierType.ROLL_NUMBER)
            .map(UserIdentifier::getValue)
            .orElse(user.getId().toString());
        String qrValue = "USER-QR-" + baseValue;

        ensureIdentifierAvailable(IdentifierType.QR_CREDENTIAL, qrValue);

        UserIdentifier qrIdentifier = new UserIdentifier(IdentifierType.QR_CREDENTIAL, qrValue, true);
        user.addIdentifier(qrIdentifier);
        return userIdentifierRepository.save(qrIdentifier);
    }

    private UserAccount findActor(UUID actorUserId) {
        if (actorUserId == null) {
            throw new IllegalStateException("Actor user is required");
        }

        return userAccountRepository.findById(actorUserId)
            .filter(UserAccount::isActive)
            .orElseThrow(() -> new IllegalArgumentException("Actor user not found"));
    }

    private boolean hasAnyRole(UserAccount user, UserRole... allowedRoles) {
        return Set.of(allowedRoles).stream().anyMatch(user.getRoles()::contains);
    }
}
