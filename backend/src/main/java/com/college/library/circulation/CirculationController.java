package com.college.library.circulation;

import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/circulation")
public class CirculationController {

    private final CirculationUseCase circulationUseCase;

    public CirculationController(CirculationUseCase circulationUseCase) {
        this.circulationUseCase = circulationUseCase;
    }

    @PostMapping("/issue")
    ResponseEntity<CirculationResponse> issue(@Valid @RequestBody IssueRequest request) {
        return ResponseEntity.ok(circulationUseCase.issue(request));
    }

    @PostMapping("/return/{bookCopyId}")
    ResponseEntity<CirculationResponse> returnCopy(@PathVariable UUID bookCopyId) {
        return ResponseEntity.ok(circulationUseCase.returnCopy(bookCopyId));
    }

    @PostMapping("/renew/{transactionId}")
    ResponseEntity<CirculationResponse> renew(@PathVariable UUID transactionId) {
        return ResponseEntity.ok(circulationUseCase.renew(transactionId));
    }

    @PostMapping("/reserve")
    ResponseEntity<ReservationResponse> reserve(@Valid @RequestBody ReserveRequest request) {
        return ResponseEntity.ok(circulationUseCase.reserve(request));
    }
}
