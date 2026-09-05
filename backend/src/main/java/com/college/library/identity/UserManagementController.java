package com.college.library.identity;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
public class UserManagementController {

    private static final String ACTOR_HEADER = "X-Actor-User-Id";

    private final UserManagementUseCase userManagementUseCase;

    public UserManagementController(UserManagementUseCase userManagementUseCase) {
        this.userManagementUseCase = userManagementUseCase;
    }

    @GetMapping
    ResponseEntity<List<UserSummary>> listUsers() {
        return ResponseEntity.ok(userManagementUseCase.listUsers());
    }

    @GetMapping("/by-identifier")
    ResponseEntity<UserDetailsResponse> getStudentDetailsByIdentifier(
        @RequestHeader(ACTOR_HEADER) UUID actorUserId,
        @RequestParam IdentifierType type,
        @RequestParam String value
    ) {
        return ResponseEntity.ok(userManagementUseCase.getStudentDetailsByIdentifier(type, value, actorUserId));
    }

    @GetMapping("/{userId}")
    ResponseEntity<UserDetailsResponse> getUserDetails(
        @RequestHeader(ACTOR_HEADER) UUID actorUserId,
        @PathVariable UUID userId
    ) {
        return ResponseEntity.ok(userManagementUseCase.getUserDetails(userId, actorUserId));
    }

    @PostMapping("/register/student")
    ResponseEntity<UserSummary> selfRegisterStudent(@Valid @RequestBody UserRegistrationRequest request) {
        return ResponseEntity.ok(userManagementUseCase.selfRegisterStudent(request));
    }

    @PostMapping
    ResponseEntity<UserSummary> registerUser(
        @RequestHeader(ACTOR_HEADER) UUID actorUserId,
        @Valid @RequestBody UserRegistrationRequest request
    ) {
        return ResponseEntity.ok(userManagementUseCase.registerUser(request, actorUserId));
    }

    @DeleteMapping("/students/{studentId}")
    ResponseEntity<Void> removeStudent(
        @RequestHeader(ACTOR_HEADER) UUID actorUserId,
        @PathVariable UUID studentId
    ) {
        userManagementUseCase.removeStudent(studentId, actorUserId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{userId}")
    ResponseEntity<Void> removeUser(
        @RequestHeader(ACTOR_HEADER) UUID actorUserId,
        @PathVariable UUID userId
    ) {
        userManagementUseCase.removeUser(userId, actorUserId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{userId}/qr-credential")
    ResponseEntity<UserQrCredentialResponse> getUserQrCredential(
        @RequestHeader(ACTOR_HEADER) UUID actorUserId,
        @PathVariable UUID userId
    ) {
        return ResponseEntity.ok(userManagementUseCase.getUserQrCredential(userId, actorUserId));
    }
}
