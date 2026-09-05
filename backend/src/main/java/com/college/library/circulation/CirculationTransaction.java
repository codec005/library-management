package com.college.library.circulation;

import com.college.library.catalog.BookCopy;
import com.college.library.common.BaseEntity;
import com.college.library.identity.UserAccount;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDate;

@Entity
@Table(name = "circulation_transactions")
public class CirculationTransaction extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "book_copy_id", nullable = false)
    private BookCopy bookCopy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "borrower_id", nullable = false)
    private UserAccount borrower;

    @Column(nullable = false)
    private LocalDate issuedOn;

    @Column(nullable = false)
    private LocalDate dueOn;

    private LocalDate returnedOn;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CirculationStatus status;

    protected CirculationTransaction() {
    }

    public CirculationTransaction(BookCopy bookCopy, UserAccount borrower, LocalDate issuedOn, LocalDate dueOn) {
        this.bookCopy = bookCopy;
        this.borrower = borrower;
        this.issuedOn = issuedOn;
        this.dueOn = dueOn;
        this.status = CirculationStatus.ISSUED;
    }

    public BookCopy getBookCopy() {
        return bookCopy;
    }

    public UserAccount getBorrower() {
        return borrower;
    }

    public LocalDate getIssuedOn() {
        return issuedOn;
    }

    public LocalDate getDueOn() {
        return dueOn;
    }

    public LocalDate getReturnedOn() {
        return returnedOn;
    }

    public CirculationStatus getStatus() {
        return status;
    }

    public void markReturned(LocalDate returnedOn) {
        this.returnedOn = returnedOn;
        this.status = CirculationStatus.RETURNED;
        this.bookCopy.markAvailable();
    }

    public void renew(int additionalDays) {
        this.dueOn = this.dueOn.plusDays(additionalDays);
    }
}
