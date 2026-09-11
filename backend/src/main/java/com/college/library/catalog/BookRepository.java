package com.college.library.catalog;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BookRepository extends JpaRepository<Book, String> {

    List<Book> findByTitleContainingIgnoreCaseOrAuthorContainingIgnoreCaseOrCategoryContainingIgnoreCaseOrSsnNumberContainingIgnoreCase(
        String title,
        String author,
        String category,
        String ssnNumber
    );
}
