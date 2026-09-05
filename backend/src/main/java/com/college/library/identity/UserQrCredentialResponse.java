package com.college.library.identity;

import java.util.UUID;

public record UserQrCredentialResponse(
    UUID userId,
    String fullName,
    String qrCredential
) {
}
