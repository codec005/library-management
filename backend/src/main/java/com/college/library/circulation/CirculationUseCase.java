package com.college.library.circulation;

import java.util.UUID;

public interface CirculationUseCase {

    CirculationResponse issue(IssueRequest request);

    CirculationResponse returnCopy(UUID bookCopyId);

    CirculationResponse renew(UUID transactionId);

    ReservationResponse reserve(ReserveRequest request);
}
