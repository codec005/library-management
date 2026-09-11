package com.college.library.identity;

import com.college.library.common.PageResponse;
import java.util.UUID;

public interface UserManagementUseCase {

    UserSummary selfRegisterStudent(UserRegistrationRequest request);

    UserSummary registerUser(UserRegistrationRequest request, UUID actorUserId);

    UserDetailsResponse updateUser(UUID userId, UserUpdateRequest request, UUID actorUserId);

    void removeStudent(UUID studentId, UUID actorUserId);

    void removeUser(UUID userId, UUID actorUserId);

    UserQrCredentialResponse getUserQrCredential(UUID userId, UUID actorUserId);

    UserDetailsResponse getUserDetails(UUID userId, UUID actorUserId);

    UserDetailsResponse getStudentDetailsByIdentifier(IdentifierType identifierType, String identifier, UUID actorUserId);

    PageResponse<UserSummary> listUsers(UUID actorUserId, String query, int page, int size);
}
