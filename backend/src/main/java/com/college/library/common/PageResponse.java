package com.college.library.common;

import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

public record PageResponse<T>(
    List<T> content,
    int page,
    int size,
    long totalElements,
    int totalPages
) {
    public static <T> PageResponse<T> from(Page<T> page) {
        return new PageResponse<>(
            page.getContent(),
            page.getNumber(),
            page.getSize(),
            page.getTotalElements(),
            page.getTotalPages()
        );
    }

    public static Pageable pageable(int page, int size) {
        int safeSize = sanitizeSize(size);
        int safePage = Math.max(page, 0);
        return PageRequest.of(safePage, safeSize);
    }

    public static Pageable pageable(int page, int size, Sort sort) {
        int safeSize = sanitizeSize(size);
        int safePage = Math.max(page, 0);
        return PageRequest.of(safePage, safeSize, sort);
    }

    private static int sanitizeSize(int size) {
        if (size == 4 || size == 20 || size == 50) {
            return size;
        }
        return 10;
    }
}
