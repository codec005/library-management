package com.college.library.catalog;

import com.college.library.common.PageResponse;
import java.util.List;
import java.util.UUID;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/catalog")
public class CatalogController {

    private static final String ACTOR_HEADER = "X-Actor-User-Id";

    private final CatalogService catalogService;

    public CatalogController(CatalogService catalogService) {
        this.catalogService = catalogService;
    }

    @GetMapping("/books")
    ResponseEntity<PageResponse<BookSummary>> searchBooks(
        @RequestParam(defaultValue = "") String query,
        @RequestParam(defaultValue = "") String category,
        @RequestParam(defaultValue = "") String author,
        @RequestParam(defaultValue = "") String publisher,
        @RequestParam(defaultValue = "false") boolean availableOnly,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "10") int size
    ) {
        return ResponseEntity.ok(
            catalogService.searchBooks(query, category, author, publisher, availableOnly, page, size)
        );
    }

    @GetMapping("/categories")
    ResponseEntity<List<String>> listCategories() {
        return ResponseEntity.ok(catalogService.listCategories());
    }

    @GetMapping("/scan")
    ResponseEntity<BookCopyScanResponse> scanCopy(
        @RequestHeader(value = ACTOR_HEADER, required = false) UUID actorUserId,
        @RequestParam ScanType type,
        @RequestParam String value
    ) {
        return catalogService.scanCopy(type, value, actorUserId)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/books")
    ResponseEntity<BookSummary> addBook(
        @RequestHeader(ACTOR_HEADER) UUID actorUserId,
        @Valid @RequestBody BookCreateRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(catalogService.addBook(request, actorUserId));
    }

    @PutMapping("/books/{ssnNumber}")
    ResponseEntity<BookSummary> updateBook(
        @RequestHeader(ACTOR_HEADER) UUID actorUserId,
        @PathVariable String ssnNumber,
        @Valid @RequestBody BookUpdateRequest request
    ) {
        return ResponseEntity.ok(catalogService.updateBook(ssnNumber, request, actorUserId));
    }

    @DeleteMapping("/books/{ssnNumber}")
    ResponseEntity<Void> removeBook(
        @RequestHeader(ACTOR_HEADER) UUID actorUserId,
        @PathVariable String ssnNumber
    ) {
        catalogService.removeBook(ssnNumber, actorUserId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/books/{ssnNumber}/copies")
    ResponseEntity<List<BookCopySummary>> listBookCopies(
        @RequestHeader(ACTOR_HEADER) UUID actorUserId,
        @PathVariable String ssnNumber
    ) {
        return ResponseEntity.ok(catalogService.listBookCopies(ssnNumber, actorUserId));
    }

    @GetMapping("/copies/by-qr")
    ResponseEntity<BookCopySummary> getBookCopyByQrCode(
        @RequestHeader(ACTOR_HEADER) UUID actorUserId,
        @RequestParam String value
    ) {
        return ResponseEntity.ok(catalogService.getBookCopyByQrCode(value, actorUserId));
    }

    @DeleteMapping("/copies/by-qr")
    ResponseEntity<Void> removeBookCopyByQrCode(
        @RequestHeader(ACTOR_HEADER) UUID actorUserId,
        @RequestParam String value
    ) {
        catalogService.removeBookCopyByQrCode(value, actorUserId);
        return ResponseEntity.noContent().build();
    }
}
