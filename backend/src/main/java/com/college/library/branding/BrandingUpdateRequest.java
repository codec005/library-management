package com.college.library.branding;

public record BrandingUpdateRequest(
    String collegeName,
    String logoDataUrl
) {
}
