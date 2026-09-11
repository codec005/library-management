package com.college.library.circulation;

import com.college.library.catalog.BookCopy;
import com.college.library.identity.UserAccount;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CirculationTransactionRepository extends JpaRepository<CirculationTransaction, UUID> {

    Optional<CirculationTransaction> findByBookCopyAndStatus(BookCopy bookCopy, CirculationStatus status);

    List<CirculationTransaction> findByBorrowerAndStatus(UserAccount borrower, CirculationStatus status);

    void deleteByBorrower(UserAccount borrower);

    void deleteByBookCopy(BookCopy bookCopy);
}
