package com.college.library.settings;

import com.college.library.identity.UserAccount;
import com.college.library.identity.UserAccountRepository;
import com.college.library.identity.UserRole;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class AppSettingsService {

    private static final String SETTINGS_FILE = "settings.json";

    private final UserAccountRepository userAccountRepository;
    private final ObjectMapper objectMapper;
    private final Path storageDir;

    public AppSettingsService(
        UserAccountRepository userAccountRepository,
        ObjectMapper objectMapper,
        @Value("${app.settings.storage-dir:./data/settings}") String storageDir
    ) {
        this.userAccountRepository = userAccountRepository;
        this.objectMapper = objectMapper;
        this.storageDir = Path.of(storageDir).toAbsolutePath().normalize();
    }

    public AppSettingsResponse getSettings() {
        ensureStorageDir();
        return new AppSettingsResponse(readStudentPasswordRequired());
    }

    public boolean isStudentPasswordRequired() {
        return getSettings().studentPasswordRequired();
    }

    public AppSettingsResponse updateSettings(AppSettingsUpdateRequest request, UUID actorUserId) {
        UserAccount actor = findActor(actorUserId);
        if (!hasAnyRole(actor, UserRole.ADMIN, UserRole.SUPER_ADMIN)) {
            throw new IllegalStateException("Only admin can update portal settings");
        }

        ensureStorageDir();
        writeSettings(request.studentPasswordRequired());
        return getSettings();
    }

    private boolean readStudentPasswordRequired() {
        Path settingsPath = storageDir.resolve(SETTINGS_FILE);
        if (!Files.exists(settingsPath)) {
            return false;
        }

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> settings = objectMapper.readValue(settingsPath.toFile(), Map.class);
            Object value = settings.get("studentPasswordRequired");
            if (value instanceof Boolean booleanValue) {
                return booleanValue;
            }
            return Boolean.parseBoolean(String.valueOf(value));
        } catch (IOException exception) {
            return false;
        }
    }

    private void writeSettings(boolean studentPasswordRequired) {
        try {
            Map<String, Object> settings = new LinkedHashMap<>();
            settings.put("studentPasswordRequired", studentPasswordRequired);
            objectMapper.writerWithDefaultPrettyPrinter()
                .writeValue(storageDir.resolve(SETTINGS_FILE).toFile(), settings);
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to save portal settings");
        }
    }

    private void ensureStorageDir() {
        try {
            Files.createDirectories(storageDir);
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to create settings storage directory");
        }
    }

    private UserAccount findActor(UUID actorUserId) {
        if (actorUserId == null) {
            throw new IllegalStateException("Actor user is required");
        }

        return userAccountRepository.findById(actorUserId)
            .filter(UserAccount::isActive)
            .orElseThrow(() -> new IllegalArgumentException("Actor user not found"));
    }

    private boolean hasAnyRole(UserAccount user, UserRole... allowedRoles) {
        return Set.of(allowedRoles).stream().anyMatch(user.getRoles()::contains);
    }
}
