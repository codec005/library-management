package com.college.library.catalog;

import com.college.library.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "book_copies")
public class BookCopy extends BaseEntity {

    @Column(nullable = false, unique = true)
    private String ssnNumber;

    @Column(nullable = false, unique = true)
    private String accessionNumber;

    @Column(nullable = false, unique = true)
    private String qrCodeValue;

    @Column(unique = true)
    private String rfidTagUidHash;

    @Column(nullable = false)
    private String shelfLocation;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BookCopyStatus status = BookCopyStatus.AVAILABLE;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "book_id", nullable = false)
    private Book book;

    protected BookCopy() {
    }

    public BookCopy(String ssnNumber, String accessionNumber, String qrCodeValue, String shelfLocation) {
        this.ssnNumber = ssnNumber;
        this.accessionNumber = accessionNumber;
        this.qrCodeValue = qrCodeValue;
        this.shelfLocation = shelfLocation;
    }

    public String getSsnNumber() {
        return ssnNumber;
    }

    public String getAccessionNumber() {
        return accessionNumber;
    }

    public String getQrCodeValue() {
        return qrCodeValue;
    }

    public String getRfidTagUidHash() {
        return rfidTagUidHash;
    }

    public String getShelfLocation() {
        return shelfLocation;
    }

    public BookCopyStatus getStatus() {
        return status;
    }

    public Book getBook() {
        return book;
    }

    public void markIssued() {
        status = BookCopyStatus.ISSUED;
    }

    public void markAvailable() {
        status = BookCopyStatus.AVAILABLE;
    }

    void assignTo(Book book) {
        this.book = book;
    }
}
