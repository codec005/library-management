package com.college.library.catalog;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BookCopyRepository extends JpaRepository<BookCopy, UUID> {

    Optional<BookCopy> findByQrCodeValue(String qrCodeValue);

    Optional<BookCopy> findByRfidTagUidHash(String rfidTagUidHash);
}
