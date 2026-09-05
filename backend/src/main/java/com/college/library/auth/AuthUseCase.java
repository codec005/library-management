package com.college.library.auth;

public interface AuthUseCase {

    LoginResponse login(LoginRequest request);

    LoginResponse scanLogin(ScanLoginRequest request);
}
