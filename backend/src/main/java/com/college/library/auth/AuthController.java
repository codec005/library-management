package com.college.library.auth;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthUseCase authUseCase;

    public AuthController(AuthUseCase authUseCase) {
        this.authUseCase = authUseCase;
    } //AuthUseCase is implemented in AuthService

    @PostMapping("/login")
    ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) { //backend gets input from frontend
        return ResponseEntity.ok(authUseCase.login(request)); // when user enters /api/auth then control goes to AuthController class and when user further enters /api/auth/login control comes to this login function
    }

    @PostMapping("/scan-login")
    ResponseEntity<LoginResponse> scanLogin(@Valid @RequestBody ScanLoginRequest request) {
        return ResponseEntity.ok(authUseCase.scanLogin(request)); // when user enters /api/auth then control goes to AuthController class and when user further enters /api/auth/scan-login control comes to this scanLogin function
    }
}
