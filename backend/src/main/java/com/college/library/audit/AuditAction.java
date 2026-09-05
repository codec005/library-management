package com.college.library.audit;

public enum AuditAction {
    PASSWORD_LOGIN,
    SCAN_LOGIN,
    BOOK_SCAN,
    BOOK_ISSUE,
    BOOK_RETURN,
    BOOK_RENEW,
    USER_REGISTER,
    USER_REMOVE,
    BOOK_ADD,
    BOOK_REMOVE,
    USER_QR_GENERATE
}
