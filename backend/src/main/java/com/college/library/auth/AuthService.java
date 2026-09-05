package com.college.library.auth;

import com.college.library.audit.AuditAction;
import com.college.library.audit.AuditLogger;
import com.college.library.identity.IdentityResolver;
import com.college.library.identity.IdentifierType;
import com.college.library.identity.UserAccount;
import com.college.library.identity.UserCredentialRepository;
import java.util.UUID;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService implements AuthUseCase {

    private final IdentityResolver identityResolver;
    private final UserCredentialRepository userCredentialRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogger auditLogger;

    public AuthService(
        IdentityResolver identityResolver,
        UserCredentialRepository userCredentialRepository,
        PasswordEncoder passwordEncoder,
        AuditLogger auditLogger
    ) {
        this.identityResolver = identityResolver;
        this.userCredentialRepository = userCredentialRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditLogger = auditLogger;
    }

    @Override
    @Transactional
    public LoginResponse login(LoginRequest request) {
        UserAccount user = identityResolver.resolve(request.identifierType(), request.identifier())
            .orElseThrow(() -> new BadCredentialsException("Invalid login details"))
            .getUser();

        if (!user.isActive()) {
            throw new BadCredentialsException("Account is inactive");
        }

        boolean matches = userCredentialRepository.findByUser(user)
            .map(credential -> passwordEncoder.matches(request.password(), credential.getPasswordHash()))
            .orElse(false);

        if (!matches) {
            throw new BadCredentialsException("Invalid login details");
        }

        auditLogger.record(AuditAction.PASSWORD_LOGIN, user.getId(), "UserAccount", user.getId(), request.identifierType().name());
        return new LoginResponse(user.getId(), user.getFullName(), user.getRoles(), "dev-token-" + UUID.randomUUID());
    }

    @Override
    @Transactional
    public LoginResponse scanLogin(ScanLoginRequest request) {
        if (request.identifierType() != IdentifierType.QR_CREDENTIAL && request.identifierType() != IdentifierType.RFID_CARD) {
            throw new BadCredentialsException("Scan login supports only QR or RFID credentials");
        }

        UserAccount user = identityResolver.resolve(request.identifierType(), request.identifier())
            .filter(identifier -> identifier.isVerified())
            .orElseThrow(() -> new BadCredentialsException("Invalid scan credential"))
            .getUser();

        if (!user.isActive()) {
            throw new BadCredentialsException("Account is inactive");
        }

        auditLogger.record(AuditAction.SCAN_LOGIN, user.getId(), "UserAccount", user.getId(), request.identifierType().name());
        return new LoginResponse(user.getId(), user.getFullName(), user.getRoles(), "scan-token-" + UUID.randomUUID());
    }
}
