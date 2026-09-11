package com.college.library.circulation;

import com.college.library.catalog.BookCopy;
import com.college.library.identity.UserAccount;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CirculationTransactionRepository extends JpaRepository<CirculationTransaction, UUID> {

    Optional<CirculationTransaction> findByBookCopyAndStatus(BookCopy bookCopy, CirculationStatus status);

    List<CirculationTransaction> findByBorrowerAndStatus(UserAccount borrower, CirculationStatus status);

    Page<CirculationTransaction> findByStatus(CirculationStatus status, Pageable pageable);

    @Query("""
        select t from CirculationTransaction t
        join fetch t.bookCopy copy
        join fetch copy.book book
        where t.borrower = :borrower
          and t.status = :status
          and (
            lower(copy.ssnNumber) = lower(:bookKey)
            or lower(copy.qrCodeValue) = lower(:bookKey)
            or lower(copy.accessionNumber) = lower(:bookKey)
            or lower(book.ssnNumber) = lower(:bookKey)
            or (copy.rfidTagUidHash is not null and lower(copy.rfidTagUidHash) = lower(:bookKey))
          )
        """)
    List<CirculationTransaction> findIssuedMatchesForBorrower(
        @Param("borrower") UserAccount borrower,
        @Param("status") CirculationStatus status,
        @Param("bookKey") String bookKey
    );

    List<CirculationTransaction> findByBookCopyOrderByIssuedOnDesc(BookCopy bookCopy);

    void deleteByBorrower(UserAccount borrower);

    void deleteByBookCopy(BookCopy bookCopy);
}
