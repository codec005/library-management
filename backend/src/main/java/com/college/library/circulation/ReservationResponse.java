package com.college.library.circulation;

import java.time.LocalDate;
import java.util.UUID;

public record ReservationResponse(
    UUID reservationId,
    String borrowerName,
    String bookTitle,
    LocalDate requestedOn,
    LocalDate expiresOn,
    ReservationStatus status
) {
    static ReservationResponse from(BookReservation reservation) {
        return new ReservationResponse(
            reservation.getId(),
            reservation.getBorrower().getFullName(),
            reservation.getBook().getTitle(),
            reservation.getRequestedOn(),
            reservation.getExpiresOn(),
            reservation.getStatus()
        );
    }
}
