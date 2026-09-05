package com.college.library.catalog;

import com.college.library.common.BaseEntity;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "books")
public class Book extends BaseEntity {

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String author;

    private String isbn;

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
        String title,
        String author,
        String isbn,
        String publisher,
        String category,
        long finePerDay,
        int loanPeriodDays
    ) {
        this.title = title;
        this.author = author;
        this.isbn = isbn;
        this.publisher = publisher;
        this.category = category;
        this.finePerDay = finePerDay;
        this.loanPeriodDays = loanPeriodDays;
    }

    public String getTitle() {
        return title;
    }

    public String getAuthor() {
        return author;
    }

    public String getIsbn() {
        return isbn;
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

    public void addCopy(BookCopy copy) {
        copies.add(copy);
        copy.assignTo(this);
    }
}
