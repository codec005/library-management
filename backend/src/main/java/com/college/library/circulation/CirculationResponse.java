package com.college.library.circulation;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

public record CirculationResponse(
    UUID transactionId,
    UUID bookCopyId,
    String borrowerName,
    String borrowerCode,
    String accessionNumber,
    String bookTitle,
    LocalDate issuedOn,
    Instant issuedAt,
    LocalDate dueOn,
    LocalDate returnedOn,
    Instant returnedAt,
    CirculationStatus status,
    int loanPeriodDays,
    long overdueDays,
    long finePerDay,
    long fineAmount
) {
    static CirculationResponse from(CirculationTransaction transaction) {
        return from(transaction, null);
    }

    static CirculationResponse from(CirculationTransaction transaction, String borrowerCode) {
        LocalDate fineUntil = transaction.getReturnedOn() == null ? LocalDate.now() : transaction.getReturnedOn();
        long overdueDays = Math.max(0, ChronoUnit.DAYS.between(transaction.getDueOn(), fineUntil));
        long finePerDay = transaction.getBookCopy().getBook().getFinePerDay();
        long fineAmount = transaction.isFineReset() ? 0 : overdueDays * finePerDay;

        return new CirculationResponse(
            transaction.getId(),
            transaction.getBookCopy().getId(),
            transaction.getBorrower().getFullName(),
            borrowerCode,
            transaction.getBookCopy().getAccessionNumber(),
            transaction.getBookCopy().getBook().getTitle(),
            transaction.getIssuedOn(),
            transaction.getCreatedAt(),
            transaction.getDueOn(),
            transaction.getReturnedOn(),
            transaction.getReturnedAt(),
            transaction.getStatus(),
            transaction.getBookCopy().getBook().getLoanPeriodDays(),
            overdueDays,
            finePerDay,
            fineAmount
        );
    }
}
