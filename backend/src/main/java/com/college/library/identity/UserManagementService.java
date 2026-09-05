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

        if (request.role() == UserRole.LIBRARIAN && !hasAnyRole(actor, UserRole.ADMIN, UserRole.SUPER_ADMIN)) {
            throw new IllegalStateException("Only admin can register librarians");
        }

        if (request.role() != UserRole.STUDENT && request.role() != UserRole.LIBRARIAN) {
            throw new IllegalStateException("This registration flow supports only student and librarian accounts");
        }

        UserAccount user = createUser(request);
        auditLogger.record(AuditAction.USER_REGISTER, actor.getId(), "UserAccount", user.getId(), request.role().name());
        return UserSummary.from(user);
    }

    @Override
    @Transactional
    public void removeStudent(UUID studentId, UUID actorUserId) {
        UserAccount actor = findActor(actorUserId);

        if (!hasAnyRole(actor, UserRole.LIBRARIAN, UserRole.ADMIN, UserRole.SUPER_ADMIN)) {
            throw new IllegalStateException("Only librarian or admin can remove students");
        }

        UserAccount student = userAccountRepository.findById(studentId)
            .orElseThrow(() -> new IllegalArgumentException("Student not found"));

        if (!student.getRoles().contains(UserRole.STUDENT)) {
            throw new IllegalStateException("Only student accounts can be removed here");
        }

        student.deactivate();
        auditLogger.record(AuditAction.USER_REMOVE, actor.getId(), "UserAccount", student.getId(), "student deactivated");
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
