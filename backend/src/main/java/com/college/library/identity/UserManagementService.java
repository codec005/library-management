package com.college.library.identity;

import com.college.library.audit.AuditAction;
import com.college.library.audit.AuditLogger;
import com.college.library.circulation.CirculationStatus;
import com.college.library.circulation.CirculationTransactionRepository;
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
    private final CirculationTransactionRepository circulationTransactionRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogger auditLogger;

    public UserManagementService(
        UserAccountRepository userAccountRepository,
        UserIdentifierRepository userIdentifierRepository,
        UserCredentialRepository userCredentialRepository,
        CirculationTransactionRepository circulationTransactionRepository,
        PasswordEncoder passwordEncoder,
        AuditLogger auditLogger
    ) {
        this.userAccountRepository = userAccountRepository;
        this.userIdentifierRepository = userIdentifierRepository;
        this.userCredentialRepository = userCredentialRepository;
        this.circulationTransactionRepository = circulationTransactionRepository;
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
        String rollNumber = request.rollNumber().trim();
        auditLogger.record(
            AuditAction.USER_REGISTER,
            null,
            "UserAccount",
            student.getId(),
            student.getFullName() + " (" + rollNumber + ") · STUDENT · guest registration"
        );
        return UserSummary.from(student);
    }

    @Override
    @Transactional
    public UserSummary registerUser(UserRegistrationRequest request, UUID actorUserId) {
        UserAccount actor = findActor(actorUserId);

        if (!hasAnyRole(actor, UserRole.ADMIN, UserRole.SUPER_ADMIN)) {
            throw new IllegalStateException("Only admin can register users");
        }

        if (request.role() != UserRole.STUDENT
            && request.role() != UserRole.FACULTY
            && request.role() != UserRole.LIBRARIAN
            && request.role() != UserRole.ADMIN) {
            throw new IllegalStateException("This registration flow supports only student, faculty, librarian, and admin accounts");
        }

        UserAccount user = createUser(request);
        auditLogger.record(
            AuditAction.USER_REGISTER,
            actor.getId(),
            "UserAccount",
            user.getId(),
            user.getFullName() + " (" + request.rollNumber().trim() + ") · " + request.role().name()
        );
        return UserSummary.from(user);
    }

    @Override
    @Transactional
    public UserDetailsResponse updateUser(UUID userId, UserUpdateRequest request, UUID actorUserId) {
        UserAccount actor = findActor(actorUserId);

        if (!hasAnyRole(actor, UserRole.ADMIN, UserRole.SUPER_ADMIN)) {
            throw new IllegalStateException("Only admin can edit users");
        }

        UserAccount targetUser = userAccountRepository.findById(userId)
            .filter(UserAccount::isActive)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (targetUser.getRoles().contains(UserRole.SUPER_ADMIN)) {
            throw new IllegalStateException("Super admin accounts cannot be edited from this screen");
        }

        if (request.role() != UserRole.STUDENT
            && request.role() != UserRole.FACULTY
            && request.role() != UserRole.LIBRARIAN
            && request.role() != UserRole.ADMIN) {
            throw new IllegalStateException("Supported roles are student, faculty, librarian, and admin");
        }

        if (actor.getId().equals(targetUser.getId()) && request.role() != UserRole.ADMIN && request.role() != UserRole.SUPER_ADMIN) {
            throw new IllegalStateException("Admin cannot remove their own admin role");
        }

        String rollNumber = cleanValue(request.rollNumber());
        String collegeEmail = cleanValue(request.collegeEmail());
        String password = request.password() == null ? "" : request.password().trim();

        updateIdentifier(targetUser, IdentifierType.ROLL_NUMBER, rollNumber, true);
        updateIdentifier(targetUser, IdentifierType.QR_CREDENTIAL, "USER-QR-" + rollNumber, true);

        if (collegeEmail.isBlank()) {
            removeIdentifier(targetUser, IdentifierType.COLLEGE_EMAIL);
        } else {
            updateIdentifier(targetUser, IdentifierType.COLLEGE_EMAIL, collegeEmail, false);
        }

        targetUser.updateProfile(cleanValue(request.fullName()), cleanValue(request.department()));
        targetUser.replaceRoles(Set.of(request.role()));

        if (!password.isBlank()) {
            userCredentialRepository.findByUser(targetUser)
                .ifPresentOrElse(
                    credential -> {
                        credential.updatePasswordHash(passwordEncoder.encode(password));
                        userCredentialRepository.save(credential);
                    },
                    () -> userCredentialRepository.save(new UserCredential(targetUser, passwordEncoder.encode(password)))
                );
        }

        UserAccount savedUser = userAccountRepository.save(targetUser);
        auditLogger.record(
            AuditAction.USER_UPDATE,
            actor.getId(),
            "UserAccount",
            savedUser.getId(),
            savedUser.getFullName() + " (" + rollNumber + ") · " + request.role().name()
        );
        return UserDetailsResponse.from(savedUser);
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

        if ((targetUser.getRoles().contains(UserRole.FACULTY) || targetUser.getRoles().contains(UserRole.LIBRARIAN))
            && !hasAnyRole(actor, UserRole.ADMIN, UserRole.SUPER_ADMIN)) {
            throw new IllegalStateException("Only admin can remove faculty or librarians");
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

        if (!circulationTransactionRepository.findByBorrowerAndStatus(targetUser, CirculationStatus.ISSUED).isEmpty()) {
            throw new IllegalStateException("User has issued books that must be returned before removal");
        }

        UUID targetUserId = targetUser.getId();
        String rollNumber = userIdentifierRepository.findByUserAndType(targetUser, IdentifierType.ROLL_NUMBER)
            .map(UserIdentifier::getValue)
            .orElse("N/A");
        String roleLabel = targetUser.getRoles().stream().findFirst().map(Enum::name).orElse("USER");
        String deletedUserLabel = targetUser.getFullName() + " (" + rollNumber + ") · " + roleLabel;

        userCredentialRepository.findByUser(targetUser).ifPresent(userCredentialRepository::delete);
        circulationTransactionRepository.deleteByBorrower(targetUser);
        userAccountRepository.delete(targetUser);
        auditLogger.record(AuditAction.USER_REMOVE, actor.getId(), "UserAccount", targetUserId, deletedUserLabel);
    }

    @Override
    @Transactional
    public UserQrCredentialResponse getUserQrCredential(UUID userId, UUID actorUserId) {
        UserAccount actor = findActor(actorUserId);

        if (!hasAnyRole(actor, UserRole.ADMIN, UserRole.SUPER_ADMIN)) {
            throw new IllegalStateException("Only admin can generate user QR codes");
        }

        UserAccount user = userAccountRepository.findById(userId)
            .filter(UserAccount::isActive)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));

        String qrCredential = userIdentifierRepository.findByUserAndType(user, IdentifierType.QR_CREDENTIAL)
            .orElseGet(() -> createQrCredential(user))
            .getValue();

        auditLogger.record(
            AuditAction.USER_QR_GENERATE,
            actor.getId(),
            "UserAccount",
            user.getId(),
            userLabel(user) + " · QR credential requested"
        );
        return new UserQrCredentialResponse(user.getId(), user.getFullName(), qrCredential);
    }

    private String userLabel(UserAccount user) {
        String rollNumber = userIdentifierRepository.findByUserAndType(user, IdentifierType.ROLL_NUMBER)
            .map(UserIdentifier::getValue)
            .orElse("N/A");
        return user.getFullName() + " (" + rollNumber + ")";
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
            && hasAnyRole(actor, UserRole.FACULTY, UserRole.LIBRARIAN, UserRole.ADMIN, UserRole.SUPER_ADMIN);
        boolean staffViewingFaculty = user.getRoles().contains(UserRole.FACULTY)
            && hasAnyRole(actor, UserRole.ADMIN, UserRole.SUPER_ADMIN);
        boolean facultyViewingLibrarian = user.getRoles().contains(UserRole.LIBRARIAN)
            && hasAnyRole(actor, UserRole.FACULTY);
        boolean adminViewingStaff = hasAnyRole(actor, UserRole.ADMIN, UserRole.SUPER_ADMIN);

        if (!viewingSelf && !staffViewingStudent && !staffViewingFaculty && !facultyViewingLibrarian && !adminViewingStaff) {
            throw new IllegalStateException("You are not allowed to view this user");
        }

        return UserDetailsResponse.from(user);
    }

    @Override
    @Transactional(readOnly = true)
    public UserDetailsResponse getStudentDetailsByIdentifier(IdentifierType identifierType, String identifier, UUID actorUserId) {
        UserAccount actor = findActor(actorUserId);

        if (!hasAnyRole(actor, UserRole.FACULTY, UserRole.LIBRARIAN, UserRole.ADMIN, UserRole.SUPER_ADMIN)) {
            throw new IllegalStateException("Only faculty, librarian, or admin can check students");
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

    private void ensureIdentifierAvailableForOtherUser(IdentifierType type, String value, UserAccount currentUser) {
        userIdentifierRepository.findByTypeAndValue(type, value)
            .ifPresent(identifier -> {
                if (!identifier.getUser().getId().equals(currentUser.getId())) {
                    throw new IllegalStateException(type + " already exists");
                }
            });
    }

    private void updateIdentifier(UserAccount user, IdentifierType type, String value, boolean required) {
        String cleaned = cleanValue(value);
        if (cleaned.isBlank()) {
            if (required) {
                throw new IllegalArgumentException(type + " is required");
            }
            removeIdentifier(user, type);
            return;
        }

        ensureIdentifierAvailableForOtherUser(type, cleaned, user);
        userIdentifierRepository.findByUserAndType(user, type)
            .ifPresentOrElse(
                identifier -> identifier.updateValue(cleaned),
                () -> user.addIdentifier(new UserIdentifier(type, cleaned, true))
            );
    }

    private void removeIdentifier(UserAccount user, IdentifierType type) {
        user.getIdentifiers().removeIf(identifier -> identifier.getType() == type);
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
