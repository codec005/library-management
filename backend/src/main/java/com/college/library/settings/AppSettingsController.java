package com.college.library.settings;

import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/settings")
public class AppSettingsController {

    private static final String ACTOR_HEADER = "X-Actor-User-Id";

    private final AppSettingsService appSettingsService;

    public AppSettingsController(AppSettingsService appSettingsService) {
        this.appSettingsService = appSettingsService;
    }

    @GetMapping
    ResponseEntity<AppSettingsResponse> getSettings() {
        return ResponseEntity.ok(appSettingsService.getSettings());
    }

    @PutMapping
    ResponseEntity<AppSettingsResponse> updateSettings(
        @RequestHeader(ACTOR_HEADER) UUID actorUserId,
        @Valid @RequestBody AppSettingsUpdateRequest request
    ) {
        return ResponseEntity.ok(appSettingsService.updateSettings(request, actorUserId));
    }
}
