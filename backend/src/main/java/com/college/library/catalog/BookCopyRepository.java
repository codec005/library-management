package com.college.library.catalog;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BookCopyRepository extends JpaRepository<BookCopy, UUID> {

    Optional<BookCopy> findByQrCodeValue(String qrCodeValue);

    Optional<BookCopy> findByRfidTagUidHash(String rfidTagUidHash);

    Optional<BookCopy> findBySsnNumber(String ssnNumber);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select copy from BookCopy copy where copy.id = :id")
    Optional<BookCopy> findByIdForUpdate(@Param("id") UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select copy from BookCopy copy where copy.qrCodeValue = :qrCodeValue")
    Optional<BookCopy> findByQrCodeValueForUpdate(@Param("qrCodeValue") String qrCodeValue);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select copy from BookCopy copy where copy.rfidTagUidHash = :rfidTagUidHash")
    Optional<BookCopy> findByRfidTagUidHashForUpdate(@Param("rfidTagUidHash") String rfidTagUidHash);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select copy from BookCopy copy where copy.ssnNumber = :ssnNumber")
    Optional<BookCopy> findBySsnNumberForUpdate(@Param("ssnNumber") String ssnNumber);

    long countByBook(Book book);
}
