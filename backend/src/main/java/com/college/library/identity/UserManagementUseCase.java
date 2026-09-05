package com.college.library.identity;

import java.util.List;
import java.util.UUID;

public interface UserManagementUseCase {

    UserSummary selfRegisterStudent(UserRegistrationRequest request);

    UserSummary registerUser(UserRegistrationRequest request, UUID actorUserId);

    void removeStudent(UUID studentId, UUID actorUserId);

    void removeUser(UUID userId, UUID actorUserId);

    UserQrCredentialResponse getUserQrCredential(UUID userId, UUID actorUserId);

    UserDetailsResponse getUserDetails(UUID userId, UUID actorUserId);

    List<UserSummary> listUsers();
}
