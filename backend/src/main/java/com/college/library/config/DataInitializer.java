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
        BookRepository bookRepository,
        PasswordEncoder passwordEncoder
    ) {
        return args -> {
            if (userAccountRepository.count() == 0) {
                UserAccount admin = new UserAccount("Admin User", "Administration", Set.of(UserRole.ADMIN));
                admin.addIdentifier(new UserIdentifier(IdentifierType.ROLL_NUMBER, "ADMIN001", true));
                admin.addIdentifier(new UserIdentifier(IdentifierType.QR_CREDENTIAL, "USER-QR-ADMIN001", true));
                userAccountRepository.save(admin);
                userCredentialRepository.save(new UserCredential(admin, passwordEncoder.encode("admin123")));
            }

            if (bookRepository.count() == 0) {
                Book cleanCode = new Book("Clean Code", "Robert C. Martin", "9780132350884", "Prentice Hall", "Software Engineering", 10, 14);
                cleanCode.addCopy(new BookCopy("ACC-0001", "BOOK-QR-ACC-0001", "A1-R2-S3"));
                cleanCode.addCopy(new BookCopy("ACC-0002", "BOOK-QR-ACC-0002", "A1-R2-S4"));
                bookRepository.save(cleanCode);

                Book dbSystems = new Book("Database System Concepts", "Abraham Silberschatz", "9780073523323", "McGraw Hill", "Database", 8, 14);
                dbSystems.addCopy(new BookCopy("ACC-0003", "BOOK-QR-ACC-0003", "B2-R1-S1"));
                bookRepository.save(dbSystems);
            }
        };
    }
}
