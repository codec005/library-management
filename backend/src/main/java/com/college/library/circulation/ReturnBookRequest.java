package com.college.library.circulation;

public record ReturnBookRequest(
    Boolean resetFine
) {
}
