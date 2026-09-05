package com.college.library.circulation;

import java.util.List;
import java.util.UUID;

public interface CirculationUseCase {

    CirculationResponse issue(IssueRequest request);

    CirculationResponse issueByIdentifier(IssueByIdentifierRequest request, UUID actorUserId);

    CirculationResponse returnCopy(UUID bookCopyId);

    CirculationResponse renew(UUID transactionId);

    List<CirculationResponse> listIssuedBooksForUser(UUID borrowerId, UUID actorUserId);
}
