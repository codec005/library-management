package com.college.library.branding;

import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/branding")
public class BrandingController {

    private static final String ACTOR_HEADER = "X-Actor-User-Id";

    private final BrandingService brandingService;

    public BrandingController(BrandingService brandingService) {
        this.brandingService = brandingService;
    }

    @GetMapping
    ResponseEntity<BrandingResponse> getBranding() {
        return ResponseEntity.ok(brandingService.getBranding());
    }

    @GetMapping("/logo")
    ResponseEntity<Resource> getLogo() {
        return brandingService.getLogoResource()
            .map(resource -> ResponseEntity.ok()
                .cacheControl(CacheControl.noCache())
                .contentType(brandingService.getLogoMediaType())
                .body(resource))
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PutMapping
    ResponseEntity<BrandingResponse> updateBranding(
        @RequestHeader(ACTOR_HEADER) UUID actorUserId,
        @RequestBody BrandingUpdateRequest request
    ) {
        return ResponseEntity.ok(brandingService.updateBranding(request, actorUserId));
    }
}
