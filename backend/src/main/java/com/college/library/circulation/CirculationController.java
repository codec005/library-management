package com.college.library.circulation;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/circulation")
public class CirculationController {

    private static final String ACTOR_HEADER = "X-Actor-User-Id";

    private final CirculationUseCase circulationUseCase; // here the logic of checking whether user is admin/librariarian is done because only these users can add books implemented in Circulation service

    public CirculationController(CirculationUseCase circulationUseCase) {
        this.circulationUseCase = circulationUseCase;
    }

    @PostMapping("/issue")
    ResponseEntity<CirculationResponse> issue(
        @RequestHeader(ACTOR_HEADER) UUID actorUserId,
        @Valid @RequestBody IssueRequest request
    ) {
        return ResponseEntity.ok(circulationUseCase.issue(request, actorUserId));
    }

    @PostMapping("/issue/by-identifier")
    ResponseEntity<CirculationResponse> issueByIdentifier(
        @RequestHeader(ACTOR_HEADER) UUID actorUserId,
        @Valid @RequestBody IssueByIdentifierRequest request
    ) {
        return ResponseEntity.ok(circulationUseCase.issueByIdentifier(request, actorUserId));
    }

    @PostMapping("/return/{bookCopyId}")
    ResponseEntity<CirculationResponse> returnCopy(
        @RequestHeader(ACTOR_HEADER) UUID actorUserId,
        @PathVariable UUID bookCopyId,
        @RequestBody(required = false) ReturnBookRequest request
    ) {
        boolean resetFine = request != null && Boolean.TRUE.equals(request.resetFine());
        return ResponseEntity.ok(circulationUseCase.returnCopy(bookCopyId, resetFine, actorUserId));
    }

    @PostMapping("/renew/{transactionId}")
    ResponseEntity<CirculationResponse> renew(
        @RequestHeader(ACTOR_HEADER) UUID actorUserId,
        @PathVariable UUID transactionId
    ) {
        return ResponseEntity.ok(circulationUseCase.renew(transactionId, actorUserId));
    }

    @GetMapping("/users/{borrowerId}/issued")
    ResponseEntity<List<CirculationResponse>> listIssuedBooksForUser(
        @RequestHeader(ACTOR_HEADER) UUID actorUserId,
        @PathVariable UUID borrowerId
    ) {
        return ResponseEntity.ok(circulationUseCase.listIssuedBooksForUser(borrowerId, actorUserId));
    }

    @GetMapping("/copies/{bookCopyId}/history")
    ResponseEntity<BookCopyHistoryResponse> getBookCopyHistory(
        @RequestHeader(ACTOR_HEADER) UUID actorUserId,
        @PathVariable UUID bookCopyId
    ) {
        return ResponseEntity.ok(circulationUseCase.getBookCopyHistory(bookCopyId, actorUserId));
    }
}
