package com.college.library.circulation;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

public record CirculationResponse(
    UUID transactionId,
    String borrowerName,
    String accessionNumber,
    String bookTitle,
    LocalDate issuedOn,
    LocalDate dueOn,
    LocalDate returnedOn,
    CirculationStatus status,
    long fineAmount
) {
    private static final long DAILY_FINE_AMOUNT = 5;

    static CirculationResponse from(CirculationTransaction transaction) {
        LocalDate fineUntil = transaction.getReturnedOn() == null ? LocalDate.now() : transaction.getReturnedOn();
        long overdueDays = Math.max(0, ChronoUnit.DAYS.between(transaction.getDueOn(), fineUntil));

        return new CirculationResponse(
            transaction.getId(),
            transaction.getBorrower().getFullName(),
            transaction.getBookCopy().getAccessionNumber(),
            transaction.getBookCopy().getBook().getTitle(),
            transaction.getIssuedOn(),
            transaction.getDueOn(),
            transaction.getReturnedOn(),
            transaction.getStatus(),
            overdueDays * DAILY_FINE_AMOUNT
        );
    }
}
