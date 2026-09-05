package com.college.library.circulation;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record ReserveRequest(
    @NotNull UUID bookId,
    @NotNull UUID borrowerId
) {
}
