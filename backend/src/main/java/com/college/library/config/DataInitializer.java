package com.college.library.config;

import com.college.library.identity.IdentifierType;
import com.college.library.identity.UserAccount;
import com.college.library.identity.UserAccountRepository;
import com.college.library.identity.UserCredential;
import com.college.library.identity.UserCredentialRepository;
import com.college.library.identity.UserIdentifier;
import com.college.library.identity.UserRole;
import java.util.Set;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
@Profile({"local", "mariadb"})
public class DataInitializer {

    @Bean
    CommandLineRunner seedData(
        UserAccountRepository userAccountRepository,
        UserCredentialRepository userCredentialRepository,
        PasswordEncoder passwordEncoder
    ) {
        return args -> ensureDefaultAdmin(userAccountRepository, userCredentialRepository, passwordEncoder);
    }

    private void ensureDefaultAdmin(
        UserAccountRepository userAccountRepository,
        UserCredentialRepository userCredentialRepository,
        PasswordEncoder passwordEncoder
    ) {
        boolean adminAlreadyExists = userAccountRepository.findAll().stream()
            .anyMatch(user -> user.getRoles().contains(UserRole.ADMIN) || user.getRoles().contains(UserRole.SUPER_ADMIN));
        if (adminAlreadyExists) {
            return;
        }

        UserAccount admin = new UserAccount("Admin User", "Administration", Set.of(UserRole.ADMIN));
        admin.addIdentifier(new UserIdentifier(IdentifierType.ROLL_NUMBER, "ADMIN001", true));
        admin.addIdentifier(new UserIdentifier(IdentifierType.QR_CREDENTIAL, "USER-QR-ADMIN001", true));
        userAccountRepository.save(admin);
        userCredentialRepository.save(new UserCredential(admin, passwordEncoder.encode("admin123")));
    }
}
