export type IdentifierType = "ROLL_NUMBER" | "COLLEGE_EMAIL" | "PHONE_NUMBER" | "QR_CREDENTIAL" | "RFID_CARD";
export type UserRole = "STUDENT" | "FACULTY" | "LIBRARIAN" | "ADMIN" | "SUPER_ADMIN";
export type ScanType = "QR" | "RFID";
export type BookCopyStatus = "AVAILABLE" | "ISSUED" | "RESERVED" | "DAMAGED" | "LOST" | "UNDER_MAINTENANCE";

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
}

export interface UserRegistrationRequest {
  fullName: string;
  department: string;
  rollNumber: string;
  collegeEmail?: string;
  password: string;
  role: "STUDENT" | "LIBRARIAN";
}

export interface BookCreateRequest {
  title: string;
  author: string;
  isbn?: string;
  publisher?: string;
  category: string;
  shelfLocation: string;
  copyCount: number;
}

export interface BookSummary {
  id: string;
  title: string;
  author: string;
  category: string;
  totalCopies: number;
  availableCopies: number;
}

export interface BookCopyScanResponse {
  copyId: string;
  accessionNumber: string;
  title: string;
  author: string;
  shelfLocation: string;
  status: BookCopyStatus;
}

export interface CirculationResponse {
  transactionId: string;
  borrowerName: string;
  accessionNumber: string;
  bookTitle: string;
  issuedOn: string;
  dueOn: string;
  returnedOn: string | null;
  status: "ISSUED" | "RETURNED" | "OVERDUE" | "LOST";
  fineAmount: number;
}

export interface ReservationResponse {
  reservationId: string;
  borrowerName: string;
  bookTitle: string;
  requestedOn: string;
  expiresOn: string;
  status: "ACTIVE" | "FULFILLED" | "CANCELLED" | "EXPIRED";
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
      headers: {
        "Content-Type": "application/json",
        ...options?.headers
      },
      ...options
    });
  } catch {
    throw new ApiError("Backend is not reachable. Start the Spring Boot server on port 8080.");
  }

  if (!response.ok) {
    throw new ApiError(`Request failed with status ${response.status}`, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function login(identifierType: IdentifierType, identifier: string, password: string) {
  return request<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifierType, identifier, password })
  });
}

export function scanLogin(identifierType: "QR_CREDENTIAL" | "RFID_CARD", identifier: string) {
  return request<LoginResponse>("/api/auth/scan-login", {
    method: "POST",
    body: JSON.stringify({ identifierType, identifier })
  });
}

export function searchBooks(query: string) {
  return request<BookSummary[]>(`/api/catalog/books?query=${encodeURIComponent(query)}`);
}

export function registerStudentAsGuest(payload: UserRegistrationRequest) {
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

export function listUsers() {
  return request<UserSummary[]>("/api/users");
}

export function removeStudent(studentId: string, actorUserId: string) {
  return request<void>(`/api/users/students/${studentId}`, {
    method: "DELETE",
    headers: { "X-Actor-User-Id": actorUserId }
  });
}

export function scanBookCopy(type: ScanType, value: string) {
  return request<BookCopyScanResponse>(`/api/catalog/scan?type=${type}&value=${encodeURIComponent(value)}`);
}

export function issueBookCopy(bookCopyId: string, borrowerId: string) {
  return request<CirculationResponse>("/api/circulation/issue", {
    method: "POST",
    body: JSON.stringify({ bookCopyId, borrowerId })
  });
}

export function returnBookCopy(bookCopyId: string) {
  return request<CirculationResponse>(`/api/circulation/return/${bookCopyId}`, {
    method: "POST"
  });
}

export function renewTransaction(transactionId: string) {
  return request<CirculationResponse>(`/api/circulation/renew/${transactionId}`, {
    method: "POST"
  });
}

export function reserveBook(bookId: string, borrowerId: string) {
  return request<ReservationResponse>("/api/circulation/reserve", {
    method: "POST",
    body: JSON.stringify({ bookId, borrowerId })
  });
}

export function addBook(payload: BookCreateRequest, actorUserId: string) {
  return request<BookSummary>("/api/catalog/books", {
    method: "POST",
    headers: { "X-Actor-User-Id": actorUserId },
    body: JSON.stringify(payload)
  });
}

export function removeBook(bookId: string, actorUserId: string) {
  return request<void>(`/api/catalog/books/${bookId}`, {
    method: "DELETE",
    headers: { "X-Actor-User-Id": actorUserId }
  });
}
