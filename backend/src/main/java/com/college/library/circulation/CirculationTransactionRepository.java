package com.college.library.circulation;

import com.college.library.catalog.BookCopy;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CirculationTransactionRepository extends JpaRepository<CirculationTransaction, UUID> {

    Optional<CirculationTransaction> findByBookCopyAndStatus(BookCopy bookCopy, CirculationStatus status);
}
