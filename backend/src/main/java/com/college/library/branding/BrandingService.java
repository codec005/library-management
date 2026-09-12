package com.college.library.branding;

import com.college.library.identity.UserAccount;
import com.college.library.identity.UserAccountRepository;
import com.college.library.identity.UserRole;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;

@Service
public class BrandingService {

    private static final int MAX_LOGO_BYTES = 2_500_000;
    private static final String META_FILE = "branding.json";
    private static final String LOGO_FILE = "logo";

    private final UserAccountRepository userAccountRepository;
    private final ObjectMapper objectMapper;
    private final Path storageDir;

    public BrandingService(
        UserAccountRepository userAccountRepository,
        ObjectMapper objectMapper,
        @Value("${app.branding.storage-dir:./data/branding}") String storageDir
    ) {
        this.userAccountRepository = userAccountRepository;
        this.objectMapper = objectMapper;
        this.storageDir = Path.of(storageDir).toAbsolutePath().normalize();
    }

    public BrandingResponse getBranding() {
        ensureStorageDir();
        String collegeName = readCollegeName();
        String logoUrl = findLogoPath()
            .map(path -> {
                try {
                    return "/api/branding/logo?v=" + Files.getLastModifiedTime(path).toMillis();
                } catch (IOException exception) {
                    return "/api/branding/logo";
                }
            })
            .orElse("");
        return new BrandingResponse(collegeName, logoUrl);
    }

    public BrandingResponse updateBranding(BrandingUpdateRequest request, UUID actorUserId) {
        UserAccount actor = findActor(actorUserId);
        if (!hasAnyRole(actor, UserRole.ADMIN, UserRole.SUPER_ADMIN)) {
            throw new IllegalStateException("Only admin can update college branding");
        }

        ensureStorageDir();

        String collegeName = request.collegeName() == null ? "" : request.collegeName().trim();
        if (collegeName.length() > 200) {
            throw new IllegalArgumentException("College name must be 200 characters or fewer");
        }

        writeCollegeName(collegeName);

        String logoDataUrl = request.logoDataUrl() == null ? "" : request.logoDataUrl().trim();
        if (!logoDataUrl.isEmpty()) {
            writeLogoFromDataUrl(logoDataUrl);
        }

        return getBranding();
    }

    public Optional<Resource> getLogoResource() {
        return findLogoPath().map(FileSystemResource::new);
    }

    public MediaType getLogoMediaType() {
        return findLogoPath()
            .map(path -> {
                String name = path.getFileName().toString().toLowerCase();
                if (name.endsWith(".png")) {
                    return MediaType.IMAGE_PNG;
                }
                if (name.endsWith(".jpg") || name.endsWith(".jpeg")) {
                    return MediaType.IMAGE_JPEG;
                }
                if (name.endsWith(".gif")) {
                    return MediaType.IMAGE_GIF;
                }
                if (name.endsWith(".webp")) {
                    return MediaType.parseMediaType("image/webp");
                }
                return MediaType.APPLICATION_OCTET_STREAM;
            })
            .orElse(MediaType.APPLICATION_OCTET_STREAM);
    }

    private void writeLogoFromDataUrl(String logoDataUrl) {
        if (!logoDataUrl.startsWith("data:image/")) {
            throw new IllegalArgumentException("Logo must be an image data URL");
        }

        int commaIndex = logoDataUrl.indexOf(',');
        if (commaIndex < 0) {
            throw new IllegalArgumentException("Logo data URL is invalid");
        }

        String header = logoDataUrl.substring(5, commaIndex); // image/png;base64
        String payload = logoDataUrl.substring(commaIndex + 1);
        String mimeType = header.split(";")[0].trim().toLowerCase();
        String extension = switch (mimeType) {
            case "image/png" -> "png";
            case "image/jpeg", "image/jpg" -> "jpg";
            case "image/gif" -> "gif";
            case "image/webp" -> "webp";
            default -> throw new IllegalArgumentException("Unsupported logo image type: " + mimeType);
        };

        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(payload);
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Logo data URL is invalid");
        }

        if (bytes.length == 0) {
            throw new IllegalArgumentException("Logo image is empty");
        }
        if (bytes.length > MAX_LOGO_BYTES) {
            throw new IllegalArgumentException("Logo image is too large. Use a smaller image.");
        }

        try {
            deleteExistingLogos();
            Files.write(storageDir.resolve(LOGO_FILE + "." + extension), bytes);
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to save college logo to server storage");
        }
    }

    private void writeCollegeName(String collegeName) {
        try {
            objectMapper.writerWithDefaultPrettyPrinter()
                .writeValue(storageDir.resolve(META_FILE).toFile(), Map.of("collegeName", collegeName));
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to save college name to server storage");
        }
    }

    private String readCollegeName() {
        Path metaPath = storageDir.resolve(META_FILE);
        if (!Files.exists(metaPath)) {
            return "";
        }

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> meta = objectMapper.readValue(metaPath.toFile(), Map.class);
            Object value = meta.get("collegeName");
            return value == null ? "" : String.valueOf(value).trim();
        } catch (IOException exception) {
            return "";
        }
    }

    private Optional<Path> findLogoPath() {
        if (!Files.isDirectory(storageDir)) {
            return Optional.empty();
        }

        try (var paths = Files.list(storageDir)) {
            return paths
                .filter(path -> {
                    String name = path.getFileName().toString().toLowerCase();
                    return name.startsWith(LOGO_FILE + ".")
                        && (name.endsWith(".png")
                        || name.endsWith(".jpg")
                        || name.endsWith(".jpeg")
                        || name.endsWith(".gif")
                        || name.endsWith(".webp"));
                })
                .findFirst();
        } catch (IOException exception) {
            return Optional.empty();
        }
    }

    private void deleteExistingLogos() throws IOException {
        try (var paths = Files.list(storageDir)) {
            for (Path path : paths.toList()) {
                String name = path.getFileName().toString().toLowerCase();
                if (name.startsWith(LOGO_FILE + ".")) {
                    Files.deleteIfExists(path);
                }
            }
        }
    }

    private void ensureStorageDir() {
        try {
            Files.createDirectories(storageDir);
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to create branding storage directory");
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
