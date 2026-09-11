package com.college.library.catalog;

import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BookRepository extends JpaRepository<Book, String> {

    @Query(
        value = """
            select b from Book b
            where (
              lower(b.ssnNumber) = lower(:query)
              or lower(b.title) like lower(concat(:query, '%'))
              or lower(b.author) like lower(concat(:query, '%'))
              or lower(b.category) like lower(concat(:query, '%'))
              or lower(b.ssnNumber) like lower(concat(:query, '%'))
            )
            and (
              :availableOnly = false
              or exists (
                select 1 from BookCopy copy
                where copy.book = b and copy.status = com.college.library.catalog.BookCopyStatus.AVAILABLE
              )
            )
            """,
        countQuery = """
            select count(b) from Book b
            where (
              lower(b.ssnNumber) = lower(:query)
              or lower(b.title) like lower(concat(:query, '%'))
              or lower(b.author) like lower(concat(:query, '%'))
              or lower(b.category) like lower(concat(:query, '%'))
              or lower(b.ssnNumber) like lower(concat(:query, '%'))
            )
            and (
              :availableOnly = false
              or exists (
                select 1 from BookCopy copy
                where copy.book = b and copy.status = com.college.library.catalog.BookCopyStatus.AVAILABLE
              )
            )
            """
    )
    Page<Book> searchPrefix(
        @Param("query") String query,
        @Param("availableOnly") boolean availableOnly,
        Pageable pageable
    );

    @Query(
        value = """
            select b from Book b
            where (
              :availableOnly = false
              or exists (
                select 1 from BookCopy copy
                where copy.book = b and copy.status = com.college.library.catalog.BookCopyStatus.AVAILABLE
              )
            )
            """,
        countQuery = """
            select count(b) from Book b
            where (
              :availableOnly = false
              or exists (
                select 1 from BookCopy copy
                where copy.book = b and copy.status = com.college.library.catalog.BookCopyStatus.AVAILABLE
              )
            )
            """
    )
    Page<Book> findAllFiltered(
        @Param("availableOnly") boolean availableOnly,
        Pageable pageable
    );

    Optional<Book> findBySsnNumberIgnoreCase(String ssnNumber);
}
