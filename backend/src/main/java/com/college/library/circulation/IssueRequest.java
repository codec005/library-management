package com.college.library.circulation;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record IssueRequest(
    @NotNull UUID bookCopyId,
    @NotNull UUID borrowerId
) {
}
