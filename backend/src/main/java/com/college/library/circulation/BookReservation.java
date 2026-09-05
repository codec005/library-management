package com.college.library.circulation;

import com.college.library.catalog.Book;
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
@Table(name = "book_reservations")
public class BookReservation extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "book_id", nullable = false)
    private Book book;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "borrower_id", nullable = false)
    private UserAccount borrower;

    @Column(nullable = false)
    private LocalDate requestedOn;

    @Column(nullable = false)
    private LocalDate expiresOn;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ReservationStatus status;

    protected BookReservation() {
    }

    public BookReservation(Book book, UserAccount borrower, LocalDate requestedOn, LocalDate expiresOn) {
        this.book = book;
        this.borrower = borrower;
        this.requestedOn = requestedOn;
        this.expiresOn = expiresOn;
        this.status = ReservationStatus.ACTIVE;
    }

    public Book getBook() {
        return book;
    }

    public UserAccount getBorrower() {
        return borrower;
    }

    public LocalDate getRequestedOn() {
        return requestedOn;
    }

    public LocalDate getExpiresOn() {
        return expiresOn;
    }

    public ReservationStatus getStatus() {
        return status;
    }
}
