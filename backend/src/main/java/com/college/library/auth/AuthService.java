package com.college.library.auth;

import com.college.library.audit.AuditAction;
import com.college.library.audit.AuditLogger;
import com.college.library.identity.IdentityResolver;
import com.college.library.identity.IdentifierType;
import com.college.library.identity.UserAccount;
import com.college.library.identity.UserCredentialRepository;
import com.college.library.identity.UserRole;
import com.college.library.security.JwtService;
import com.college.library.settings.AppSettingsService;
import java.time.Duration;
import java.time.Instant;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService implements AuthUseCase {

    private static final int MAX_FAILED_LOGIN_ATTEMPTS = 5;
    private static final Duration LOGIN_LOCKOUT_DURATION = Duration.ofMinutes(15);

    private final IdentityResolver identityResolver;
    private final UserCredentialRepository userCredentialRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogger auditLogger;
    private final AppSettingsService appSettingsService;
    private final JwtService jwtService;

    public AuthService(
        IdentityResolver identityResolver,
        UserCredentialRepository userCredentialRepository,
        PasswordEncoder passwordEncoder,
        AuditLogger auditLogger,
        AppSettingsService appSettingsService,
        JwtService jwtService
    ) {
        this.identityResolver = identityResolver;
        this.userCredentialRepository = userCredentialRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditLogger = auditLogger;
        this.appSettingsService = appSettingsService;
        this.jwtService = jwtService;
    }

    @Override
    @Transactional(noRollbackFor = BadCredentialsException.class)
    public LoginResponse login(LoginRequest request) {
        UserAccount user = identityResolver.resolve(request.identifierType(), cleanValue(request.identifier()))
            .orElseThrow(() -> new BadCredentialsException("Invalid login details"))
            .getUser();

        if (!user.isActive()) {
            throw new BadCredentialsException("Account is inactive");
        }

        Instant now = Instant.now();
        ensureLoginNotLocked(user, now);

        boolean isStudent = user.getRoles().contains(UserRole.STUDENT);
        boolean isStaff = user.getRoles().stream().anyMatch(role ->
            role == UserRole.FACULTY
                || role == UserRole.LIBRARIAN
                || role == UserRole.ADMIN
                || role == UserRole.SUPER_ADMIN
        );

        if (request.staffPortal()) {
            if (!isStaff) {
                throw new BadCredentialsException("Students must use the Student Login window");
            }
        } else {
            if (!isStudent) {
                throw new BadCredentialsException("Staff must use the Staff Login window");
            }
            if (!appSettingsService.isStudentPasswordRequired()) {
                throw new BadCredentialsException("Students can login only through QR scan");
            }
        }

        boolean matches = userCredentialRepository.findByUser(user)
            .map(credential -> passwordEncoder.matches(request.password(), credential.getPasswordHash()))
            .orElse(false);

        if (!matches) {
            user.recordFailedLogin(MAX_FAILED_LOGIN_ATTEMPTS, now.plus(LOGIN_LOCKOUT_DURATION));
            if (user.isLoginLocked(now)) {
                throw new BadCredentialsException(
                    "Too many failed attempts (" + user.getFailedLoginAttempts() + " of "
                        + MAX_FAILED_LOGIN_ATTEMPTS + "). Try again in 15 minutes."
                );
            }
            throw new BadCredentialsException(
                "Invalid password. Failed attempts: " + user.getFailedLoginAttempts()
                    + " of " + MAX_FAILED_LOGIN_ATTEMPTS + "."
            );
        }

        user.clearLoginFailures();

        auditLogger.record(
            AuditAction.PASSWORD_LOGIN,
            user.getId(),
            "UserAccount",
            user.getId(),
            user.getFullName() + " · " + request.identifierType().name()
        );
        return toLoginResponse(user);
    }

    @Override
    @Transactional
    public LoginResponse scanLogin(ScanLoginRequest request) {
        UserAccount user = resolveScannedAccount(request);

        if (!user.getRoles().contains(UserRole.STUDENT)) {
            throw new BadCredentialsException("Staff must use the Staff Login window");
        }

        if (appSettingsService.isStudentPasswordRequired()) {
            throw new BadCredentialsException(
                "Student password login is enabled. Scan your QR, then enter your password."
            );
        }

        auditLogger.record(
            AuditAction.SCAN_LOGIN,
            user.getId(),
            "UserAccount",
            user.getId(),
            user.getFullName() + " · " + request.identifierType().name()
        );
        return toLoginResponse(user);
    }

    @Override
    @Transactional(readOnly = true)
    public void checkStudentQr(ScanLoginRequest request) {
        UserAccount user = resolveScannedAccount(request);
        if (!user.getRoles().contains(UserRole.STUDENT)) {
            throw new BadCredentialsException("Staff must use the Staff Login window");
        }
    }

    private UserAccount resolveScannedAccount(ScanLoginRequest request) {
        if (request.identifierType() != IdentifierType.QR_CREDENTIAL && request.identifierType() != IdentifierType.RFID_CARD) {
            throw new BadCredentialsException("Scan login supports only QR or RFID credentials");
        }

        UserAccount user = identityResolver.resolve(request.identifierType(), cleanValue(request.identifier()))
            .filter(identifier -> identifier.isVerified())
            .orElseThrow(() -> new BadCredentialsException("Invalid scan credential"))
            .getUser();

        if (!user.isActive()) {
            throw new BadCredentialsException("Account is inactive");
        }

        return user;
    }

    private void ensureLoginNotLocked(UserAccount user, Instant now) {
        if (user.isLoginLocked(now)) {
            throw new BadCredentialsException("Too many failed attempts. Try again in 15 minutes.");
        }
        if (user.getLockedUntil() != null) {
            user.clearLoginFailures();
        }
    }

    private LoginResponse toLoginResponse(UserAccount user) {
        String accessToken = jwtService.createToken(
            user.getId(),
            user.getFullName(),
            user.getRoles().stream().map(Enum::name).toList()
        );
        return new LoginResponse(user.getId(), user.getFullName(), user.getRoles(), accessToken);
    }

    private String cleanValue(String value) {
        return value == null ? "" : value.trim();
    }
}
