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

    private final CirculationUseCase circulationUseCase;

    public CirculationController(CirculationUseCase circulationUseCase) {
        this.circulationUseCase = circulationUseCase;
    }

    @PostMapping("/issue")
    ResponseEntity<CirculationResponse> issue(@Valid @RequestBody IssueRequest request) {
        return ResponseEntity.ok(circulationUseCase.issue(request));
    }

    @PostMapping("/issue/by-identifier")
    ResponseEntity<CirculationResponse> issueByIdentifier(
        @RequestHeader(ACTOR_HEADER) UUID actorUserId,
        @Valid @RequestBody IssueByIdentifierRequest request
    ) {
        return ResponseEntity.ok(circulationUseCase.issueByIdentifier(request, actorUserId));
    }

    @PostMapping("/return/{bookCopyId}")
    ResponseEntity<CirculationResponse> returnCopy(@PathVariable UUID bookCopyId) {
        return ResponseEntity.ok(circulationUseCase.returnCopy(bookCopyId));
    }

    @PostMapping("/renew/{transactionId}")
    ResponseEntity<CirculationResponse> renew(@PathVariable UUID transactionId) {
        return ResponseEntity.ok(circulationUseCase.renew(transactionId));
    }

    @GetMapping("/users/{borrowerId}/issued")
    ResponseEntity<List<CirculationResponse>> listIssuedBooksForUser(
        @RequestHeader(ACTOR_HEADER) UUID actorUserId,
        @PathVariable UUID borrowerId
    ) {
        return ResponseEntity.ok(circulationUseCase.listIssuedBooksForUser(borrowerId, actorUserId));
    }
}
