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

    @Query(
        value = """
            select
              min(b.title) as title,
              min(b.author) as author,
              min(b.publisher) as publisher,
              min(b.category) as category,
              count(distinct b.ssn_number) as edition_count,
              coalesce(sum(case when c.status is not null and c.status <> 'REMOVED' then 1 else 0 end), 0) as total_copies,
              coalesce(sum(case when c.status = 'AVAILABLE' then 1 else 0 end), 0) as available_copies
            from books b
            left join book_copies c on c.book_id = b.ssn_number
            where (
              :query = ''
              or lower(b.ssn_number) = lower(:query)
              or lower(b.title) like lower(concat(:query, '%'))
              or lower(b.author) like lower(concat(:query, '%'))
              or lower(b.category) like lower(concat(:query, '%'))
              or lower(b.ssn_number) like lower(concat(:query, '%'))
            )
            and (:category = '' or lower(b.category) = lower(:category))
            and (:author = '' or lower(b.author) like lower(concat(:author, '%')))
            and (
              :publisher = ''
              or lower(coalesce(b.publisher, '')) like lower(concat(:publisher, '%'))
            )
            group by lower(trim(b.title))
            having (
              :availableOnly = false
              or coalesce(sum(case when c.status = 'AVAILABLE' then 1 else 0 end), 0) > 0
            )
            order by min(b.title) asc
            """,
        countQuery = """
            select count(*) from (
              select 1
              from books b
              left join book_copies c on c.book_id = b.ssn_number
              where (
                :query = ''
                or lower(b.ssn_number) = lower(:query)
                or lower(b.title) like lower(concat(:query, '%'))
                or lower(b.author) like lower(concat(:query, '%'))
                or lower(b.category) like lower(concat(:query, '%'))
                or lower(b.ssn_number) like lower(concat(:query, '%'))
              )
              and (:category = '' or lower(b.category) = lower(:category))
              and (:author = '' or lower(b.author) like lower(concat(:author, '%')))
              and (
                :publisher = ''
                or lower(coalesce(b.publisher, '')) like lower(concat(:publisher, '%'))
              )
              group by lower(trim(b.title))
              having (
                :availableOnly = false
                or coalesce(sum(case when c.status = 'AVAILABLE' then 1 else 0 end), 0) > 0
              )
            ) grouped_titles
            """,
        nativeQuery = true
    )
    Page<Object[]> searchTitleGroups(
        @Param("query") String query,
        @Param("category") String category,
        @Param("author") String author,
        @Param("publisher") String publisher,
        @Param("availableOnly") boolean availableOnly,
        Pageable pageable
    );

    @Query(
        """
            select distinct b from Book b
            left join fetch b.copies
            where lower(trim(b.title)) = lower(trim(:title))
            order by b.ssnNumber asc
            """
    )
    List<Book> findEditionsByTitle(@Param("title") String title);
}
