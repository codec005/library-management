package com.college.library.circulation;

import java.util.List;
import java.util.UUID;

public interface CirculationUseCase {

    CirculationResponse issue(IssueRequest request, UUID actorUserId);

    CirculationResponse issueByIdentifier(IssueByIdentifierRequest request, UUID actorUserId);

    CirculationResponse returnCopy(UUID bookCopyId, boolean resetFine, UUID actorUserId);

    CirculationResponse returnByIdentifier(ReturnByIdentifierRequest request, UUID actorUserId);

    CirculationResponse renew(UUID transactionId, Integer renewalDays, UUID actorUserId);

    List<CirculationResponse> listIssuedBooksForUser(UUID borrowerId, UUID actorUserId);

    BookCopyHistoryResponse getBookCopyHistory(UUID bookCopyId, UUID actorUserId);
}
