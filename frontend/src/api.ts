export type IdentifierType = "ROLL_NUMBER" | "COLLEGE_EMAIL" | "PHONE_NUMBER" | "QR_CREDENTIAL" | "RFID_CARD";
export type UserRole = "STUDENT" | "FACULTY" | "LIBRARIAN" | "ADMIN" | "SUPER_ADMIN";
export type ScanType = "QR" | "RFID" | "SSN";
export type BookCopyStatus = "AVAILABLE" | "ISSUED" | "RESERVED" | "DAMAGED" | "LOST" | "UNDER_MAINTENANCE" | "REMOVED";

export interface LoginResponse {
  userId: string;
  fullName: string;
  roles: UserRole[];
  accessToken: string;
}

export interface UserSummary {
  id: string;
  fullName: string;
  department: string;
  roles: UserRole[];
  active: boolean;
  rollNumber?: string | null;
}

export interface UserIdentifierSummary {
  type: IdentifierType;
  value: string;
  verified: boolean;
}

export interface UserDetailsResponse extends UserSummary {
  identifiers: UserIdentifierSummary[];
}

export interface UserRegistrationRequest {
  fullName: string;
  department: string;
  rollNumber: string;
  collegeEmail?: string;
  password?: string;
  role: "STUDENT" | "FACULTY" | "LIBRARIAN" | "ADMIN";
}

export interface UserUpdateRequest {
  fullName: string;
  department: string;
  rollNumber: string;
  collegeEmail?: string;
  password?: string;
  role: "STUDENT" | "FACULTY" | "LIBRARIAN" | "ADMIN";
}

export interface UserQrCredentialResponse {
  userId: string;
  fullName: string;
  qrCredential: string;
}

export interface BookCreateRequest {
  ssnNumber: string;
  title: string;
  author: string;
  publisher?: string;
  category: string;
  shelfLocation: string;
  finePerDay: number;
  loanPeriodDays: number;
  copyCount: number;
}

export interface BookUpdateRequest {
  title: string;
  author: string;
  publisher?: string;
  category: string;
  finePerDay: number;
  loanPeriodDays: number;
}

export interface BookSummary {
  ssnNumber: string;
  title: string;
  author: string;
  publisher?: string | null;
  category: string;
  finePerDay: number;
  loanPeriodDays: number;
  totalCopies: number;
  availableCopies: number;
}

export interface BookCopyScanResponse {
  copyId: string;
  ssnNumber: string;
  accessionNumber: string;
  title: string;
  author: string;
  shelfLocation: string;
  status: BookCopyStatus;
  loanPeriodDays: number;
}

export interface BookCopySummary {
  copyId: string;
  ssnNumber: string;
  title: string;
  accessionNumber: string;
  qrCodeValue: string;
  shelfLocation: string;
  status: BookCopyStatus;
}

export interface CirculationResponse {
  transactionId: string;
  bookCopyId: string;
  borrowerName: string;
  borrowerCode?: string | null;
  accessionNumber: string;
  bookTitle: string;
  issuedOn: string;
  issuedAt?: string | null;
  dueOn: string;
  returnedOn: string | null;
  returnedAt?: string | null;
  status: "ISSUED" | "RETURNED" | "OVERDUE" | "LOST";
  loanDays: number;
  loanPeriodDays: number;
  overdueDays: number;
  finePerDay: number;
  fineAmount: number;
}

export interface BookCopyHistoryResponse {
  copyId: string;
  ssnNumber: string;
  accessionNumber: string;
  title: string;
  author: string;
  shelfLocation: string;
  status: BookCopyStatus;
  loans: CirculationResponse[];
}

export interface AuditEventResponse {
  id: string;
  action: string;
  actionLabel: string;
  summary: string;
  doneBy: string;
  createdAt: string;
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers
      }
    });
  } catch {
    throw new ApiError("Backend is not reachable. Start the Spring Boot server on port 8080.");
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const problem = await response.json() as { detail?: string; title?: string };
      message = problem.detail ?? problem.title ?? message;
    } catch {
      // Keep the status-based fallback when the backend returns no JSON body.
    }

    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function login(identifierType: IdentifierType, identifier: string, password: string) {
  return request<LoginResponse>("/api/auth/login", { // /api/auth/login tells which backend class and its function is to be called
    method: "POST",
    body: JSON.stringify({ identifierType, identifier, password }) // body tells the details of what usernme password has the user entered in website
  });
}

export function scanLogin(identifierType: "QR_CREDENTIAL" | "RFID_CARD", identifier: string) {
  return request<LoginResponse>("/api/auth/rfid-login", {
    method: "POST",
    body: JSON.stringify({ identifierType, identifier })
  });
}

export function searchBooks(query: string) {
  return request<BookSummary[]>(`/api/catalog/books?query=${encodeURIComponent(query)}`);
}

export function registerStudentAsGuest(payload: UserRegistrationRequest) { // curreentky disabled
  return request<UserSummary>("/api/users/register/student", {
    method: "POST",
    body: JSON.stringify({ ...payload, role: "STUDENT" })
  });
}

export function registerUser(payload: UserRegistrationRequest, actorUserId: string) {
  return request<UserSummary>("/api/users", {
    method: "POST",
    headers: { "X-Actor-User-Id": actorUserId },
    body: JSON.stringify(payload)
  });
}

export function updateUser(userId: string, payload: UserUpdateRequest, actorUserId: string) {
  return request<UserDetailsResponse>(`/api/users/${userId}`, {
    method: "PUT",
    headers: { "X-Actor-User-Id": actorUserId },
    body: JSON.stringify(payload)
  });
}

export function listUsers() {
  return request<UserSummary[]>("/api/users");
}

export function removeStudent(studentId: string, actorUserId: string) {
  return request<void>(`/api/users/students/${studentId}`, {
    method: "DELETE",
    headers: { "X-Actor-User-Id": actorUserId }
  });
}

export function removeUser(userId: string, actorUserId: string) {
  return request<void>(`/api/users/${userId}`, {
    method: "DELETE",
    headers: { "X-Actor-User-Id": actorUserId }
  });
}

export function getUserQrCredential(userId: string, actorUserId: string) {
  return request<UserQrCredentialResponse>(`/api/users/${userId}/qr-credential`, {
    headers: { "X-Actor-User-Id": actorUserId }
  });
}

export function getUserDetails(userId: string, actorUserId: string) {
  return request<UserDetailsResponse>(`/api/users/${userId}`, {
    headers: { "X-Actor-User-Id": actorUserId }
  });
}

export function getStudentDetailsByIdentifier(identifierType: IdentifierType, identifier: string, actorUserId: string) {
  const params = new URLSearchParams({ type: identifierType, value: identifier });
  return request<UserDetailsResponse>(`/api/users/by-identifier?${params.toString()}`, {
    headers: { "X-Actor-User-Id": actorUserId }
  });
}

export function scanBookCopy(type: ScanType, value: string, actorUserId?: string) {
  return request<BookCopyScanResponse>(`/api/catalog/scan?type=${type}&value=${encodeURIComponent(value)}`, {
    headers: actorUserId ? { "X-Actor-User-Id": actorUserId } : undefined
  });
}

export function issueBookCopy(
  bookCopyId: string,
  borrowerId: string,
  actorUserId: string,
  loanDays?: number
) {
  return request<CirculationResponse>("/api/circulation/issue", {
    method: "POST",
    headers: { "X-Actor-User-Id": actorUserId },
    body: JSON.stringify({ bookCopyId, borrowerId, loanDays })
  });
}

export function issueBookByIdentifier(
  actorUserId: string,
  borrowerIdentifierType: IdentifierType,
  borrowerIdentifier: string,
  bookScanType: ScanType,
  bookScanValue: string,
  loanDays?: number
) {
  return request<CirculationResponse>("/api/circulation/issue/by-identifier", {
    method: "POST",
    headers: { "X-Actor-User-Id": actorUserId },
    body: JSON.stringify({
      borrowerIdentifierType,
      borrowerIdentifier,
      bookScanType,
      bookScanValue,
      loanDays
    })
  });
}

export function returnBookCopy(bookCopyId: string, actorUserId: string, resetFine = false) {
  return request<CirculationResponse>(`/api/circulation/return/${bookCopyId}`, {
    method: "POST",
    headers: { "X-Actor-User-Id": actorUserId },
    body: JSON.stringify({ resetFine })
  });
}

export function renewTransaction(transactionId: string, actorUserId: string, renewalDays?: number) {
  return request<CirculationResponse>(`/api/circulation/renew/${transactionId}`, {
    method: "POST",
    headers: { "X-Actor-User-Id": actorUserId },
    body: JSON.stringify({ renewalDays })
  });
}

export function listIssuedBooksForUser(borrowerId: string, actorUserId: string) {
  return request<CirculationResponse[]>(`/api/circulation/users/${borrowerId}/issued`, {
    headers: { "X-Actor-User-Id": actorUserId }
  });
}

export function getBookCopyHistory(bookCopyId: string, actorUserId: string) {
  return request<BookCopyHistoryResponse>(`/api/circulation/copies/${bookCopyId}/history`, {
    headers: { "X-Actor-User-Id": actorUserId }
  });
}

export function addBook(payload: BookCreateRequest, actorUserId: string) {
  return request<BookSummary>("/api/catalog/books", {
    method: "POST",
    headers: { "X-Actor-User-Id": actorUserId },
    body: JSON.stringify(payload)
  });
}

export function updateBook(ssnNumber: string, payload: BookUpdateRequest, actorUserId: string) {
  return request<BookSummary>(`/api/catalog/books/${encodeURIComponent(ssnNumber)}`, {
    method: "PUT",
    headers: { "X-Actor-User-Id": actorUserId },
    body: JSON.stringify(payload)
  });
}

export function removeBook(ssnNumber: string, actorUserId: string) {
  return request<void>(`/api/catalog/books/${encodeURIComponent(ssnNumber)}`, {
    method: "DELETE",
    headers: { "X-Actor-User-Id": actorUserId }
  });
}

export function listBookCopies(ssnNumber: string, actorUserId: string) {
  return request<BookCopySummary[]>(`/api/catalog/books/${encodeURIComponent(ssnNumber)}/copies`, {
    headers: { "X-Actor-User-Id": actorUserId }
  });
}

export function getBookCopyByQrCode(qrCodeValue: string, actorUserId: string) {
  return request<BookCopySummary>(`/api/catalog/copies/by-qr?value=${encodeURIComponent(qrCodeValue)}`, {
    headers: { "X-Actor-User-Id": actorUserId }
  });
}

export function removeBookCopyByQrCode(qrCodeValue: string, actorUserId: string) {
  return request<void>(`/api/catalog/copies/by-qr?value=${encodeURIComponent(qrCodeValue)}`, {
    method: "DELETE",
    headers: { "X-Actor-User-Id": actorUserId }
  });
}

export function listAuditEvents(
  actorUserId: string,
  fromDate?: string,
  toDate?: string,
  action?: string
) {
  const params = new URLSearchParams();
  if (fromDate) {
    params.set("from", fromDate);
  }
  if (toDate) {
    params.set("to", toDate);
  }
  if (action) {
    params.set("action", action);
  }
  const query = params.toString();
  return request<AuditEventResponse[]>(`/api/audit/events${query ? `?${query}` : ""}`, {
    headers: { "X-Actor-User-Id": actorUserId }
  });
}
