import { useEffect, useMemo, useState } from "react";
import { BookOpen, Library, QrCode, Search, Users } from "lucide-react";
import QRCode from "qrcode";
import QrScanner from "./QrScanner";
import {
  AuditEventResponse,
  BookCopyHistoryResponse,
  BookCopyScanResponse,
  BookCopySummary,
  BookCreateRequest,
  GroupedBookSummary,
  CirculationResponse,
  IdentifierType,
  LoginResponse,
  ScanType,
  UserDetailsResponse,
  UserRegistrationRequest,
  UserSummary,
  UserUpdateRequest,
  addBook,
  updateBook,
  getBookCopyHistory,
  getStudentDetailsByIdentifier,
  getUserQrCredential,
  getUserDetails,
  issueBookByIdentifier,
  issueBookCopy,
  listAuditEvents,
  listBookCategories,
  listBookCopies,
  listIssuedBooksForUser,
  listAllIssuedBooks,
  listUsers,
  login,
  renewTransaction,
  renewBookByIdentifier,
  registerUser,
  getBookCopyByQrCode,
  getBookCopyBySsn,
  removeBook,
  removeBookCopyByQrCode,
  removeUser,
  returnBookByIdentifier,
  returnBookCopy,
  scanBookCopy,
  scanLogin,
  searchBooks,
  searchGroupedBooks,
  listCopiesByTitle,
  updateBookCopyBySsn,
  updateUser
} from "./api";

const SESSION_TIMEOUT_MS = 15 * 60 * 1000;
const COPYRIGHT_YEAR = new Date().getFullYear();

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

type GroupedCatalogBook = {
  title: string;
  author: string;
  publisher: string;
  category: string;
  availableCopies: number;
  totalCopies: number;
  editionCount: number;
  copies: BookCopySummary[];
};

function PaginationControls({
  page,
  totalPages,
  totalElements,
  pageSize,
  onPageChange,
  onPageSizeChange,
  label = "records"
}: {
  page: number;
  totalPages: number;
  totalElements: number;
  pageSize: PageSize;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
  label?: string;
}) {
  const safeTotalPages = Math.max(totalPages, 1);

  return (
    <div className="pagination-bar">
      <label className="pagination-size">
        Per page
        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value) as PageSize)}
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      <span className="pagination-meta">
        {totalElements === 0
          ? `0 ${label}`
          : `Page ${page + 1} of ${safeTotalPages} · ${totalElements} ${label}`}
      </span>
      <div className="pagination-actions">
        <button type="button" className="secondary-button" disabled={page <= 0} onClick={() => onPageChange(page - 1)}>
          Previous
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={page + 1 >= safeTotalPages || totalElements === 0}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

const AUDIT_ACTION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "All types" },
  { value: "PASSWORD_LOGIN", label: "Password login" },
  { value: "SCAN_LOGIN", label: "Scan login" },
  { value: "USER_REGISTER", label: "User registered" },
  { value: "USER_REMOVE", label: "User deleted" },
  { value: "USER_UPDATE", label: "User updated" },
  { value: "USER_QR_GENERATE", label: "User QR generated" },
  { value: "BOOK_ADD", label: "Book added" },
  { value: "BOOK_UPDATE", label: "Book updated" },
  { value: "BOOK_REMOVE", label: "Book removed" },
  { value: "BOOK_SCAN", label: "Book scan" },
  { value: "BOOK_ISSUE", label: "Book issued" },
  { value: "BOOK_RETURN", label: "Book returned" },
  { value: "BOOK_RENEW", label: "Book renewed" }
];

export default function App() {
  const [identifierType, setIdentifierType] = useState<IdentifierType>("ROLL_NUMBER");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [userScanValue, setUserScanValue] = useState("");
  const [currentUser, setCurrentUser] = useState<LoginResponse | null>(null);
  const [sessionRemainingSeconds, setSessionRemainingSeconds] = useState<number | null>(null);
  const [logoUrl, setLogoUrl] = useState(() => localStorage.getItem("collegeLogoUrl") ?? "");
  const [collegeName, setCollegeName] = useState(() => localStorage.getItem("collegeName") ?? "");
  const [bookCategories, setBookCategories] = useState<string[]>([]);
  const [isCatalogWindowOpen, setIsCatalogWindowOpen] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogCategory, setCatalogCategory] = useState("");
  const [catalogAuthor, setCatalogAuthor] = useState("");
  const [catalogPublisher, setCatalogPublisher] = useState("");
  const [catalogAvailableOnly, setCatalogAvailableOnly] = useState(false);
  const [catalogBooks, setCatalogBooks] = useState<GroupedBookSummary[]>([]);
  const [catalogPage, setCatalogPage] = useState(0);
  const [catalogPageSize, setCatalogPageSize] = useState<PageSize>(10);
  const [catalogTotalPages, setCatalogTotalPages] = useState(0);
  const [catalogTotalElements, setCatalogTotalElements] = useState(0);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [selectedTitleGroup, setSelectedTitleGroup] = useState<GroupedCatalogBook | null>(null);
  const [titleDetailsLoading, setTitleDetailsLoading] = useState(false);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [userDirectoryPage, setUserDirectoryPage] = useState(0);
  const [userDirectoryPageSize, setUserDirectoryPageSize] = useState<PageSize>(10);
  const [userDirectoryTotalPages, setUserDirectoryTotalPages] = useState(0);
  const [userDirectoryTotalElements, setUserDirectoryTotalElements] = useState(0);
  const [scanType, setScanType] = useState<ScanType>("QR");
  const [scanValue, setScanValue] = useState("");
  const [staffBorrowerIdentifierType, setStaffBorrowerIdentifierType] = useState<IdentifierType>("ROLL_NUMBER");
  const [staffBorrowerIdentifier, setStaffBorrowerIdentifier] = useState("");
  const [checkedStudent, setCheckedStudent] = useState<UserDetailsResponse | null>(null);
  const [returnBorrowerIdentifierType, setReturnBorrowerIdentifierType] = useState<IdentifierType>("ROLL_NUMBER");
  const [returnBorrowerIdentifier, setReturnBorrowerIdentifier] = useState("");
  const [returnScanType, setReturnScanType] = useState<ScanType>("QR");
  const [returnScanValue, setReturnScanValue] = useState("");
  const [returnResetFine, setReturnResetFine] = useState(false);
  const [returnCheckedBorrower, setReturnCheckedBorrower] = useState<UserDetailsResponse | null>(null);
  const [renewBorrowerIdentifierType, setRenewBorrowerIdentifierType] = useState<IdentifierType>("ROLL_NUMBER");
  const [renewBorrowerIdentifier, setRenewBorrowerIdentifier] = useState("");
  const [renewScanType, setRenewScanType] = useState<ScanType>("QR");
  const [renewScanValue, setRenewScanValue] = useState("");
  const [renewLoanDays, setRenewLoanDays] = useState(7);
  const [renewCheckedBorrower, setRenewCheckedBorrower] = useState<UserDetailsResponse | null>(null);
  const [scanResult, setScanResult] = useState<BookCopyScanResponse | null>(null);
  const [isScanResultOpen, setIsScanResultOpen] = useState(false);
  const [isBookHistoryOpen, setIsBookHistoryOpen] = useState(false);
  const [myProfile, setMyProfile] = useState<UserDetailsResponse | null>(null);
  const [myIssuedBooks, setMyIssuedBooks] = useState<CirculationResponse[]>([]);
  const [selectedUserDetails, setSelectedUserDetails] = useState<UserDetailsResponse | null>(null);
  const [selectedUserIssuedBooks, setSelectedUserIssuedBooks] = useState<CirculationResponse[]>([]);
  const [generatedQr, setGeneratedQr] = useState<{ fullName: string; dataUrl: string; value: string } | null>(null);
  const [isUserDirectoryOpen, setIsUserDirectoryOpen] = useState(false);
  const [isIssuedBooksWindowOpen, setIsIssuedBooksWindowOpen] = useState(false);
  const [isAllIssuedBooksWindowOpen, setIsAllIssuedBooksWindowOpen] = useState(false);
  const [allIssuedBooks, setAllIssuedBooks] = useState<CirculationResponse[]>([]);
  const [allIssuedPage, setAllIssuedPage] = useState(0);
  const [allIssuedPageSize, setAllIssuedPageSize] = useState<PageSize>(10);
  const [allIssuedTotalPages, setAllIssuedTotalPages] = useState(0);
  const [allIssuedTotalElements, setAllIssuedTotalElements] = useState(0);
  const [isBookQrWindowOpen, setIsBookQrWindowOpen] = useState(false);
  const [bookCopyQrValue, setBookCopyQrValue] = useState("");
  const [bookSsnToRemove, setBookSsnToRemove] = useState("");
  const [generateQrAfterAdd, setGenerateQrAfterAdd] = useState(false);
  const [generatedBookQrs, setGeneratedBookQrs] = useState<Array<BookCopySummary & { dataUrl: string }>>([]);
  const [isAuditLogsOpen, setIsAuditLogsOpen] = useState(false);
  const [auditEvents, setAuditEvents] = useState<AuditEventResponse[]>([]);
  const [auditPage, setAuditPage] = useState(0);
  const [auditPageSize, setAuditPageSize] = useState<PageSize>(10);
  const [auditTotalPages, setAuditTotalPages] = useState(0);
  const [auditTotalElements, setAuditTotalElements] = useState(0);
  const [auditLogsLoaded, setAuditLogsLoaded] = useState(false);
  const [auditFromDate, setAuditFromDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().slice(0, 10);
  });
  const [auditToDate, setAuditToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [auditActionFilter, setAuditActionFilter] = useState("");
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [userEditForm, setUserEditForm] = useState<UserUpdateRequest>({
    fullName: "",
    department: "",
    rollNumber: "",
    collegeEmail: "",
    password: "",
    role: "STUDENT"
  });
  const [userDirectoryQuery, setUserDirectoryQuery] = useState("");
  const [registrationForm, setRegistrationForm] = useState<UserRegistrationRequest>({
    fullName: "",
    department: "",
    rollNumber: "",
    collegeEmail: "",
    password: "",
    role: "STUDENT"
  });
  const [bookForm, setBookForm] = useState<BookCreateRequest>({
    ssnNumber: "",
    title: "",
    author: "",
    publisher: "",
    category: "",
    shelfLocation: "",
    finePerDay: 5,
    loanPeriodDays: 14,
    copyCount: 1
  });
  const [bookEditForm, setBookEditForm] = useState({
    ssnNumber: "",
    bookSsnNumber: "",
    copySsnNumber: "",
    title: "",
    author: "",
    publisher: "",
    category: "",
    finePerDay: 5,
    loanPeriodDays: 14,
    shelfLocation: "",
    accessionNumber: "",
    qrCodeValue: "",
    status: ""
  });
  const [bookEditQrValue, setBookEditQrValue] = useState("");
  const [issueLoanDays, setIssueLoanDays] = useState(14);
  const [message, setMessage] = useState("");
  const [resetFineOnReturn, setResetFineOnReturn] = useState<Record<string, boolean>>({});
  const [renewDaysByTransaction, setRenewDaysByTransaction] = useState<Record<string, number>>({});
  const [bookHistoryScanType, setBookHistoryScanType] = useState<ScanType>("SSN");
  const [bookHistoryScanValue, setBookHistoryScanValue] = useState("");
  const [bookCopyHistory, setBookCopyHistory] = useState<BookCopyHistoryResponse | null>(null);

  const activeRole = useMemo(() => currentUser?.roles[0] ?? "Guest", [currentUser]);
  const loginIdentifierLabel = useMemo(() => {
    const labels: Record<IdentifierType, string> = {
      ROLL_NUMBER: "Staff Code",
      COLLEGE_EMAIL: "College Email",
      PHONE_NUMBER: "Phone Number",
      QR_CREDENTIAL: "QR Credential",
      RFID_CARD: "RFID Card"
    };

    return labels[identifierType];
  }, [identifierType]);
  const isStudent = currentUser?.roles.includes("STUDENT") ?? false;
  const isFaculty = currentUser?.roles.includes("FACULTY") ?? false;
  const isBorrower = isStudent || isFaculty;
  const canManageStudents = currentUser?.roles.some((role) => ["LIBRARIAN", "ADMIN", "SUPER_ADMIN"].includes(role)) ?? false;
  const canManageLibrarians = currentUser?.roles.some((role) => ["ADMIN", "SUPER_ADMIN"].includes(role)) ?? false;
  const canRegisterUsers = canManageLibrarians;
  const canGenerateUserQr = canManageLibrarians;
  const canManageBooks = currentUser?.roles.some((role) => ["LIBRARIAN", "ADMIN", "SUPER_ADMIN"].includes(role)) ?? false;
  const canIssueToStudents = canManageBooks;
  const canViewStudentRecords = currentUser?.roles.some((role) => ["FACULTY", "LIBRARIAN", "ADMIN", "SUPER_ADMIN"].includes(role)) ?? false;
  const canManageCollegeBranding = currentUser?.roles.some((role) => ["ADMIN", "SUPER_ADMIN"].includes(role)) ?? false;
  const canShowUserRegistration = canRegisterUsers;
  const canViewUserDirectory = canManageStudents || isFaculty;
  const canShowManagement = canShowUserRegistration || canManageBooks || canViewUserDirectory;
  const staffIssueStudentValue = staffBorrowerIdentifier.trim();
  const staffIssueBookValue = scanValue.trim();
  const isStaffIssueReady = canIssueToStudents && staffIssueStudentValue.length > 0 && staffIssueBookValue.length > 0;
  const returnBorrowerValue = returnBorrowerIdentifier.trim();
  const returnBookValue = returnScanValue.trim();
  const isStaffReturnReady = canIssueToStudents && returnBorrowerValue.length > 0 && returnBookValue.length > 0;
  const renewBorrowerValue = renewBorrowerIdentifier.trim();
  const renewBookValue = renewScanValue.trim();
  const isStaffRenewReady = canIssueToStudents && renewBorrowerValue.length > 0 && renewBookValue.length > 0;
  const myTotalFine = useMemo(
    () => myIssuedBooks.reduce((total, book) => total + book.fineAmount, 0),
    [myIssuedBooks]
  );
  const selectedUserTotalFine = useMemo(
    () => selectedUserIssuedBooks.reduce((total, book) => total + book.fineAmount, 0),
    [selectedUserIssuedBooks]
  );
  const sessionTimerLabel = sessionRemainingSeconds === null
    ? ""
    : `${Math.floor(sessionRemainingSeconds / 60)}:${String(sessionRemainingSeconds % 60).padStart(2, "0")}`;

  useEffect(() => {
    listBookCategories()
      .then(setBookCategories)
      .catch(() => setBookCategories([]));
  }, []);

  async function refreshCatalogIfOpen() {
    if (!isCatalogWindowOpen) {
      return;
    }
    try {
      await refreshCatalogBooks();
    } catch {
      // Keep the open catalogue as-is if refresh fails.
    }
  }

  async function refreshCatalogBooks(
    searchQuery = catalogQuery,
    page = catalogPage,
    size: PageSize = catalogPageSize,
    filters?: { category?: string; author?: string; publisher?: string; availableOnly?: boolean }
  ) {
    setCatalogLoading(true);
    try {
      const result = await searchGroupedBooks(searchQuery, {
        availableOnly: filters?.availableOnly ?? catalogAvailableOnly,
        category: filters?.category ?? catalogCategory,
        author: filters?.author ?? catalogAuthor,
        publisher: filters?.publisher ?? catalogPublisher,
        page,
        size
      });
      setCatalogBooks(result.content);
      setCatalogPage(result.page);
      setCatalogPageSize(result.size === 20 || result.size === 50 ? result.size : 10);
      setCatalogTotalPages(result.totalPages);
      setCatalogTotalElements(result.totalElements);
    } finally {
      setCatalogLoading(false);
    }
  }

  async function handleOpenTitleDetails(book: GroupedBookSummary) {
    setTitleDetailsLoading(true);
    setSelectedTitleGroup({
      title: book.title,
      author: book.author || "",
      publisher: book.publisher ?? "",
      category: book.category || "",
      availableCopies: book.availableCopies,
      totalCopies: book.totalCopies,
      editionCount: book.editionCount,
      copies: []
    });
    try {
      const copies = await listCopiesByTitle(book.title);
      setSelectedTitleGroup({
        title: book.title,
        author: book.author || copies[0]?.author || "",
        publisher: book.publisher ?? copies[0]?.publisher ?? "",
        category: book.category || copies[0]?.category || "",
        availableCopies: book.availableCopies,
        totalCopies: book.totalCopies,
        editionCount: book.editionCount,
        copies
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load title details.");
      setSelectedTitleGroup(null);
    } finally {
      setTitleDetailsLoading(false);
    }
  }

  async function refreshUserDirectory(
    actorUserId: string,
    searchQuery = userDirectoryQuery,
    page = userDirectoryPage,
    size: PageSize = userDirectoryPageSize
  ) {
    const result = await listUsers(actorUserId, searchQuery, page, size);
    setUsers(result.content);
    setUserDirectoryPage(result.page);
    setUserDirectoryPageSize(result.size === 20 || result.size === 50 ? result.size : 10);
    setUserDirectoryTotalPages(result.totalPages);
    setUserDirectoryTotalElements(result.totalElements);
  }

  async function refreshAuditLogs(
    actorUserId: string,
    page = auditPage,
    size: PageSize = auditPageSize
  ) {
    const result = await listAuditEvents(
      actorUserId,
      auditFromDate,
      auditToDate,
      auditActionFilter || undefined,
      page,
      size
    );
    setAuditEvents(result.content);
    setAuditPage(result.page);
    setAuditPageSize(result.size === 20 || result.size === 50 ? result.size : 10);
    setAuditTotalPages(result.totalPages);
    setAuditTotalElements(result.totalElements);
    setAuditLogsLoaded(true);
  }

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const isHardTimeoutSession = currentUser.roles.includes("STUDENT");
    let expiresAt = Date.now() + SESSION_TIMEOUT_MS;
    let timeoutId = window.setTimeout(expireSession, SESSION_TIMEOUT_MS);
    const intervalId = window.setInterval(updateTimerLabel, 1000);
    const activityEvents = ["click", "keydown", "mousemove", "scroll", "touchstart"];

    updateTimerLabel();

    function resetTimer() {
      if (isHardTimeoutSession) {
        return;
      }

      expiresAt = Date.now() + SESSION_TIMEOUT_MS;
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(expireSession, SESSION_TIMEOUT_MS);
      updateTimerLabel();
    }

    function updateTimerLabel() {
      const remainingSeconds = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setSessionRemainingSeconds(remainingSeconds);
    }

    function expireSession() {
      window.clearInterval(intervalId);
      setCurrentUser(null);
      setSessionRemainingSeconds(null);
      setMyProfile(null);
      setMyIssuedBooks([]);
      clearSessionOnlyState();
      clearLoginInputs();
      setMessage("Session timed out after 15 minutes. Please sign in again.");
    }

    if (!isHardTimeoutSession) {
      activityEvents.forEach((eventName) => window.addEventListener(eventName, resetTimer));
    }

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
      if (!isHardTimeoutSession) {
        activityEvents.forEach((eventName) => window.removeEventListener(eventName, resetTimer));
      }
    };
  }, [currentUser]);

  function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const uploadedLogoUrl = String(reader.result);
      setLogoUrl(uploadedLogoUrl);
      localStorage.setItem("collegeLogoUrl", uploadedLogoUrl);
    };
    reader.readAsDataURL(file);
  }

  function handleCollegeNameChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setCollegeName(value);
    localStorage.setItem("collegeName", value);
  }

  async function loadCurrentUserViews(user: LoginResponse) {
    const [profile, issuedBooks] = await Promise.all([
      getUserDetails(user.userId, user.userId),
      listIssuedBooksForUser(user.userId, user.userId)
    ]);

    setMyProfile(profile);
    setMyIssuedBooks(issuedBooks);
  }

  function clearLoginInputs() {
    setIdentifier("");
    setPassword("");
    setUserScanValue("");
  }

  function clearSessionOnlyState() {
    setSelectedUserDetails(null);
    setSelectedUserIssuedBooks([]);
    setGeneratedQr(null);
    setIsUserDirectoryOpen(false);
    setIsIssuedBooksWindowOpen(false);
    setIsAllIssuedBooksWindowOpen(false);
    setAllIssuedBooks([]);
    setIsBookQrWindowOpen(false);
    setIsScanResultOpen(false);
    setIsBookHistoryOpen(false);
    setBookCopyHistory(null);
    setGeneratedBookQrs([]);
    setBookCopyQrValue("");
    setScanResult(null);
    setScanValue("");
    setStaffBorrowerIdentifier("");
    setCheckedStudent(null);
    setReturnBorrowerIdentifier("");
    setReturnScanValue("");
    setReturnResetFine(false);
    setRenewBorrowerIdentifier("");
    setRenewBorrowerIdentifierType("ROLL_NUMBER");
    setRenewScanValue("");
    setRenewLoanDays(7);
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    try {
      const user = await login(identifierType, identifier.trim(), password);
      clearSessionOnlyState();
      clearLoginInputs();
      setCurrentUser(user);
      await loadCurrentUserViews(user);
      setMessage(`Welcome, ${user.fullName}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login failed. Check your staff code/email and password.");
    }
  }

  async function handleOpenCatalogWindow() {
    setCatalogQuery("");
    setCatalogCategory("");
    setCatalogAuthor("");
    setCatalogPublisher("");
    setCatalogAvailableOnly(true);
    setCatalogPage(0);
    setIsCatalogWindowOpen(true);
    try {
      await refreshCatalogBooks("", 0, catalogPageSize, {
        category: "",
        author: "",
        publisher: "",
        availableOnly: true
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to open catalog.");
    }
  }

  async function refreshAllIssuedBooks(page = allIssuedPage, size: PageSize = allIssuedPageSize) {
    if (!currentUser) {
      return;
    }

    const result = await listAllIssuedBooks(currentUser.userId, page, size);
    setAllIssuedBooks(result.content);
    setAllIssuedPage(result.page);
    setAllIssuedPageSize(result.size === 20 || result.size === 50 ? result.size : 10);
    setAllIssuedTotalPages(result.totalPages);
    setAllIssuedTotalElements(result.totalElements);
  }

  async function handleOpenAllIssuedBooksWindow() {
    if (!currentUser) {
      setMessage("Sign in as librarian or admin to view issued books.");
      return;
    }

    try {
      setAllIssuedPage(0);
      await refreshAllIssuedBooks(0, allIssuedPageSize);
      setIsAllIssuedBooksWindowOpen(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load issued books.");
    }
  }

  async function handleCatalogWindowSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setCatalogPage(0);
      await refreshCatalogBooks(catalogQuery, 0, catalogPageSize);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Catalog search failed.");
    }
  }

  function formatDateTime(value?: string | null, fallbackDate?: string | null) {
    if (value) {
      return new Date(value).toLocaleString();
    }

    return fallbackDate ?? "—";
  }

  function formatIdentifierLabel(type: IdentifierType, roles: string[]) {
    if (type === "ROLL_NUMBER") {
      return roles.includes("STUDENT") ? "Roll Number" : "Staff Code";
    }

    return type.replace(/_/g, " ");
  }

  function codeLabelForRole(role: string) {
    return role === "STUDENT" ? "Roll Number" : "Staff Code";
  }

  function canViewListedUser(user: UserSummary) {
    if (!currentUser) {
      return false;
    }

    if (user.id === currentUser.userId || canManageLibrarians) {
      return true;
    }

    if (isFaculty) {
      return user.roles.includes("STUDENT") || user.roles.includes("LIBRARIAN");
    }

    return canManageStudents && user.roles.includes("STUDENT");
  }

  function canViewIssuedBooksFor(user: UserDetailsResponse) {
    if (!currentUser) {
      return false;
    }

    if (user.id === currentUser.userId) {
      return true;
    }

    if (user.roles.includes("STUDENT")) {
      return canViewStudentRecords;
    }

    return user.roles.includes("FACULTY") && canManageLibrarians;
  }

  async function handleUserScanLogin(value = userScanValue) {
    setMessage("");

    try {
      const user = await scanLogin("QR_CREDENTIAL", value.trim());
      clearSessionOnlyState();
      clearLoginInputs();
      setCurrentUser(user);
      await loadCurrentUserViews(user);
      setMessage(`QR login approved for ${user.fullName}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "QR login failed. Try USER-QR-CS2026001.");
    }
  }

  async function resolveBookCopy(type = scanType, value = scanValue) {
    setMessage("");

    try {
      const result = await scanBookCopy(type, value, currentUser?.userId);
      setScanResult(result);
      setIsScanResultOpen(true);
      setIssueLoanDays(result.loanPeriodDays);
      return result;
    } catch (error) {
      setScanResult(null);
      setIsScanResultOpen(false);
      setMessage(error instanceof Error ? error.message : "No book copy found for this scan value.");
      return null;
    }
  }

  async function handleLookupBookHistory(
    event?: React.FormEvent<HTMLFormElement>,
    override?: { type?: ScanType; value?: string }
  ) {
    event?.preventDefault();

    if (!currentUser) {
      setMessage("Sign in as librarian or admin to view book history.");
      return;
    }

    const type = override?.type ?? bookHistoryScanType;
    const value = (override?.value ?? bookHistoryScanValue).trim();
    if (!value) {
      setMessage("Enter or scan a book QR/RFID/SSN value to view history.");
      return;
    }

    try {
      const scanned = await scanBookCopy(type, value, currentUser.userId);
      const history = await getBookCopyHistory(scanned.copyId, currentUser.userId);
      setBookCopyHistory(history);
      setIsBookHistoryOpen(true);
      setBookHistoryScanType(type);
      setBookHistoryScanValue(value);
      setMessage("");
    } catch (error) {
      setBookCopyHistory(null);
      setIsBookHistoryOpen(false);
      setMessage(error instanceof Error ? error.message : "Unable to load book copy history.");
    }
  }

  async function handleScan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!scanValue.trim()) {
      return;
    }
    await resolveBookCopy();
  }

  async function handleIssue() {
    if (!currentUser) {
      setMessage("Sign in before issuing a book.");
      return;
    }

    const selectedCopy = scanResult ?? await resolveBookCopy();
    if (!selectedCopy) {
      setMessage("Enter or scan a valid book QR/RFID/SSN value before issuing.");
      return;
    }

    const maxDays = selectedCopy.loanPeriodDays;
    if (issueLoanDays < 1 || issueLoanDays > maxDays) {
      setMessage(`Borrow days must be between 1 and ${maxDays}.`);
      return;
    }

    try {
      const transaction = await issueBookCopy(
        selectedCopy.copyId,
        currentUser.userId,
        currentUser.userId,
        issueLoanDays
      );
      await loadCurrentUserViews(currentUser);
      await refreshCatalogIfOpen();
      setMessage(`${transaction.bookTitle} issued to ${transaction.borrowerName} for ${issueLoanDays} day(s).`);
      setScanResult({ ...selectedCopy, status: "ISSUED" });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Issue failed. The copy may already be issued or unavailable.");
    }
  }

  async function handleStaffIssue() {
    if (!currentUser) {
      setMessage("Sign in as librarian or admin to issue a book to a student or faculty member.");
      return;
    }

    const borrowerIdentifier = staffBorrowerIdentifier.trim();
    const bookScanValue = scanValue.trim();

    if (!borrowerIdentifier) {
      setMessage("Enter the roll number/staff code or scan the borrower QR first.");
      return;
    }

    if (!bookScanValue) {
      setMessage("Enter or scan the book copy QR/RFID/SSN value before issuing.");
      return;
    }

    const maxDays = scanResult?.loanPeriodDays ?? issueLoanDays;
    if (issueLoanDays < 1 || issueLoanDays > maxDays) {
      setMessage(`Borrow days must be between 1 and ${maxDays}.`);
      return;
    }

    try {
      const transaction = await issueBookByIdentifier(
        currentUser.userId,
        staffBorrowerIdentifierType,
        borrowerIdentifier,
        scanType,
        bookScanValue,
        issueLoanDays
      );
      setStaffBorrowerIdentifier(borrowerIdentifier);
      setScanValue(bookScanValue);
      setMessage(`${transaction.bookTitle} issued to ${transaction.borrowerName} for ${issueLoanDays} day(s). Return by ${transaction.dueOn}.`);
      await refreshCatalogIfOpen();
      if (selectedUserDetails) {
        setSelectedUserIssuedBooks(await listIssuedBooksForUser(selectedUserDetails.id, currentUser.userId));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Issue to borrower failed.");
    }
  }

  async function handleCheckStudent() {
    if (!currentUser) {
      setMessage("Sign in as faculty, librarian, or admin to check a borrower.");
      return;
    }

    const borrowerIdentifier = staffBorrowerIdentifier.trim();

    if (!borrowerIdentifier) {
      setMessage("Enter the roll number/staff code or scan the borrower QR first.");
      return;
    }

    try {
      const student = await getStudentDetailsByIdentifier(
        staffBorrowerIdentifierType,
        borrowerIdentifier,
        currentUser.userId
      );
      setCheckedStudent(student);
      setSelectedUserDetails(student);
      setSelectedUserIssuedBooks(await listIssuedBooksForUser(student.id, currentUser.userId));
      setStaffBorrowerIdentifier(borrowerIdentifier);
      const roleLabel = student.roles.includes("FACULTY") ? "Faculty" : "Student";
      setMessage(`${roleLabel} found: ${student.fullName}.`);
    } catch (error) {
      setCheckedStudent(null);
      setMessage(error instanceof Error ? error.message : "Borrower check failed.");
    }
  }

  async function checkBorrowerByIdentifier(
    identifierType: IdentifierType,
    identifierValue: string,
    onSuccess: (student: UserDetailsResponse) => void,
    onFailure: () => void
  ) {
    if (!currentUser) {
      setMessage("Sign in as librarian or admin to check a borrower.");
      return;
    }

    const borrowerIdentifier = identifierValue.trim();
    if (!borrowerIdentifier) {
      setMessage("Enter the roll number/staff code or scan the borrower QR first.");
      return;
    }

    try {
      const student = await getStudentDetailsByIdentifier(
        identifierType,
        borrowerIdentifier,
        currentUser.userId
      );
      onSuccess(student);
      setSelectedUserDetails(student);
      setSelectedUserIssuedBooks(await listIssuedBooksForUser(student.id, currentUser.userId));
      const roleLabel = student.roles.includes("FACULTY") ? "Faculty" : "Student";
      setMessage(`${roleLabel} found: ${student.fullName}.`);
    } catch (error) {
      onFailure();
      setMessage(error instanceof Error ? error.message : "Borrower check failed.");
    }
  }

  async function handleCheckReturnBorrower() {
    await checkBorrowerByIdentifier(
      returnBorrowerIdentifierType,
      returnBorrowerIdentifier,
      (student) => setReturnCheckedBorrower(student),
      () => setReturnCheckedBorrower(null)
    );
  }

  async function handleCheckRenewBorrower() {
    await checkBorrowerByIdentifier(
      renewBorrowerIdentifierType,
      renewBorrowerIdentifier,
      (student) => setRenewCheckedBorrower(student),
      () => setRenewCheckedBorrower(null)
    );
  }

  async function handleCheckReturnCopy(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const value = returnScanValue.trim();
    if (!value) {
      setMessage("Enter or scan a book QR/RFID/SSN value to check the copy.");
      return;
    }
    await resolveBookCopy(returnScanType, value);
  }

  async function handleCheckRenewCopy(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const value = renewScanValue.trim();
    if (!value) {
      setMessage("Enter or scan a book QR/RFID/SSN value to check the copy.");
      return;
    }
    await resolveBookCopy(renewScanType, value);
  }

  async function handleReturnIssuedBook(book: CirculationResponse) {
    if (!currentUser || !selectedUserDetails) {
      setMessage("Select a student before returning a book.");
      return;
    }

    const resetFine = resetFineOnReturn[book.transactionId] ?? false;

    try {
      const transaction = await returnBookCopy(book.bookCopyId, currentUser.userId, resetFine);
      setResetFineOnReturn((current) => {
        const next = { ...current };
        delete next[book.transactionId];
        return next;
      });
      setSelectedUserIssuedBooks(await listIssuedBooksForUser(selectedUserDetails.id, currentUser.userId));
      await refreshCatalogIfOpen();
      const fineMessage = transaction.fineAmount === 0 ? "No fine." : `Fine due: Rs ${transaction.fineAmount}.`;
      setMessage(`${transaction.bookTitle} returned. ${fineMessage}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Return failed.");
    }
  }

  async function handleStaffReturnByScan() {
    if (!currentUser) {
      setMessage("Sign in as librarian or admin to return books.");
      return;
    }

    if (!isStaffReturnReady) {
      setMessage("Enter/scan the borrower roll/QR and the book QR/SSN before returning.");
      return;
    }

    try {
      const transaction = await returnBookByIdentifier(
        currentUser.userId,
        returnBorrowerIdentifierType,
        returnBorrowerValue,
        returnScanType,
        returnBookValue,
        returnResetFine
      );
      setReturnBorrowerIdentifier("");
      setReturnBorrowerIdentifierType("ROLL_NUMBER");
      setReturnScanValue("");
      setReturnResetFine(false);
      setReturnCheckedBorrower(null);
      await refreshCatalogIfOpen();
      if (selectedUserDetails?.id) {
        setSelectedUserIssuedBooks(await listIssuedBooksForUser(selectedUserDetails.id, currentUser.userId));
      }
      const fineMessage = transaction.fineAmount === 0 ? "No fine." : `Fine due: Rs ${transaction.fineAmount}.`;
      setMessage(`${transaction.bookTitle} returned for ${transaction.borrowerName}. ${fineMessage}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Return failed.");
    }
  }

  async function handleStaffRenewByScan() {
    if (!currentUser) {
      setMessage("Sign in as librarian or admin to renew books.");
      return;
    }

    if (!isStaffRenewReady) {
      setMessage("Enter/scan the borrower roll/QR and the book QR/SSN before renewing.");
      return;
    }

    if (renewLoanDays < 1) {
      setMessage("Renewal days must be at least 1.");
      return;
    }

    const daysToRenew = renewLoanDays;

    try {
      const transaction = await renewBookByIdentifier(
        currentUser.userId,
        renewBorrowerIdentifierType,
        renewBorrowerValue,
        renewScanType,
        renewBookValue,
        daysToRenew
      );
      setRenewBorrowerIdentifier("");
      setRenewBorrowerIdentifierType("ROLL_NUMBER");
      setRenewScanValue("");
      setRenewLoanDays(Math.min(7, transaction.loanPeriodDays));
      setRenewCheckedBorrower(null);
      if (selectedUserDetails?.id) {
        setSelectedUserIssuedBooks(await listIssuedBooksForUser(selectedUserDetails.id, currentUser.userId));
      }
      setMessage(
        `${transaction.bookTitle} renewed for ${transaction.borrowerName} by ${daysToRenew} day(s) until ${transaction.dueOn}.`
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Renewal failed.");
    }
  }

  async function handleRenewIssuedBook(book: CirculationResponse) {
    if (!currentUser || !selectedUserDetails) {
      setMessage("Select a student before renewing a book.");
      return;
    }

    const renewalDays = renewDaysByTransaction[book.transactionId]
      ?? Math.min(7, book.loanPeriodDays);
    if (renewalDays < 1 || renewalDays > book.loanPeriodDays) {
      setMessage(`Renewal days must be between 1 and ${book.loanPeriodDays}.`);
      return;
    }

    try {
      const transaction = await renewTransaction(book.transactionId, currentUser.userId, renewalDays);
      setSelectedUserIssuedBooks(await listIssuedBooksForUser(selectedUserDetails.id, currentUser.userId));
      setMessage(`${transaction.bookTitle} renewed by ${renewalDays} day(s) until ${transaction.dueOn}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Renewal failed.");
    }
  }

  async function handleRegisterUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!currentUser) {
      setMessage("Sign in as admin to register users.");
      return;
    }

    if (registrationForm.role !== "STUDENT" && !registrationForm.password?.trim()) {
      setMessage("Password is required for faculty, librarian, and admin accounts.");
      return;
    }

    try {
      const payload = {
        ...registrationForm,
        collegeEmail: registrationForm.collegeEmail || undefined,
        password: registrationForm.role === "STUDENT"
          ? undefined
          : registrationForm.password?.trim()
      };
      const user = await registerUser(payload, currentUser.userId);

      if (currentUser) { await refreshUserDirectory(currentUser.userId, userDirectoryQuery, 0, userDirectoryPageSize); }
      setRegistrationForm({
        fullName: "",
        department: "",
        rollNumber: "",
        collegeEmail: "",
        password: "",
        role: "STUDENT"
      });
      setMessage(`${user.fullName} registered as ${user.roles[0]}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Registration failed.");
    }
  }

  async function handleRemoveUser(user: UserSummary) {
    if (!currentUser) {
      setMessage("Sign in as librarian or admin to remove users.");
      return;
    }

    try {
      await removeUser(user.id, currentUser.userId);
      if (currentUser) { await refreshUserDirectory(currentUser.userId, userDirectoryQuery, 0, userDirectoryPageSize); }
      setMessage(`${user.fullName} removed from active users.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "User removal failed.");
    }
  }

  async function handleGenerateUserQr(user: UserSummary) {
    setGeneratedQr(null);

    if (!currentUser) {
      setMessage("Sign in as admin to generate user QR codes.");
      return;
    }

    try {
      const qrCredential = await getUserQrCredential(user.id, currentUser.userId);
      const dataUrl = await QRCode.toDataURL(qrCredential.qrCredential, {
        margin: 2,
        width: 220
      });
      setGeneratedQr({ fullName: qrCredential.fullName, dataUrl, value: qrCredential.qrCredential });
      setMessage(`QR code generated for ${qrCredential.fullName}.`);
    } catch (error) {
      setGeneratedQr(null);
      setMessage(error instanceof Error ? error.message : "QR generation failed.");
    }
  }

  async function handleViewUser(user: UserSummary) {
    if (!currentUser) {
      setMessage("Sign in with an authorized account to view user details.");
      return;
    }

    try {
      const details = await getUserDetails(user.id, currentUser.userId);
      setSelectedUserDetails(details);
      setSelectedUserIssuedBooks([]);
      setIsIssuedBooksWindowOpen(false);
      setIsEditingUser(false);
      setMessage(`Showing details for ${details.fullName}.`);
    } catch (error) {
      setSelectedUserDetails(null);
      setSelectedUserIssuedBooks([]);
      setIsIssuedBooksWindowOpen(false);
      setIsEditingUser(false);
      setMessage(error instanceof Error ? error.message : "Unable to load user details.");
    }
  }

  function handleStartEditUser() {
    if (!selectedUserDetails || !canManageLibrarians) {
      setMessage("Only admin can edit users.");
      return;
    }

    if (selectedUserDetails.roles.includes("SUPER_ADMIN")) {
      setMessage("Super admin accounts cannot be edited from this screen.");
      return;
    }

    const editableRole = selectedUserDetails.roles.find((role) =>
      role === "STUDENT" || role === "FACULTY" || role === "LIBRARIAN" || role === "ADMIN"
    ) ?? "STUDENT";

    setUserEditForm({
      fullName: selectedUserDetails.fullName,
      department: selectedUserDetails.department,
      rollNumber: selectedUserDetails.identifiers.find((item) => item.type === "ROLL_NUMBER")?.value ?? "",
      collegeEmail: selectedUserDetails.identifiers.find((item) => item.type === "COLLEGE_EMAIL")?.value ?? "",
      password: "",
      role: editableRole
    });
    setIsEditingUser(true);
  }

  async function handleUpdateUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentUser || !selectedUserDetails || !canManageLibrarians) {
      setMessage("Only admin can edit users.");
      return;
    }

    try {
      const payload: UserUpdateRequest = {
        ...userEditForm,
        collegeEmail: userEditForm.collegeEmail?.trim() ? userEditForm.collegeEmail.trim() : undefined,
        password: userEditForm.password?.trim() ? userEditForm.password.trim() : undefined
      };
      const updated = await updateUser(selectedUserDetails.id, payload, currentUser.userId);
      setSelectedUserDetails(updated);
      if (currentUser) { await refreshUserDirectory(currentUser.userId, userDirectoryQuery, 0, userDirectoryPageSize); }
      setIsEditingUser(false);
      setUserEditForm((current) => ({ ...current, password: "" }));
      setMessage(`${updated.fullName} details updated.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "User update failed.");
    }
  }

  async function handleOpenIssuedBooks() {
    if (!currentUser || !selectedUserDetails) {
      setMessage("Select a user before viewing issued books.");
      return;
    }

    if (!canViewIssuedBooksFor(selectedUserDetails)) {
      setMessage("You are not allowed to view issued books for this user.");
      return;
    }

    try {
      setSelectedUserIssuedBooks(await listIssuedBooksForUser(selectedUserDetails.id, currentUser.userId));
      setIsIssuedBooksWindowOpen(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load issued books.");
    }
  }

  function handleDownloadQr() {
    if (!generatedQr) {
      return;
    }

    downloadDataUrl(generatedQr.dataUrl, `${generatedQr.fullName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-qr.png`);
  }

  function handleDownloadBookQr(copy: BookCopySummary & { dataUrl: string }) {
    downloadDataUrl(copy.dataUrl, `${copy.ssnNumber.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}-book-qr.png`);
  }

  async function handleGenerateQrForCatalogSsn(ssnNumber: string, bookTitle: string) {
    if (!currentUser) {
      setMessage("Sign in as librarian or admin to generate book QR codes.");
      return;
    }

    try {
      const copies = await listBookCopies(ssnNumber, currentUser.userId);
      if (copies.length === 0) {
        setMessage(`No physical copies found for ${bookTitle} (${ssnNumber}).`);
        return;
      }

      const qrImages = await Promise.all(
        copies.map(async (copy) => ({
          ...copy,
          dataUrl: await QRCode.toDataURL(copy.qrCodeValue, {
            margin: 2,
            width: 220
          })
        }))
      );
      setGeneratedBookQrs(qrImages);
      setIsBookQrWindowOpen(true);
      setMessage(`Generated ${qrImages.length} QR code(s) for ${bookTitle}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to generate book QR codes.");
    }
  }

  async function handleSaveQrForCopy(copy: BookCopySummary) {
    try {
      const dataUrl = await QRCode.toDataURL(copy.qrCodeValue, {
        margin: 2,
        width: 220
      });
      downloadDataUrl(
        dataUrl,
        `${copy.ssnNumber.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}-book-qr.png`
      );
      setMessage(`QR saved for copy ${copy.ssnNumber}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save book QR code.");
    }
  }

  function downloadDataUrl(dataUrl: string, fileName: string) {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = fileName;
    link.click();
  }

  async function handleAddBook(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentUser) {
      setMessage("Sign in as librarian or admin to add books.");
      return;
    }

    try {
      const book = await addBook(bookForm, currentUser.userId);
      await refreshCatalogIfOpen();
      listBookCategories()
        .then(setBookCategories)
        .catch(() => undefined);
      setBookForm({
        ssnNumber: "",
        title: "",
        author: "",
        publisher: "",
        category: "",
        shelfLocation: "",
        finePerDay: 5,
        loanPeriodDays: 14,
        copyCount: 1
      });

      if (!generateQrAfterAdd) {
        setGeneratedBookQrs([]);
        setIsBookQrWindowOpen(false);
        setMessage(`${book.title} added to catalog.`);
        return;
      }

      try {
        const copies = await listBookCopies(book.ssnNumber, currentUser.userId);
        const qrImages = await Promise.all(
          copies.map(async (copy) => ({
            ...copy,
            dataUrl: await QRCode.toDataURL(copy.qrCodeValue, {
              margin: 2,
              width: 220
            })
          }))
        );
        setGeneratedBookQrs(qrImages);
        setIsBookQrWindowOpen(true);
        setMessage(`${book.title} added. Generated ${qrImages.length} QR code(s) for the new copy/copies.`);
      } catch (error) {
        setGeneratedBookQrs([]);
        setIsBookQrWindowOpen(false);
        setMessage(error instanceof Error ? `${book.title} added, but QR generation failed: ${error.message}` : `${book.title} added, but QR generation failed.`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Book add failed.");
    }
  }

  function applyBookCopyToEditForm(copy: BookCopySummary) {
    setBookEditForm({
      ssnNumber: copy.ssnNumber,
      bookSsnNumber: copy.bookSsnNumber,
      copySsnNumber: copy.ssnNumber,
      title: copy.title,
      author: copy.author,
      publisher: copy.publisher ?? "",
      category: copy.category,
      finePerDay: copy.finePerDay,
      loanPeriodDays: copy.loanPeriodDays,
      shelfLocation: copy.shelfLocation,
      accessionNumber: copy.accessionNumber,
      qrCodeValue: copy.qrCodeValue,
      status: copy.status
    });
  }

  async function fillBookEditFormFromSsn(ssn: string) {
    const cleanedSsn = ssn.trim();
    if (!currentUser) {
      throw new Error("Sign in as librarian or admin to edit books.");
    }

    try {
      const copy = await getBookCopyBySsn(cleanedSsn, currentUser.userId);
      applyBookCopyToEditForm(copy);
      return copy;
    } catch {
      // Fall through to catalog book lookup.
    }

    const matches = await searchBooks(cleanedSsn, { page: 0, size: 50 });
    const book = matches.content.find(
      (item) => item.ssnNumber.trim().toLowerCase() === cleanedSsn.toLowerCase()
    );
    if (!book) {
      throw new Error(`No physical copy or catalog book found with exact SSN "${cleanedSsn}".`);
    }

    const copies = await listBookCopies(book.ssnNumber, currentUser.userId);
    const matchingCopy =
      copies.find((copy) => copy.ssnNumber.trim().toLowerCase() === cleanedSsn.toLowerCase()) ??
      copies[0];
    if (!matchingCopy) {
      throw new Error(`Book "${book.title}" has no physical copies to edit.`);
    }

    applyBookCopyToEditForm(matchingCopy);
    return matchingCopy;
  }

  async function handleLoadBookForEdit() {
    const ssn = bookEditForm.ssnNumber.trim();
    if (!ssn) {
      setMessage("Enter a book or copy SSN to load details for editing.");
      return;
    }

    try {
      const copy = await fillBookEditFormFromSsn(ssn);
      setMessage(`Loaded copy ${copy.ssnNumber} (${copy.title}) for editing.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load book details.");
    }
  }

  async function handleLoadBookForEditByQr() {
    if (!currentUser) {
      setMessage("Sign in as librarian or admin to edit books.");
      return;
    }

    const qrCodeValue = bookEditQrValue.trim();
    if (!qrCodeValue) {
      setMessage("Enter or scan a book copy QR value to load details for editing.");
      return;
    }

    try {
      const copy = await getBookCopyByQrCode(qrCodeValue, currentUser.userId);
      applyBookCopyToEditForm(copy);
      setMessage(`Loaded copy ${copy.ssnNumber} (${copy.title}) from QR for editing.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load book details from QR.");
    }
  }

  async function handleUpdateBook(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!currentUser) {
      setMessage("Sign in as librarian or admin to edit books.");
      return;
    }

    const bookSsn = bookEditForm.bookSsnNumber.trim();
    const copySsn = bookEditForm.copySsnNumber.trim();
    if (!bookSsn || !copySsn) {
      setMessage("Load a physical copy before saving changes.");
      return;
    }

    if (!bookEditForm.shelfLocation.trim()) {
      setMessage("Shelf location is required.");
      return;
    }

    try {
      const book = await updateBook(
        bookSsn,
        {
          title: bookEditForm.title,
          author: bookEditForm.author,
          publisher: bookEditForm.publisher || undefined,
          category: bookEditForm.category,
          finePerDay: bookEditForm.finePerDay,
          loanPeriodDays: bookEditForm.loanPeriodDays
        },
        currentUser.userId
      );
      const copy = await updateBookCopyBySsn(
        copySsn,
        { shelfLocation: bookEditForm.shelfLocation.trim() },
        currentUser.userId
      );
      applyBookCopyToEditForm({
        ...copy,
        title: book.title,
        author: book.author,
        publisher: book.publisher,
        category: book.category,
        finePerDay: book.finePerDay,
        loanPeriodDays: book.loanPeriodDays
      });
      await refreshCatalogIfOpen();
      setMessage(`${book.title} copy ${copy.ssnNumber} updated.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update book.");
    }
  }

  async function handleRemoveBookCopyByQr() {
    if (!currentUser) {
      setMessage("Sign in as librarian or admin to remove books.");
      return;
    }

    const qrCodeValue = bookCopyQrValue.trim();
    if (!qrCodeValue) {
      setMessage("Enter the exact book QR code value first.");
      return;
    }

    try {
      await removeBookCopyByQrCode(qrCodeValue, currentUser.userId);
      await refreshCatalogIfOpen();
      setGeneratedBookQrs([]);
      setIsBookQrWindowOpen(false);
      setBookCopyQrValue("");
      setMessage("Book copy removed from catalog.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Book copy removal failed.");
    }
  }

  async function handleRemoveBookBySsn() {
    if (!currentUser) {
      setMessage("Sign in as librarian or admin to remove books.");
      return;
    }

    const ssnNumber = bookSsnToRemove.trim();
    if (!ssnNumber) {
      setMessage("Enter the book SSN number first.");
      return;
    }

    try {
      await removeBook(ssnNumber, currentUser.userId);
      await refreshCatalogIfOpen();
      setBookSsnToRemove("");
      setMessage(`Book with SSN ${ssnNumber} deleted from the database.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Book removal failed.");
    }
  }

  function handleOpenAuditLogs() {
    if (!currentUser) {
      setMessage("Sign in as admin to view audit logs.");
      return;
    }

    setAuditEvents([]);
    setAuditPage(0);
    setAuditTotalPages(0);
    setAuditTotalElements(0);
    setAuditLogsLoaded(false);
    setIsAuditLogsOpen(true);
  }

  async function handleFilterAuditLogs(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentUser) {
      setMessage("Sign in as admin to view audit logs.");
      return;
    }

    if (auditFromDate && auditToDate && auditToDate < auditFromDate) {
      setMessage("To date cannot be before from date.");
      return;
    }

    try {
      setAuditPage(0);
      await refreshAuditLogs(currentUser.userId, 0, auditPageSize);
    } catch (error) {
      setAuditLogsLoaded(false);
      setMessage(error instanceof Error ? error.message : "Failed to load audit logs.");
    }
  }

  function handleCloseAuditLogs() {
    setIsAuditLogsOpen(false);
    setAuditEvents([]);
    setAuditPage(0);
    setAuditTotalPages(0);
    setAuditTotalElements(0);
    setAuditLogsLoaded(false);
  }

  async function handleOpenUserDirectory() {
    if (!currentUser) {
      setMessage("Sign in to view the user directory.");
      return;
    }

    try {
      setUserDirectoryPage(0);
      await refreshUserDirectory(currentUser.userId, userDirectoryQuery, 0, userDirectoryPageSize);
      setIsUserDirectoryOpen(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to open user directory.");
    }
  }

  async function handleUserDirectorySearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentUser) {
      return;
    }

    try {
      setUserDirectoryPage(0);
      await refreshUserDirectory(currentUser.userId, userDirectoryQuery, 0, userDirectoryPageSize);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "User directory search failed.");
    }
  }

  function handleLogout() {
    setCurrentUser(null);
    setSessionRemainingSeconds(null);
    setMyProfile(null);
    setMyIssuedBooks([]);
    clearSessionOnlyState();
    clearLoginInputs();
    setMessage("You have been logged out.");
  }

  function handleCloseUserDirectory() {
    setIsUserDirectoryOpen(false);
    setSelectedUserDetails(null);
    setSelectedUserIssuedBooks([]);
    setIsEditingUser(false);
    setUserDirectoryQuery("");
    setGeneratedQr(null);
    setIsIssuedBooksWindowOpen(false);
  }

  return (
    <main className="app-shell">
      {logoUrl && <img className="portal-watermark" src={logoUrl} alt="" aria-hidden="true" />}

      <header className="portal-header">
        <div className="brand-block">
          <div className="college-identity">
            <div className={logoUrl ? "college-mark uploaded-logo" : "college-mark"}>
              {logoUrl ? <img src={logoUrl} alt="College logo" /> : "CL"}
            </div>
          </div>
          <div className="brand-copy">
            <p className={collegeName ? "college-name" : "eyebrow"}>{collegeName || "College Portal"}</p>
            <h1>Central Library Management</h1>
            <p className="header-subtitle">Student registration, catalog search, circulation, and QR services.</p>
            {canManageCollegeBranding && (
              <div className="branding-controls">
                <label className="logo-upload">
                  Add college logo
                  <input type="file" accept="image/*" onChange={handleLogoUpload} />
                </label>
                <label className="college-name-field">
                  College name
                  <input placeholder="Enter college name" value={collegeName} onChange={handleCollegeNameChange} />
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="session-panel">
          <Library size={22} />
          <div>
            <strong>{currentUser ? currentUser.fullName : "Not signed in"}</strong>
            <span>{currentUser ? activeRole : "Guest"}</span>
            {currentUser && <span className="session-timer">Session: {sessionTimerLabel}</span>}
          </div>
          {currentUser && (
            <button type="button" className="logout-button" onClick={handleLogout}>
              Logout
            </button>
          )}
        </div>
      </header>

      {message && (
        <div
          className="modal-backdrop message-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Portal message"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setMessage("");
            }
          }}
        >
          <div className="modal-panel message-dialog">
            <div className="modal-header">
              <div>
                <h2>Message</h2>
                <p>Library portal update</p>
              </div>
              <button type="button" className="secondary-button" onClick={() => setMessage("")}>
                Close
              </button>
            </div>
            <p className="message-dialog-text">{message}</p>
            <div className="action-row">
              <button type="button" onClick={() => setMessage("")}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="portal-grid">
        {currentUser && myProfile && (
          <article className="panel profile-panel">
            <div className="panel-title">
              <Users size={22} />
              <div>
                <h2>{isBorrower ? "My Details" : "Signed-in User"}</h2>
                <p>{myProfile.department}</p>
              </div>
            </div>

            <dl className="details-list">
              <div>
                <dt>Name</dt>
                <dd>{myProfile.fullName}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{myProfile.roles.join(", ")}</dd>
              </div>
              {myProfile.identifiers.filter((identifierItem) => identifierItem.type === "ROLL_NUMBER").map((identifierItem) => (
                <div key={`${identifierItem.type}-${identifierItem.value}`}>
                  <dt>{formatIdentifierLabel(identifierItem.type, myProfile.roles)}</dt>
                  <dd>{identifierItem.value}</dd>
                </div>
              ))}
            </dl>

            {isBorrower && (
              <div className="issued-list">
                <h3>My Issued Books</h3>
                <div className="total-fine">Total Fine: Rs {myTotalFine}</div>
                {myIssuedBooks.length === 0 ? (
                  <p>No books are currently issued on your ID.</p>
                ) : (
                  myIssuedBooks.map((book) => (
                    <div className="compact-row" key={book.transactionId}>
                      <div>
                        <strong>{book.bookTitle}</strong>
                        <span>
                          {book.accessionNumber} · Return by {book.dueOn} · Loan {book.loanDays} days · {book.overdueDays} overdue days · Rs {book.finePerDay}/day
                        </span>
                      </div>
                      <span className="availability">Fine Rs {book.fineAmount}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </article>
        )}

        {!currentUser && (
          <div className="login-split">
            <article className="login-card">
              <div className="card-header">
                <QrCode size={22} />
                <div>
                  <h2>Student Login</h2>
                  <p>Students must scan their ID QR code to sign in.</p>
                </div>
              </div>

              <QrScanner
                label="Scan Student QR To Login"
                onDetected={(value) => {
                  setUserScanValue(value);
                  void handleUserScanLogin(value);
                }}
              />
            </article>

            <form className="login-card" onSubmit={handleLogin}>
              <div className="card-header">
                <Users size={22} />
                <div>
                  <h2>Staff Login</h2>
                  <p>Faculty, librarian, and admin sign in with ID and password.</p>
                </div>
              </div>

              <label>
                Login Method
                <select value={identifierType} onChange={(event) => setIdentifierType(event.target.value as IdentifierType)}>
                  <option value="ROLL_NUMBER">Staff Code</option>
                  <option value="COLLEGE_EMAIL">College Email</option>
                </select>
              </label>

              <label>
                {loginIdentifierLabel}
                <input
                  placeholder={`Enter ${loginIdentifierLabel.toLowerCase()}`}
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                />
              </label>

              <label>
                Password / PIN
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
              </label>

              <button type="submit">Sign In Staff</button>
            </form>
          </div>
        )}

        <article className="panel available-books-panel">
          <div className="panel-title">
            <BookOpen size={22} />
            <div>
              <h2>Available Books</h2>
              <p>Browse every title and physical copy in the full catalogue.</p>
            </div>
          </div>

          <button type="button" className="secondary-button directory-button" onClick={() => void handleOpenCatalogWindow()}>
            Open Full Catalogue
          </button>
        </article>

        <article className="panel issue-panel">
          <div className="panel-title">
            <QrCode size={22} />
            <div>
              <h2>{canIssueToStudents ? "Issue Book To Student / Faculty" : isBorrower ? "Issue Book To Me" : "Book Scan"}</h2>
              {currentUser && <p>Scan a QR code or enter the value manually.</p>}
            </div>
          </div>

          {!currentUser ? (
            <div className="empty-state">Sign in to issue books.</div>
          ) : (
            <div className={`simple-scan-flow${canIssueToStudents ? "" : " self-issue-flow"}`}>
              <div className={`issue-steps-grid${canIssueToStudents ? "" : " single-step"}`}>
                {canIssueToStudents && (
                  <div className="staff-issue-panel">
                    <h3><span className="step-badge">1</span> Borrower</h3>
                    <p>Step 1: Enter the student roll number or faculty staff code, or scan their QR to view issued books.</p>
                    <div className="staff-issue-grid">
                      <input
                        placeholder="Roll number or staff code"
                        value={staffBorrowerIdentifierType === "ROLL_NUMBER" ? staffBorrowerIdentifier : ""}
                        onChange={(event) => {
                          setStaffBorrowerIdentifierType("ROLL_NUMBER");
                          setStaffBorrowerIdentifier(event.target.value);
                          setCheckedStudent(null);
                        }}
                      />
                      <button type="button" disabled={!staffIssueStudentValue} onClick={() => void handleCheckStudent()}>
                        Check Borrower
                      </button>
                    </div>
                    <QrScanner
                      label="Scan Borrower QR"
                      onDetected={(value) => {
                        setStaffBorrowerIdentifierType("QR_CREDENTIAL");
                        setStaffBorrowerIdentifier(value);
                        setCheckedStudent(null);
                      }}
                    />
                    {staffBorrowerIdentifierType === "QR_CREDENTIAL" && staffBorrowerIdentifier && (
                      <p className="scan-captured-note">Borrower QR captured from scanner. Click Check Borrower to verify.</p>
                    )}
                    {checkedStudent && (
                      <div className="checked-student-card">
                        <strong>{checkedStudent.fullName}</strong>
                        <span>
                          {checkedStudent.department}
                          {" · "}
                          {checkedStudent.roles.includes("FACULTY") ? "Staff Code" : "Roll Number"}
                          {" "}
                          {checkedStudent.identifiers.find((item) => item.type === "ROLL_NUMBER")?.value ?? "Not set"}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="staff-issue-panel">
                  <h3>
                    <span className="step-badge">{canIssueToStudents ? "2" : "1"}</span>
                    Book Copy
                  </h3>
                  <p>
                    {canIssueToStudents
                      ? "Step 2: Scan the book QR or enter the book QR/RFID/SSN value manually."
                      : "Scan the book QR or enter the book QR/RFID/SSN value manually."}
                  </p>
                  <form className="scan-form" onSubmit={handleScan}>
                    <select value={scanType} onChange={(event) => setScanType(event.target.value as ScanType)}>
                      <option value="QR">Book QR</option>
                      <option value="RFID">RFID Tag</option>
                      <option value="SSN">SSN</option>
                    </select>
                    <input
                      placeholder={scanType === "SSN" ? "Book SSN number" : "Book QR or RFID value"}
                      value={scanValue}
                      onChange={(event) => {
                        setScanValue(event.target.value);
                        setScanResult(null);
                        setIsScanResultOpen(false);
                      }}
                    />
                    <button type="submit" disabled={!staffIssueBookValue}>
                      Check Copy
                    </button>
                  </form>
                  <QrScanner
                    label="Scan Book QR"
                    onDetected={(value) => {
                      setScanType("QR");
                      setScanValue(value);
                      void resolveBookCopy("QR", value);
                    }}
                  />
                </div>
              </div>

              {scanResult && (
                <div className="scan-checked-bar">
                  <span>
                    Checked: <strong>{scanResult.title}</strong>
                    {" · "}
                    {scanResult.status}
                  </span>
                  <button type="button" className="secondary-button" onClick={() => setIsScanResultOpen(true)}>
                    View details
                  </button>
                </div>
              )}

              {scanResult && (
                <label className="loan-days-field">
                  Borrow for (days)
                  <input
                    type="number"
                    min={1}
                    max={scanResult.loanPeriodDays}
                    value={issueLoanDays}
                    onChange={(event) => setIssueLoanDays(Number(event.target.value))}
                  />
                  <span className="list-note">Maximum loan period for this book is {scanResult.loanPeriodDays} day(s).</span>
                </label>
              )}

              <div className="action-row issue-action-row">
                {isBorrower && (
                  <button type="button" onClick={() => void handleIssue()}>
                    Issue To Me
                  </button>
                )}
                {canIssueToStudents && (
                  <button type="button" disabled={!isStaffIssueReady} onClick={() => void handleStaffIssue()}>
                    Issue To Borrower
                  </button>
                )}
              </div>
              {canIssueToStudents && !isStaffIssueReady && (
                <p className="issue-hint">Enter the student roll number or faculty staff code and the book copy QR/RFID/SSN value to issue.</p>
              )}
            </div>
          )}
        </article>

        {canIssueToStudents && (
          <article className="panel issue-panel">
            <div className="panel-title">
              <QrCode size={22} />
              <div>
                <h2>Return Book</h2>
                <p>Scan borrower QR/roll number and book QR/SSN to return an issued copy.</p>
              </div>
            </div>

            <div className="simple-scan-flow">
              <div className="issue-steps-grid">
                <div className="staff-issue-panel">
                  <h3><span className="step-badge">1</span> Borrower</h3>
                  <p>Enter roll number/staff code or scan borrower QR.</p>
                  <div className="staff-issue-grid">
                    <input
                      placeholder="Roll number or staff code"
                      value={returnBorrowerIdentifierType === "ROLL_NUMBER" ? returnBorrowerIdentifier : ""}
                      onChange={(event) => {
                        setReturnBorrowerIdentifierType("ROLL_NUMBER");
                        setReturnBorrowerIdentifier(event.target.value);
                        setReturnCheckedBorrower(null);
                      }}
                    />
                    <button
                      type="button"
                      disabled={!returnBorrowerValue}
                      onClick={() => void handleCheckReturnBorrower()}
                    >
                      Check Borrower
                    </button>
                  </div>
                  <QrScanner
                    label="Scan Borrower QR"
                    onDetected={(value) => {
                      setReturnBorrowerIdentifierType("QR_CREDENTIAL");
                      setReturnBorrowerIdentifier(value);
                      setReturnCheckedBorrower(null);
                    }}
                  />
                  {returnBorrowerIdentifierType === "QR_CREDENTIAL" && returnBorrowerIdentifier && (
                    <p className="scan-captured-note">Borrower QR captured from scanner. Click Check Borrower to verify.</p>
                  )}
                  {returnCheckedBorrower && (
                    <div className="checked-student-card">
                      <strong>{returnCheckedBorrower.fullName}</strong>
                      <span>
                        {returnCheckedBorrower.department}
                        {" · "}
                        {returnCheckedBorrower.roles.includes("FACULTY") ? "Staff Code" : "Roll Number"}
                        {" "}
                        {returnCheckedBorrower.identifiers.find((item) => item.type === "ROLL_NUMBER")?.value ?? "Not set"}
                      </span>
                    </div>
                  )}
                </div>

                <div className="staff-issue-panel">
                  <h3><span className="step-badge">2</span> Book</h3>
                  <p>Scan book QR or enter book QR/RFID/SSN.</p>
                  <form className="scan-form" onSubmit={(event) => void handleCheckReturnCopy(event)}>
                    <select value={returnScanType} onChange={(event) => setReturnScanType(event.target.value as ScanType)}>
                      <option value="QR">Book QR</option>
                      <option value="RFID">RFID Tag</option>
                      <option value="SSN">SSN</option>
                    </select>
                    <input
                      placeholder={returnScanType === "SSN" ? "Book SSN number" : "Book QR or RFID value"}
                      value={returnScanValue}
                      onChange={(event) => {
                        setReturnScanValue(event.target.value);
                        setScanResult(null);
                        setIsScanResultOpen(false);
                      }}
                    />
                    <button type="submit" disabled={!returnBookValue}>
                      Check Copy
                    </button>
                  </form>
                  <QrScanner
                    label="Scan Book QR"
                    onDetected={(value) => {
                      setReturnScanType("QR");
                      setReturnScanValue(value);
                      void resolveBookCopy("QR", value);
                    }}
                  />
                </div>
              </div>

              <label className="inline-checkbox">
                <input
                  type="checkbox"
                  checked={returnResetFine}
                  onChange={(event) => setReturnResetFine(event.target.checked)}
                />
                Reset fine (Rs 0)
              </label>

              <div className="action-row issue-action-row">
                <button type="button" className="danger-button" disabled={!isStaffReturnReady} onClick={() => void handleStaffReturnByScan()}>
                  Return Book
                </button>
              </div>
              {!isStaffReturnReady && (
                <p className="issue-hint">Enter or scan both the borrower and the book identifiers to return.</p>
              )}
            </div>
          </article>
        )}

        {canIssueToStudents && (
          <article className="panel issue-panel">
            <div className="panel-title">
              <QrCode size={22} />
              <div>
                <h2>Renew Book</h2>
                <p>Scan borrower QR/roll number and book QR/SSN, then choose how many days to extend.</p>
              </div>
            </div>

            <div className="simple-scan-flow">
              <div className="issue-steps-grid">
                <div className="staff-issue-panel">
                  <h3><span className="step-badge">1</span> Borrower</h3>
                  <p>Enter roll number/staff code or scan borrower QR.</p>
                  <div className="staff-issue-grid">
                    <input
                      placeholder="Roll number or staff code"
                      value={renewBorrowerIdentifierType === "ROLL_NUMBER" ? renewBorrowerIdentifier : ""}
                      onChange={(event) => {
                        setRenewBorrowerIdentifierType("ROLL_NUMBER");
                        setRenewBorrowerIdentifier(event.target.value);
                        setRenewCheckedBorrower(null);
                      }}
                    />
                    <button
                      type="button"
                      disabled={!renewBorrowerValue}
                      onClick={() => void handleCheckRenewBorrower()}
                    >
                      Check Borrower
                    </button>
                  </div>
                  <QrScanner
                    label="Scan Borrower QR"
                    onDetected={(value) => {
                      setRenewBorrowerIdentifierType("QR_CREDENTIAL");
                      setRenewBorrowerIdentifier(value);
                      setRenewCheckedBorrower(null);
                    }}
                  />
                  {renewBorrowerIdentifierType === "QR_CREDENTIAL" && renewBorrowerIdentifier && (
                    <p className="scan-captured-note">Borrower QR captured from scanner. Click Check Borrower to verify.</p>
                  )}
                  {renewCheckedBorrower && (
                    <div className="checked-student-card">
                      <strong>{renewCheckedBorrower.fullName}</strong>
                      <span>
                        {renewCheckedBorrower.department}
                        {" · "}
                        {renewCheckedBorrower.roles.includes("FACULTY") ? "Staff Code" : "Roll Number"}
                        {" "}
                        {renewCheckedBorrower.identifiers.find((item) => item.type === "ROLL_NUMBER")?.value ?? "Not set"}
                      </span>
                    </div>
                  )}
                </div>

                <div className="staff-issue-panel">
                  <h3><span className="step-badge">2</span> Book</h3>
                  <p>Scan book QR or enter book QR/RFID/SSN.</p>
                  <form className="scan-form" onSubmit={(event) => void handleCheckRenewCopy(event)}>
                    <select value={renewScanType} onChange={(event) => setRenewScanType(event.target.value as ScanType)}>
                      <option value="QR">Book QR</option>
                      <option value="RFID">RFID Tag</option>
                      <option value="SSN">SSN</option>
                    </select>
                    <input
                      placeholder={renewScanType === "SSN" ? "Book SSN number" : "Book QR or RFID value"}
                      value={renewScanValue}
                      onChange={(event) => {
                        setRenewScanValue(event.target.value);
                        setScanResult(null);
                        setIsScanResultOpen(false);
                      }}
                    />
                    <button type="submit" disabled={!renewBookValue}>
                      Check Copy
                    </button>
                  </form>
                  <QrScanner
                    label="Scan Book QR"
                    onDetected={(value) => {
                      setRenewScanType("QR");
                      setRenewScanValue(value);
                      void resolveBookCopy("QR", value);
                    }}
                  />
                </div>
              </div>

              <label className="loan-days-field">
                Renew for (days)
                <input
                  type="number"
                  min={1}
                  value={renewLoanDays}
                  onChange={(event) => setRenewLoanDays(Number(event.target.value))}
                />
                <span className="list-note">Cannot exceed the book&apos;s maximum loan period.</span>
              </label>

              <div className="action-row issue-action-row">
                <button type="button" disabled={!isStaffRenewReady} onClick={() => void handleStaffRenewByScan()}>
                  Renew Book
                </button>
              </div>
              {!isStaffRenewReady && (
                <p className="issue-hint">Enter or scan both the borrower and the book identifiers to renew.</p>
              )}
            </div>
          </article>
        )}

        {canManageBooks && (
          <article className="panel">
            <div className="panel-title">
              <BookOpen size={22} />
              <div>
                <h2>All Issued Books</h2>
                <p>Open a table of every currently issued copy, with borrower and dates.</p>
              </div>
            </div>
            <button
              type="button"
              className="secondary-button directory-button"
              onClick={() => void handleOpenAllIssuedBooksWindow()}
            >
              Open Issued Books
            </button>
          </article>
        )}
      </section>

      {canShowManagement && (
      <section className="management-grid">
        {canShowUserRegistration && (
        <article className="panel registration-panel">
          <div className="panel-title">
            <Users size={22} />
            <div>
              <h2>User Registration</h2>
              <p>Only admin can register users and generate user QR codes.</p>
            </div>
          </div>

          <form className="management-form" onSubmit={handleRegisterUser}>
            <input
              placeholder="Full name"
              value={registrationForm.fullName}
              onChange={(event) => setRegistrationForm({ ...registrationForm, fullName: event.target.value })}
            />
            <input
              placeholder="Department"
              value={registrationForm.department}
              onChange={(event) => setRegistrationForm({ ...registrationForm, department: event.target.value })}
            />
            <input
              placeholder={codeLabelForRole(registrationForm.role)}
              value={registrationForm.rollNumber}
              onChange={(event) => setRegistrationForm({ ...registrationForm, rollNumber: event.target.value })}
            />
            <input
              placeholder="College email optional"
              value={registrationForm.collegeEmail}
              onChange={(event) => setRegistrationForm({ ...registrationForm, collegeEmail: event.target.value })}
            />
            {registrationForm.role !== "STUDENT" && (
              <input
                placeholder="Password / PIN"
                type="password"
                value={registrationForm.password ?? ""}
                onChange={(event) => setRegistrationForm({ ...registrationForm, password: event.target.value })}
              />
            )}
            <select
              value={registrationForm.role}
              onChange={(event) =>
                setRegistrationForm({
                  ...registrationForm,
                  role: event.target.value as UserRegistrationRequest["role"],
                  password: event.target.value === "STUDENT" ? "" : registrationForm.password
                })
              }
            >
              <option value="STUDENT">Student</option>
              {canManageLibrarians && <option value="FACULTY">Faculty</option>}
              {canManageLibrarians && <option value="LIBRARIAN">Librarian</option>}
              {canManageLibrarians && <option value="ADMIN">Admin</option>}
            </select>
            <button type="submit">Register User</button>
          </form>

          {canViewUserDirectory && (
            <button type="button" className="secondary-button directory-button" onClick={() => void handleOpenUserDirectory()}>
              Open {canManageLibrarians ? "User Directory" : isFaculty ? "Student And Librarian Directory" : "Student Directory"}
            </button>
          )}
          {canManageLibrarians && (
            <button type="button" className="secondary-button directory-button" onClick={handleOpenAuditLogs}>
              Open Audit Logs
            </button>
          )}
        </article>
        )}

        {canViewUserDirectory && !canShowUserRegistration && (
          <article className="panel registration-panel">
            <div className="panel-title">
              <Users size={22} />
              <div>
                <h2>Student Records</h2>
                <p>View student details and issued books without circulation actions.</p>
              </div>
            </div>
            <button type="button" className="secondary-button directory-button" onClick={() => void handleOpenUserDirectory()}>
              Open Student And Librarian Directory
            </button>
          </article>
        )}

        {canManageBooks && (
          <article className="panel">
            <div className="panel-title">
              <BookOpen size={22} />
              <div>
                <h2>Catalog Management</h2>
                <p>Only librarian and admin accounts can add or remove books.</p>
              </div>
            </div>

            <form className="management-form" onSubmit={handleAddBook}>
              <label>
                Book Title
                <input
                  placeholder="Example: Clean Code"
                  value={bookForm.title}
                  onChange={(event) => setBookForm({ ...bookForm, title: event.target.value })}
                />
              </label>
              <label>
                Author
                <input
                  placeholder="Example: Robert C. Martin"
                  value={bookForm.author}
                  onChange={(event) => setBookForm({ ...bookForm, author: event.target.value })}
                />
              </label>
              <label>
                SSN Number
                <input
                  required
                  placeholder="Example: 9780132350884"
                  value={bookForm.ssnNumber}
                  onChange={(event) => setBookForm({ ...bookForm, ssnNumber: event.target.value })}
                />
              </label>
              <label>
                Publisher
                <input
                  placeholder="Optional publisher name"
                  value={bookForm.publisher}
                  onChange={(event) => setBookForm({ ...bookForm, publisher: event.target.value })}
                />
              </label>
              <label>
                Category
                <input
                  placeholder="Example: Database, Programming"
                  value={bookForm.category}
                  onChange={(event) => setBookForm({ ...bookForm, category: event.target.value })}
                />
              </label>
              <label>
                Shelf Location
                <input
                  placeholder="Example: A1-R2-S3"
                  value={bookForm.shelfLocation}
                  onChange={(event) => setBookForm({ ...bookForm, shelfLocation: event.target.value })}
                />
              </label>
              <label>
                Fine Per Day
                <input
                  min={0}
                  placeholder="Amount in Rs after due date"
                  type="number"
                  value={bookForm.finePerDay}
                  onChange={(event) => setBookForm({ ...bookForm, finePerDay: Number(event.target.value) })}
                />
              </label>
              <label>
                Loan Period Days
                <input
                  max={14}
                  min={1}
                  placeholder="1 to 14 days"
                  type="number"
                  value={bookForm.loanPeriodDays}
                  onChange={(event) => setBookForm({ ...bookForm, loanPeriodDays: Number(event.target.value) })}
                />
              </label>
              <label>
                Number Of Copies
                <input
                  min={1}
                  placeholder="Physical copies to create"
                  type="number"
                  value={bookForm.copyCount}
                  onChange={(event) => setBookForm({ ...bookForm, copyCount: Number(event.target.value) })}
                />
              </label>
              <label className="inline-checkbox">
                <input
                  type="checkbox"
                  checked={generateQrAfterAdd}
                  onChange={(event) => setGenerateQrAfterAdd(event.target.checked)}
                />
                Generate QR codes after adding this book
              </label>
              <button type="submit">Add Book</button>
            </form>

            <div className="staff-issue-panel">
              <h3>Edit Book Copy Details</h3>
              <p>Load by exact copy SSN or copy QR, then update shared book details and this copy’s shelf location.</p>
              <div className="staff-issue-grid remove-copy-grid">
                <input
                  placeholder="Exact copy SSN number"
                  value={bookEditForm.ssnNumber}
                  onChange={(event) => setBookEditForm({ ...bookEditForm, ssnNumber: event.target.value })}
                />
                <button type="button" className="secondary-button" onClick={() => void handleLoadBookForEdit()}>
                  Load Copy
                </button>
              </div>
              <div className="staff-issue-grid remove-copy-grid">
                <input
                  placeholder="Example: BOOK-QR-9780132350884"
                  value={bookEditQrValue}
                  onChange={(event) => setBookEditQrValue(event.target.value)}
                />
                <button type="button" className="secondary-button" onClick={() => void handleLoadBookForEditByQr()}>
                  Load from QR
                </button>
              </div>
              <QrScanner
                label="Scan Copy QR"
                onDetected={(value) => {
                  setBookEditQrValue(value);
                }}
              />
              <form className="management-form" onSubmit={(event) => void handleUpdateBook(event)}>
                <label>
                  Copy SSN
                  <input readOnly value={bookEditForm.copySsnNumber} placeholder="Load a copy to see SSN" />
                </label>
                <label>
                  Catalog Book SSN
                  <input readOnly value={bookEditForm.bookSsnNumber} placeholder="Parent book SSN" />
                </label>
                <label>
                  Accession Number
                  <input readOnly value={bookEditForm.accessionNumber} placeholder="—" />
                </label>
                <label>
                  Copy Status
                  <input readOnly value={bookEditForm.status} placeholder="—" />
                </label>
                <label>
                  Shelf Location
                  <input
                    required
                    placeholder="Example: A1-R2-S3"
                    value={bookEditForm.shelfLocation}
                    onChange={(event) => setBookEditForm({ ...bookEditForm, shelfLocation: event.target.value })}
                  />
                </label>
                <label>
                  QR Value
                  <input readOnly value={bookEditForm.qrCodeValue} placeholder="—" />
                </label>
                <label>
                  Book Title
                  <input
                    required
                    value={bookEditForm.title}
                    onChange={(event) => setBookEditForm({ ...bookEditForm, title: event.target.value })}
                  />
                </label>
                <label>
                  Author
                  <input
                    required
                    value={bookEditForm.author}
                    onChange={(event) => setBookEditForm({ ...bookEditForm, author: event.target.value })}
                  />
                </label>
                <label>
                  Publisher
                  <input
                    value={bookEditForm.publisher ?? ""}
                    onChange={(event) => setBookEditForm({ ...bookEditForm, publisher: event.target.value })}
                  />
                </label>
                <label>
                  Category
                  <input
                    required
                    value={bookEditForm.category}
                    onChange={(event) => setBookEditForm({ ...bookEditForm, category: event.target.value })}
                  />
                </label>
                <label>
                  Fine Per Day
                  <input
                    min={0}
                    type="number"
                    value={bookEditForm.finePerDay}
                    onChange={(event) => setBookEditForm({ ...bookEditForm, finePerDay: Number(event.target.value) })}
                  />
                </label>
                <label>
                  Loan Period Days
                  <input
                    min={1}
                    max={14}
                    type="number"
                    value={bookEditForm.loanPeriodDays}
                    onChange={(event) => setBookEditForm({ ...bookEditForm, loanPeriodDays: Number(event.target.value) })}
                  />
                </label>
                <button type="submit">Save Copy Changes</button>
              </form>
            </div>

            {generatedBookQrs.length > 0 && (
              <div className="qr-window-launch">
                <div>
                  <strong>{generatedBookQrs.length} book QR code(s) generated</strong>
                  <span>Open them in a scrollable window to review and save copies.</span>
                </div>
                <button type="button" className="secondary-button" onClick={() => setIsBookQrWindowOpen(true)}>
                  Open Book QR Window
                </button>
              </div>
            )}

            <div className="staff-issue-panel">
              <h3>Remove Book By SSN</h3>
              <p>Enter the book SSN number to delete the book and all its copies from the database.</p>
              <div className="staff-issue-grid remove-copy-grid">
                <input
                  placeholder="Example: 9780132350884"
                  value={bookSsnToRemove}
                  onChange={(event) => setBookSsnToRemove(event.target.value)}
                />
                <button type="button" className="danger-button" onClick={() => void handleRemoveBookBySsn()}>
                  Delete Book
                </button>
              </div>
            </div>

            <div className="staff-issue-panel">
              <h3>Remove Existing Copy</h3>
              <p>Enter or scan the exact QR value for the physical copy to remove.</p>
              <div className="staff-issue-grid remove-copy-grid">
                <input
                  placeholder="Example: BOOK-QR-9780132350884"
                  value={bookCopyQrValue}
                  onChange={(event) => setBookCopyQrValue(event.target.value)}
                />
                <button type="button" className="danger-button" onClick={() => void handleRemoveBookCopyByQr()}>
                  Remove Copy
                </button>
              </div>
              <QrScanner
                label="Scan Copy QR"
                onDetected={(value) => {
                  setBookCopyQrValue(value);
                }}
              />
            </div>
          </article>
        )}

        {canManageBooks && (
          <article className="panel book-history-panel">
            <div className="panel-title">
              <Search size={22} />
              <div>
                <h2>Book Copy History</h2>
                <p>Librarian and admin can look up who borrowed a copy, issue/return dates, and fines.</p>
              </div>
            </div>

            <form className="scan-form book-history-form" onSubmit={(event) => void handleLookupBookHistory(event)}>
              <select
                value={bookHistoryScanType}
                onChange={(event) => setBookHistoryScanType(event.target.value as ScanType)}
              >
                <option value="QR">Book QR</option>
                <option value="RFID">RFID Tag</option>
                <option value="SSN">SSN</option>
              </select>
              <input
                placeholder={bookHistoryScanType === "SSN" ? "Book SSN number" : "Book QR or RFID value"}
                value={bookHistoryScanValue}
                onChange={(event) => {
                  setBookHistoryScanValue(event.target.value);
                  setBookCopyHistory(null);
                  setIsBookHistoryOpen(false);
                }}
              />
              <button type="submit">View History</button>
            </form>
            <QrScanner
              label="Scan Book QR For History"
              onDetected={(value) => {
                setBookHistoryScanType("QR");
                setBookHistoryScanValue(value);
                void handleLookupBookHistory(undefined, { type: "QR", value });
              }}
            />

            {bookCopyHistory && !isBookHistoryOpen && (
              <div className="scan-checked-bar">
                <span>
                  History loaded: <strong>{bookCopyHistory.title}</strong>
                </span>
                <button type="button" className="secondary-button" onClick={() => setIsBookHistoryOpen(true)}>
                  View details
                </button>
              </div>
            )}
          </article>
        )}
      </section>
      )}

      {isScanResultOpen && scanResult && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Scanned book copy"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsScanResultOpen(false);
            }
          }}
        >
          <div className="modal-panel scan-result-window">
            <div className="modal-header">
              <div>
                <h2>Scanned Book Copy</h2>
                <p>Details for the QR/RFID/SSN you just checked.</p>
              </div>
              <button type="button" className="secondary-button" onClick={() => setIsScanResultOpen(false)}>
                Close
              </button>
            </div>
            <div className="scan-result">
              <span className="badge">{scanResult.status}</span>
              <h3>{scanResult.title}</h3>
              <p>{scanResult.author}</p>
              <dl>
                <div>
                  <dt>SSN</dt>
                  <dd>{scanResult.ssnNumber}</dd>
                </div>
                <div>
                  <dt>Accession</dt>
                  <dd>{scanResult.accessionNumber}</dd>
                </div>
                <div>
                  <dt>Shelf</dt>
                  <dd>{scanResult.shelfLocation}</dd>
                </div>
                <div>
                  <dt>Max loan days</dt>
                  <dd>{scanResult.loanPeriodDays}</dd>
                </div>
              </dl>
            </div>
            <div className="action-row">
              <button type="button" onClick={() => setIsScanResultOpen(false)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {isBookHistoryOpen && bookCopyHistory && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Book copy history"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsBookHistoryOpen(false);
            }
          }}
        >
          <div className="modal-panel book-history-window">
            <div className="modal-header">
              <div>
                <h2>Book Copy History</h2>
                <p>Borrowers, issue/return dates, and fines for this copy.</p>
              </div>
              <button type="button" className="secondary-button" onClick={() => setIsBookHistoryOpen(false)}>
                Close
              </button>
            </div>
            <div className="book-history-result">
              <div className="scan-result">
                <span className="badge">{bookCopyHistory.status}</span>
                <h3>{bookCopyHistory.title}</h3>
                <p>{bookCopyHistory.author}</p>
                <dl>
                  <div>
                    <dt>SSN</dt>
                    <dd>{bookCopyHistory.ssnNumber}</dd>
                  </div>
                  <div>
                    <dt>Accession</dt>
                    <dd>{bookCopyHistory.accessionNumber}</dd>
                  </div>
                  <div>
                    <dt>Shelf</dt>
                    <dd>{bookCopyHistory.shelfLocation}</dd>
                  </div>
                </dl>
              </div>

              <div className="issued-list book-loan-history">
                <h3>Loan history</h3>
                {bookCopyHistory.loans.length === 0 ? (
                  <p>No issue or return records for this copy yet.</p>
                ) : (
                  bookCopyHistory.loans.map((loan) => (
                    <div key={loan.transactionId} className="book-row">
                      <div>
                        <strong>
                          {loan.borrowerName}
                          {loan.borrowerCode ? ` (${loan.borrowerCode})` : ""}
                        </strong>
                        <p>
                          Issued {formatDateTime(loan.issuedAt, loan.issuedOn)}
                          {" · Due "}
                          {loan.dueOn}
                          {loan.returnedOn || loan.returnedAt
                            ? ` · Returned ${formatDateTime(loan.returnedAt, loan.returnedOn)}`
                            : " · Not returned"}
                        </p>
                        <p>
                          Status {loan.status}
                          {" · Fine Rs "}
                          {loan.fineAmount}
                          {loan.overdueDays > 0 ? ` (${loan.overdueDays} overdue day(s))` : ""}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isCatalogWindowOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Full catalogue"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedTitleGroup(null);
              setIsCatalogWindowOpen(false);
            }
          }}
        >
          <div className="modal-panel full-catalog-window">
            <div className="modal-header">
              <div>
                <h2>Full Catalogue</h2>
                <p>Same titles are grouped and paginated. Click a row for SSN, author, publisher, and other details.</p>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setSelectedTitleGroup(null);
                  setIsCatalogWindowOpen(false);
                }}
              >
                Close
              </button>
            </div>

            <div className="catalog-filters">
              <label>
                Category
                <select value={catalogCategory} onChange={(event) => setCatalogCategory(event.target.value)}>
                  <option value="">All categories</option>
                  {bookCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Author
                <input
                  placeholder="Author starts with"
                  value={catalogAuthor}
                  onChange={(event) => setCatalogAuthor(event.target.value)}
                />
              </label>
              <label>
                Publisher
                <input
                  placeholder="Publisher starts with"
                  value={catalogPublisher}
                  onChange={(event) => setCatalogPublisher(event.target.value)}
                />
              </label>
              <label className="inline-checkbox catalog-availability-filter">
                <input
                  type="checkbox"
                  checked={catalogAvailableOnly}
                  onChange={(event) => setCatalogAvailableOnly(event.target.checked)}
                />
                Available only
              </label>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setCatalogPage(0);
                  void refreshCatalogBooks(catalogQuery, 0, catalogPageSize).catch((error) =>
                    setMessage(error instanceof Error ? error.message : "Catalog filter failed.")
                  );
                }}
              >
                Apply Filters
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setCatalogCategory("");
                  setCatalogAuthor("");
                  setCatalogPublisher("");
                  setCatalogAvailableOnly(false);
                  setCatalogPage(0);
                  void refreshCatalogBooks(catalogQuery, 0, catalogPageSize, {
                    category: "",
                    author: "",
                    publisher: "",
                    availableOnly: false
                  }).catch((error) => setMessage(error instanceof Error ? error.message : "Catalog filter failed."));
                }}
              >
                Clear Filters
              </button>
            </div>

            <form className="inline-form" onSubmit={handleCatalogWindowSearch}>
              <Search size={18} />
              <input
                placeholder="Search within filters"
                value={catalogQuery}
                onChange={(event) => setCatalogQuery(event.target.value)}
              />
              <button type="submit">Search</button>
            </form>

            <div className="book-list">
              {catalogLoading ? (
                <div className="empty-state">Loading catalogue titles…</div>
              ) : catalogBooks.length === 0 ? (
                <div className="empty-state">No books found.</div>
              ) : (
                catalogBooks.map((book) => (
                  <button
                    type="button"
                    className="book-row book-row-button"
                    key={book.title.toLowerCase()}
                    onClick={() => void handleOpenTitleDetails(book)}
                  >
                    <div>
                      <strong>{book.title}</strong>
                      <span>
                        {[book.author, book.category].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                    <div className="book-actions">
                      <span className="availability">{book.availableCopies}/{book.totalCopies} available</span>
                    </div>
                  </button>
                ))
              )}
            </div>
            <PaginationControls
              page={catalogPage}
              totalPages={catalogTotalPages}
              totalElements={catalogTotalElements}
              pageSize={catalogPageSize}
              label="titles"
              onPageChange={(nextPage) => {
                void refreshCatalogBooks(catalogQuery, nextPage, catalogPageSize).catch((error) =>
                  setMessage(error instanceof Error ? error.message : "Catalog page failed.")
                );
              }}
              onPageSizeChange={(size) => {
                setCatalogPageSize(size);
                setCatalogPage(0);
                void refreshCatalogBooks(catalogQuery, 0, size).catch((error) =>
                  setMessage(error instanceof Error ? error.message : "Catalog page failed.")
                );
              }}
            />
          </div>
        </div>
      )}

      {selectedTitleGroup && (
        <div
          className="modal-backdrop secondary-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedTitleGroup.title} details`}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedTitleGroup(null);
            }
          }}
        >
          <div className="modal-panel title-detail-window">
            <div className="modal-header">
              <div>
                <h2>{selectedTitleGroup.title}</h2>
                <p>
                  {selectedTitleGroup.copies.length > 0
                    ? selectedTitleGroup.copies.length
                    : selectedTitleGroup.totalCopies}{" "}
                  physical copies · {selectedTitleGroup.availableCopies}/{selectedTitleGroup.totalCopies} available
                </p>
              </div>
              <button type="button" className="secondary-button" onClick={() => setSelectedTitleGroup(null)}>
                Close
              </button>
            </div>

            <div className="title-detail-summary">
              <p>
                <strong>Author:</strong> {selectedTitleGroup.author || "—"}
              </p>
              <p>
                <strong>Publisher:</strong> {selectedTitleGroup.publisher || "—"}
              </p>
              <p>
                <strong>Category:</strong> {selectedTitleGroup.category || "—"}
              </p>
            </div>

            <div className="book-list title-edition-list">
              {titleDetailsLoading && selectedTitleGroup.copies.length === 0 ? (
                <div className="empty-state">Loading physical copies…</div>
              ) : selectedTitleGroup.copies.length === 0 ? (
                <div className="empty-state">No physical copies found for this title.</div>
              ) : (
                selectedTitleGroup.copies.map((copy) => (
                <div className="book-row title-edition-row" key={copy.copyId}>
                  <div>
                    <strong>SSN {copy.ssnNumber}</strong>
                    <span>
                      {[copy.author, copy.publisher, copy.category, copy.shelfLocation]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                  <div className="scan-result title-edition-details">
                    <dl>
                      <div>
                        <dt>Author</dt>
                        <dd>{copy.author || "—"}</dd>
                      </div>
                      <div>
                        <dt>Publisher</dt>
                        <dd>{copy.publisher || "—"}</dd>
                      </div>
                      <div>
                        <dt>Category</dt>
                        <dd>{copy.category || "—"}</dd>
                      </div>
                      <div>
                        <dt>Shelf</dt>
                        <dd>{copy.shelfLocation || "—"}</dd>
                      </div>
                      <div>
                        <dt>Accession</dt>
                        <dd>{copy.accessionNumber || "—"}</dd>
                      </div>
                      {canManageBooks && (
                        <div>
                          <dt>QR</dt>
                          <dd>{copy.qrCodeValue || "—"}</dd>
                        </div>
                      )}
                      <div>
                        <dt>Status</dt>
                        <dd>{copy.status}</dd>
                      </div>
                      <div>
                        <dt>Fine / day</dt>
                        <dd>{copy.finePerDay}</dd>
                      </div>
                      <div>
                        <dt>Loan days</dt>
                        <dd>{copy.loanPeriodDays}</dd>
                      </div>
                      <div>
                        <dt>Catalog SSN</dt>
                        <dd>{copy.bookSsnNumber}</dd>
                      </div>
                    </dl>
                    {canManageBooks && (
                      <div className="action-row" style={{ marginTop: "0.75rem" }}>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => void handleSaveQrForCopy(copy)}
                        >
                          Save QR
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
              )}
            </div>
          </div>
        </div>
      )}

      {isBookQrWindowOpen && generatedBookQrs.length > 0 && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Generated book QR codes"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsBookQrWindowOpen(false);
            }
          }}
        >
          <div className="modal-panel book-qr-window">
            <div className="modal-header">
              <div>
                <h2>Generated Book QR Codes</h2>
                <p>{generatedBookQrs.length} physical copy QR code(s). Scroll to review all copies.</p>
              </div>
              <button type="button" className="secondary-button" onClick={() => setIsBookQrWindowOpen(false)}>
                Close
              </button>
            </div>

            <div className="book-qr-scroll">
              <div className="book-qr-grid">
                {generatedBookQrs.map((copy) => (
                  <div className="qr-preview-card" key={copy.copyId}>
                    <strong>{copy.title}</strong>
                    <span>{copy.accessionNumber}</span>
                    <img src={copy.dataUrl} alt={`QR code for ${copy.accessionNumber}`} />
                    <code>{copy.qrCodeValue}</code>
                    <button type="button" onClick={() => handleDownloadBookQr(copy)}>
                      Save Book QR
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {canViewUserDirectory && isUserDirectoryOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="User directory"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              handleCloseUserDirectory();
            }
          }}
        >
          <div className="modal-panel">
            <div className="modal-header">
              <div>
                <h2>{canManageLibrarians ? "User Directory" : isFaculty ? "Student And Librarian Directory" : "Student Directory"}</h2>
                <p>Open a user to view details, issued books, and fines.</p>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={handleCloseUserDirectory}
              >
                Close
              </button>
            </div>

            <div className="modal-content-grid">
              <div className="user-list">
                <h3>{canManageLibrarians ? "Registered Users" : isFaculty ? "Students And Librarians" : "Students"}</h3>
                <form className="inline-form" onSubmit={(event) => void handleUserDirectorySearch(event)}>
                  <Search size={18} />
                  <input
                    placeholder="Search by name, roll number, or staff code"
                    value={userDirectoryQuery}
                    onChange={(event) => setUserDirectoryQuery(event.target.value)}
                  />
                  <button type="submit">Search</button>
                </form>
                {users.length === 0 ? (
                  <p>{userDirectoryQuery.trim() ? "No users match this search." : canManageLibrarians ? "No registered users found." : "No users found."}</p>
                ) : (
                  users.map((user) => (
                    <div className="compact-row" key={user.id}>
                      <div>
                        <strong>{user.fullName}</strong>
                        <span>
                          {user.roles.join(", ")} · {user.department}
                          {user.rollNumber
                            ? ` · ${codeLabelForRole(user.roles.includes("STUDENT") ? "STUDENT" : "STAFF")}: ${user.rollNumber}`
                            : ""}
                        </span>
                      </div>
                      <div className="compact-actions">
                        {canViewListedUser(user) && (
                          <button type="button" onClick={() => void handleViewUser(user)}>
                            View Details
                          </button>
                        )}
                        {canGenerateUserQr && (
                          <button type="button" onClick={() => void handleGenerateUserQr(user)}>
                            Generate QR
                          </button>
                        )}
                        {((user.roles.includes("STUDENT") && canManageStudents)
                          || (user.roles.includes("FACULTY") && canManageLibrarians)
                          || (user.roles.includes("LIBRARIAN") && canManageLibrarians)
                          || (user.roles.includes("ADMIN") && canManageLibrarians && user.id !== currentUser?.userId)) && (
                          <button type="button" className="danger-button" onClick={() => handleRemoveUser(user)}>
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
                <PaginationControls
                  page={userDirectoryPage}
                  totalPages={userDirectoryTotalPages}
                  totalElements={userDirectoryTotalElements}
                  pageSize={userDirectoryPageSize}
                  label="users"
                  onPageChange={(nextPage) => {
                    if (!currentUser) {
                      return;
                    }
                    void refreshUserDirectory(currentUser.userId, userDirectoryQuery, nextPage, userDirectoryPageSize).catch((error) =>
                      setMessage(error instanceof Error ? error.message : "User directory page failed.")
                    );
                  }}
                  onPageSizeChange={(size) => {
                    if (!currentUser) {
                      return;
                    }
                    setUserDirectoryPageSize(size);
                    setUserDirectoryPage(0);
                    void refreshUserDirectory(currentUser.userId, userDirectoryQuery, 0, size).catch((error) =>
                      setMessage(error instanceof Error ? error.message : "User directory page failed.")
                    );
                  }}
                />
              </div>

              <div>
                {selectedUserDetails ? (
                  <div className="student-detail-card">
                    <h3>{selectedUserDetails.fullName}</h3>
                    {isEditingUser && canManageLibrarians ? (
                      <form className="management-form" onSubmit={handleUpdateUser}>
                        <label>
                          Full name
                          <input
                            required
                            value={userEditForm.fullName}
                            onChange={(event) => setUserEditForm({ ...userEditForm, fullName: event.target.value })}
                          />
                        </label>
                        <label>
                          Department
                          <input
                            required
                            value={userEditForm.department}
                            onChange={(event) => setUserEditForm({ ...userEditForm, department: event.target.value })}
                          />
                        </label>
                        <label>
                          {codeLabelForRole(userEditForm.role)}
                          <input
                            required
                            value={userEditForm.rollNumber}
                            onChange={(event) => setUserEditForm({ ...userEditForm, rollNumber: event.target.value })}
                          />
                        </label>
                        <label>
                          College email optional
                          <input
                            value={userEditForm.collegeEmail ?? ""}
                            onChange={(event) => setUserEditForm({ ...userEditForm, collegeEmail: event.target.value })}
                          />
                        </label>
                        <label>
                          New password optional
                          <input
                            type="password"
                            placeholder="Leave blank to keep current password"
                            value={userEditForm.password ?? ""}
                            onChange={(event) => setUserEditForm({ ...userEditForm, password: event.target.value })}
                          />
                        </label>
                        <label>
                          Role
                          <select
                            value={userEditForm.role}
                            onChange={(event) =>
                              setUserEditForm({
                                ...userEditForm,
                                role: event.target.value as UserUpdateRequest["role"]
                              })
                            }
                          >
                            <option value="STUDENT">Student</option>
                            <option value="FACULTY">Faculty</option>
                            <option value="LIBRARIAN">Librarian</option>
                            <option value="ADMIN">Admin</option>
                          </select>
                        </label>
                        <div className="action-row">
                          <button type="submit">Save Changes</button>
                          <button type="button" className="secondary-button" onClick={() => setIsEditingUser(false)}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <dl className="details-list">
                          <div>
                            <dt>Department</dt>
                            <dd>{selectedUserDetails.department}</dd>
                          </div>
                          <div>
                            <dt>Role</dt>
                            <dd>{selectedUserDetails.roles.join(", ")}</dd>
                          </div>
                          {selectedUserDetails.identifiers.filter((identifierItem) => identifierItem.type === "ROLL_NUMBER").map((identifierItem) => (
                            <div key={`${identifierItem.type}-${identifierItem.value}`}>
                              <dt>{formatIdentifierLabel(identifierItem.type, selectedUserDetails.roles)}</dt>
                              <dd>{identifierItem.value}</dd>
                            </div>
                          ))}
                          {selectedUserDetails.identifiers.filter((identifierItem) => identifierItem.type === "COLLEGE_EMAIL").map((identifierItem) => (
                            <div key={`${identifierItem.type}-${identifierItem.value}`}>
                              <dt>College Email</dt>
                              <dd>{identifierItem.value}</dd>
                            </div>
                          ))}
                        </dl>

                        <div className="action-row">
                          {canManageLibrarians && !selectedUserDetails.roles.includes("SUPER_ADMIN") && (
                            <button type="button" onClick={handleStartEditUser}>
                              Edit User
                            </button>
                          )}
                          {canViewIssuedBooksFor(selectedUserDetails) && (
                            <button type="button" className="secondary-button view-issued-button" onClick={() => void handleOpenIssuedBooks()}>
                              View Issued Books
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="empty-state">Select a user to view details.</div>
                )}

                {generatedQr && (
                  <div className="qr-preview-card">
                    <strong>{generatedQr.fullName}</strong>
                    <img src={generatedQr.dataUrl} alt={`QR code for ${generatedQr.fullName}`} />
                    <code>{generatedQr.value}</code>
                    <button type="button" onClick={handleDownloadQr}>
                      Save QR Locally
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isAllIssuedBooksWindowOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="All issued books"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsAllIssuedBooksWindowOpen(false);
            }
          }}
        >
          <div className="modal-panel all-issued-books-window">
            <div className="modal-header">
              <div>
                <h2>All Issued Books</h2>
                <p>Currently issued copies across students and faculty.</p>
              </div>
              <button type="button" className="secondary-button" onClick={() => setIsAllIssuedBooksWindowOpen(false)}>
                Close
              </button>
            </div>

            <div className="issued-books-table-wrap">
              {allIssuedBooks.length === 0 ? (
                <p className="empty-state">No books are currently issued.</p>
              ) : (
                <table className="issued-books-table">
                  <thead>
                    <tr>
                      <th>Book SSN</th>
                      <th>Book name</th>
                      <th>Roll / Staff code</th>
                      <th>Username</th>
                      <th>Issue date</th>
                      <th>Return date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allIssuedBooks.map((book) => (
                      <tr key={book.transactionId}>
                        <td>{book.ssnNumber}</td>
                        <td>{book.bookTitle}</td>
                        <td>{book.borrowerCode ?? "—"}</td>
                        <td>{book.borrowerName}</td>
                        <td>{formatDateTime(book.issuedAt, book.issuedOn)}</td>
                        <td>{book.dueOn}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <PaginationControls
              page={allIssuedPage}
              totalPages={allIssuedTotalPages}
              totalElements={allIssuedTotalElements}
              pageSize={allIssuedPageSize}
              label="issued books"
              onPageChange={(nextPage) => {
                void refreshAllIssuedBooks(nextPage, allIssuedPageSize).catch((error) =>
                  setMessage(error instanceof Error ? error.message : "Unable to load issued books.")
                );
              }}
              onPageSizeChange={(size) => {
                setAllIssuedPageSize(size);
                setAllIssuedPage(0);
                void refreshAllIssuedBooks(0, size).catch((error) =>
                  setMessage(error instanceof Error ? error.message : "Unable to load issued books.")
                );
              }}
            />
          </div>
        </div>
      )}

      {isIssuedBooksWindowOpen && selectedUserDetails && (
        <div
          className="modal-backdrop secondary-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Issued books"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsIssuedBooksWindowOpen(false);
            }
          }}
        >
          <div className="modal-panel issued-books-window">
            <div className="modal-header">
              <div>
                <h2>Issued Books</h2>
                <p>{selectedUserDetails.fullName}</p>
              </div>
              <button type="button" className="secondary-button" onClick={() => setIsIssuedBooksWindowOpen(false)}>
                Close
              </button>
            </div>

            <div className="issued-list">
              <div className="total-fine">Total Fine: Rs {selectedUserTotalFine}</div>
              {selectedUserIssuedBooks.length === 0 ? (
                <p>No books are currently issued to this user.</p>
              ) : (
                selectedUserIssuedBooks.map((book) => (
                  <div className="compact-row" key={book.transactionId}>
                    <div>
                      <strong>{book.bookTitle}</strong>
                      <span>
                        {book.accessionNumber}
                        {" · Issued "}
                        {formatDateTime(book.issuedAt, book.issuedOn)}
                        {" · Due "}
                        {book.dueOn}
                        {book.returnedOn || book.returnedAt
                          ? ` · Returned ${formatDateTime(book.returnedAt, book.returnedOn)}`
                          : " · Not returned"}
                        {" · Loan "}
                        {book.loanDays}
                        {" days · "}
                        {book.overdueDays}
                        {" overdue days · Rs "}
                        {book.finePerDay}
                        /day
                      </span>
                    </div>
                    <div className="issued-book-actions">
                      <span className="availability">Fine Rs {book.fineAmount}</span>
                      {canIssueToStudents && (
                        <div className="renew-panel">
                          <div className="renew-panel-controls">
                            <label htmlFor={`renew-days-${book.transactionId}`}>Extend by</label>
                            <input
                              id={`renew-days-${book.transactionId}`}
                              type="number"
                              min={1}
                              max={book.loanPeriodDays}
                              value={renewDaysByTransaction[book.transactionId] ?? Math.min(7, book.loanPeriodDays)}
                              onChange={(event) =>
                                setRenewDaysByTransaction((current) => ({
                                  ...current,
                                  [book.transactionId]: Number(event.target.value)
                                }))
                              }
                            />
                            <span>days · max {book.loanPeriodDays}</span>
                          </div>
                          <button type="button" onClick={() => void handleRenewIssuedBook(book)}>
                            Renew loan
                          </button>
                        </div>
                      )}
                      {canIssueToStudents && (
                        <div className="return-panel">
                          {book.fineAmount > 0 && (
                            <label className="inline-checkbox">
                              <input
                                type="checkbox"
                                checked={resetFineOnReturn[book.transactionId] ?? false}
                                onChange={(event) =>
                                  setResetFineOnReturn((current) => ({
                                    ...current,
                                    [book.transactionId]: event.target.checked
                                  }))
                                }
                              />
                              Reset fine (Rs 0)
                            </label>
                          )}
                          <button type="button" className="danger-button" onClick={() => void handleReturnIssuedBook(book)}>
                            Return book
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {isAuditLogsOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Audit logs"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              handleCloseAuditLogs();
            }
          }}
        >
          <div className="modal-panel issued-books-window">
            <div className="modal-header">
              <div>
                <h2>Audit Logs</h2>
                <p>Set filters, then click Show Logs to view matching activity.</p>
              </div>
              <button type="button" className="secondary-button" onClick={handleCloseAuditLogs}>
                Close
              </button>
            </div>

            <form className="inline-form audit-date-filter" onSubmit={handleFilterAuditLogs}>
              <label>
                From
                <input
                  type="date"
                  value={auditFromDate}
                  onChange={(event) => setAuditFromDate(event.target.value)}
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  value={auditToDate}
                  onChange={(event) => setAuditToDate(event.target.value)}
                />
              </label>
              <label>
                Type
                <select value={auditActionFilter} onChange={(event) => setAuditActionFilter(event.target.value)}>
                  {AUDIT_ACTION_OPTIONS.map((option) => (
                    <option key={option.value || "all"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit">Show Logs</button>
            </form>

            <div className="issued-list">
              {!auditLogsLoaded ? (
                <p>Choose From, To, and Type, then click Show Logs.</p>
              ) : auditEvents.length === 0 ? (
                <p>No audit events found for this filter.</p>
              ) : (
                auditEvents.map((event) => (
                  <div className="compact-row" key={event.id}>
                    <div>
                      <strong>{event.actionLabel}</strong>
                      <span>{event.summary}</span>
                      <span>{new Date(event.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="compact-actions">
                      <span className="availability">By {event.doneBy}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            {auditLogsLoaded && (
              <PaginationControls
                page={auditPage}
                totalPages={auditTotalPages}
                totalElements={auditTotalElements}
                pageSize={auditPageSize}
                label="events"
                onPageChange={(nextPage) => {
                  if (!currentUser) {
                    return;
                  }
                  void refreshAuditLogs(currentUser.userId, nextPage, auditPageSize).catch((error) =>
                    setMessage(error instanceof Error ? error.message : "Audit page failed.")
                  );
                }}
                onPageSizeChange={(size) => {
                  if (!currentUser) {
                    return;
                  }
                  setAuditPageSize(size);
                  setAuditPage(0);
                  void refreshAuditLogs(currentUser.userId, 0, size).catch((error) =>
                    setMessage(error instanceof Error ? error.message : "Audit page failed.")
                  );
                }}
              />
            )}
          </div>
        </div>
      )}

      <footer className="copyright-footer">
        © {COPYRIGHT_YEAR} Soumya Yadav and Abhinav Srivastav. All rights reserved.
      </footer>
    </main>
  );
}
