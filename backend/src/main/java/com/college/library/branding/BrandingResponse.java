package com.college.library.branding;

public record BrandingResponse(
    String collegeName,
    String logoUrl
) {
    static BrandingResponse empty() {
        return new BrandingResponse("", "");
    }
}
