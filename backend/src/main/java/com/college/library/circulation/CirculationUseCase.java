package com.college.library.circulation;

import com.college.library.common.PageResponse;
import java.util.List;
import java.util.UUID;

public interface CirculationUseCase {

    CirculationResponse issue(IssueRequest request, UUID actorUserId);

    CirculationResponse issueByIdentifier(IssueByIdentifierRequest request, UUID actorUserId);

    CirculationResponse returnCopy(UUID bookCopyId, boolean resetFine, UUID actorUserId);

    CirculationResponse returnByIdentifier(ReturnByIdentifierRequest request, UUID actorUserId);

    CirculationResponse renew(UUID transactionId, Integer renewalDays, UUID actorUserId);

    CirculationResponse renewByIdentifier(RenewByIdentifierRequest request, UUID actorUserId);

    PageResponse<CirculationResponse> listAllIssuedBooks(UUID actorUserId, int page, int size);

    List<CirculationResponse> listIssuedBooksForUser(UUID borrowerId, UUID actorUserId);

    BookCopyHistoryResponse getBookCopyHistory(UUID bookCopyId, UUID actorUserId);
}
