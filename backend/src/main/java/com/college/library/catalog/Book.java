package com.college.library.catalog;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "books")
public class Book {

    @Id
    @Column(name = "ssn_number", nullable = false)
    private String ssnNumber;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String author;

    private String publisher;

    @Column(nullable = false)
    private String category;

    @Column(nullable = false)
    private long finePerDay;

    @Column(nullable = false)
    private int loanPeriodDays;

    @OneToMany(mappedBy = "book", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<BookCopy> copies = new HashSet<>();

    protected Book() {
    }

    public Book(
        String ssnNumber,
        String title,
        String author,
        String publisher,
        String category,
        long finePerDay,
        int loanPeriodDays
    ) {
        this.ssnNumber = ssnNumber;
        this.title = title;
        this.author = author;
        this.publisher = publisher;
        this.category = category;
        this.finePerDay = finePerDay;
        this.loanPeriodDays = loanPeriodDays;
    }

    public String getSsnNumber() {
        return ssnNumber;
    }

    public String getTitle() {
        return title;
    }

    public String getAuthor() {
        return author;
    }

    public String getPublisher() {
        return publisher;
    }

    public String getCategory() {
        return category;
    }

    public long getFinePerDay() {
        return finePerDay;
    }

    public int getLoanPeriodDays() {
        return loanPeriodDays;
    }

    public Set<BookCopy> getCopies() {
        return copies;
    }

    public void updateDetails(
        String title,
        String author,
        String publisher,
        String category,
        long finePerDay,
        int loanPeriodDays
    ) {
        this.title = title;
        this.author = author;
        this.publisher = publisher;
        this.category = category;
        this.finePerDay = finePerDay;
        this.loanPeriodDays = loanPeriodDays;
    }

    public void addCopy(BookCopy copy) {
        copies.add(copy);
        copy.assignTo(this);
    }
}
