package com.college.library.circulation;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BookReservationRepository extends JpaRepository<BookReservation, UUID> {
}
