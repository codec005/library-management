package com.college.library.config;

import com.college.library.catalog.Book;
import com.college.library.catalog.BookCopy;
import com.college.library.catalog.BookRepository;
import com.college.library.identity.IdentifierType;
import com.college.library.identity.UserAccount;
import com.college.library.identity.UserAccountRepository;
import com.college.library.identity.UserCredential;
import com.college.library.identity.UserCredentialRepository;
import com.college.library.identity.UserIdentifier;
import com.college.library.identity.UserIdentifierRepository;
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
        UserIdentifierRepository userIdentifierRepository,
        BookRepository bookRepository,
        PasswordEncoder passwordEncoder
    ) {
        return args -> {
            ensureDefaultAdmin(userAccountRepository, userCredentialRepository, userIdentifierRepository, passwordEncoder);

            if (bookRepository.count() == 0) {
                Book cleanCode = new Book("9780132350884", "Clean Code", "Robert C. Martin", "Prentice Hall", "Software Engineering", 10, 14);
                cleanCode.addCopy(new BookCopy("9780132350884-1", "ACC-9780132350884-1", "BOOK-QR-9780132350884-1", "A1-R2-S3"));
                cleanCode.addCopy(new BookCopy("9780132350884-2", "ACC-9780132350884-2", "BOOK-QR-9780132350884-2", "A1-R2-S4"));
                bookRepository.save(cleanCode);

                Book dbSystems = new Book("9780073523323", "Database System Concepts", "Abraham Silberschatz", "McGraw Hill", "Database", 8, 14);
                dbSystems.addCopy(new BookCopy("9780073523323", "ACC-9780073523323", "BOOK-QR-9780073523323", "B2-R1-S1"));
                bookRepository.save(dbSystems);
            }
        };
    }

    private void ensureDefaultAdmin(
        UserAccountRepository userAccountRepository,
        UserCredentialRepository userCredentialRepository,
        UserIdentifierRepository userIdentifierRepository,
        PasswordEncoder passwordEncoder
    ) {
        UserAccount admin = userIdentifierRepository.findWithUserByTypeAndValue(IdentifierType.ROLL_NUMBER, "ADMIN001")
            .map(UserIdentifier::getUser)
            .orElseGet(() -> {
                UserAccount newAdmin = new UserAccount("Admin User", "Administration", Set.of(UserRole.ADMIN));
                newAdmin.addIdentifier(new UserIdentifier(IdentifierType.ROLL_NUMBER, "ADMIN001", true));
                return newAdmin;
            });

        admin.activate();
        admin.getRoles().add(UserRole.ADMIN);
        if (userIdentifierRepository.findByTypeAndValue(IdentifierType.QR_CREDENTIAL, "USER-QR-ADMIN001").isEmpty()) {
            admin.addIdentifier(new UserIdentifier(IdentifierType.QR_CREDENTIAL, "USER-QR-ADMIN001", true));
        }
        userAccountRepository.save(admin);

        String passwordHash = passwordEncoder.encode("admin123");
        userCredentialRepository.findByUser(admin)
            .ifPresentOrElse(
                credential -> {
                    credential.updatePasswordHash(passwordHash);
                    userCredentialRepository.save(credential);
                },
                () -> userCredentialRepository.save(new UserCredential(admin, passwordHash))
            );
    }
}
