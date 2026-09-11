package com.college.library.catalog;

import java.util.List;
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
              :query = ''
              or lower(b.ssnNumber) = lower(:query)
              or lower(b.title) like lower(concat(:query, '%'))
              or lower(b.author) like lower(concat(:query, '%'))
              or lower(b.category) like lower(concat(:query, '%'))
              or lower(b.ssnNumber) like lower(concat(:query, '%'))
            )
            and (:category = '' or lower(b.category) = lower(:category))
            and (:author = '' or lower(b.author) like lower(concat(:author, '%')))
            and (
              :publisher = ''
              or lower(coalesce(b.publisher, '')) like lower(concat(:publisher, '%'))
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
              :query = ''
              or lower(b.ssnNumber) = lower(:query)
              or lower(b.title) like lower(concat(:query, '%'))
              or lower(b.author) like lower(concat(:query, '%'))
              or lower(b.category) like lower(concat(:query, '%'))
              or lower(b.ssnNumber) like lower(concat(:query, '%'))
            )
            and (:category = '' or lower(b.category) = lower(:category))
            and (:author = '' or lower(b.author) like lower(concat(:author, '%')))
            and (
              :publisher = ''
              or lower(coalesce(b.publisher, '')) like lower(concat(:publisher, '%'))
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
    Page<Book> search(
        @Param("query") String query,
        @Param("category") String category,
        @Param("author") String author,
        @Param("publisher") String publisher,
        @Param("availableOnly") boolean availableOnly,
        Pageable pageable
    );

    @Query("select distinct b.category from Book b where b.category is not null and b.category <> '' order by b.category")
    List<String> findDistinctCategories();

    Optional<Book> findBySsnNumberIgnoreCase(String ssnNumber);
}
