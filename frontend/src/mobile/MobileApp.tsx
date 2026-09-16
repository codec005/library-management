import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import {
  BookOpen,
  CheckCircle2,
  ClipboardList,
  History,
  Library,
  LogOut,
  MoreHorizontal,
  RefreshCw,
  Search,
  Settings,
  Undo2,
  UserPlus,
  UserRound,
  Users,
  XCircle
} from "lucide-react";
import QRCode from "qrcode";
import QrScanner from "../QrScanner";
import {
  AuditEventResponse,
  BookCopyHistoryResponse,
  BookCopyScanResponse,
  BookCopySummary,
  BookCreateRequest,
  CirculationResponse,
  GroupedBookSummary,
  IdentifierType,
  LoginResponse,
  ScanType,
  UserDetailsResponse,
  UserRegistrationRequest,
  UserSummary,
  UserUpdateRequest,
  addBook,
  changeOwnPassword,
  clearAccessToken,
  clearOutstandingFine,
  getAppSettings,
  getBookCopyByQrCode,
  getBookCopyBySsn,
  getBookCopyHistory,
  getBranding,
  getStudentDetailsByIdentifier,
  getUserDetails,
  getUserQrCredential,
  issueBookByIdentifier,
  issueBookCopy,
  listAllIssuedBooks,
  listAuditEvents,
  listBookCategories,
  listBookCopies,
  listCopiesByTitle,
  listIssuedBooksForUser,
  listUsers,
  login,
  registerUser,
  removeBookCopyByQrCode,
  removeBookCopyBySsn,
  removeUser,
  renewBookByIdentifier,
  renewTransaction,
  resetUserPassword,
  returnBookByIdentifier,
  scanBookCopy,
  scanLogin,
  searchBooks,
  searchGroupedBooks,
  updateAppSettings,
  updateBook,
  updateBookCopyBySsn,
  updateBranding,
  updateUser
} from "../api";

const SESSION_TIMEOUT_MS = 15 * 60 * 1000;
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

type MessageTone = "success" | "error" | "info";
type GuestTab = "student" | "staff";
type StaffTab = "issue" | "return" | "renew" | "catalog" | "more";
type BorrowerTab = "catalog" | "books" | "account";
type MoreScreen =
  | "hub"
  | "settings"
  | "register"
  | "users"
  | "books"
  | "fines"
  | "issued"
  | "history"
  | "audit"
  | "account";
type BooksSubTab = "add" | "edit" | "remove";

const AUDIT_ACTION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "All types" },
  { value: "PASSWORD_LOGIN", label: "Password login" },
  { value: "SCAN_LOGIN", label: "Scan login" },
  { value: "USER_REGISTER", label: "User registered" },
  { value: "USER_REMOVE", label: "User deleted" },
  { value: "USER_UPDATE", label: "User updated" },
  { value: "USER_QR_GENERATE", label: "User QR generated" },
  { value: "PASSWORD_CHANGE", label: "Password changed" },
  { value: "BOOK_ADD", label: "Book added" },
  { value: "BOOK_UPDATE", label: "Book updated" },
  { value: "BOOK_REMOVE", label: "Book removed" },
  { value: "BOOK_SCAN", label: "Book scan" },
  { value: "BOOK_ISSUE", label: "Book issued" },
  { value: "BOOK_RETURN", label: "Book returned" },
  { value: "BOOK_RENEW", label: "Book renewed" }
];

let draftIdCounter = 0;
function createDraftId() {
  draftIdCounter += 1;
  return `draft-${draftIdCounter}-${Date.now()}`;
}

function statusToneClass(status: string) {
  const normalized = status.trim().toUpperCase();
  if (normalized === "AVAILABLE") {
    return "m-status-available";
  }
  if (normalized === "ISSUED") {
    return "m-status-issued";
  }
  return "";
}

function rollNumberFromStudentQr(value: string) {
  const trimmed = value.trim();
  const withRandom = /^USER-QR-(.+)-([A-Fa-f0-9]{32})$/i.exec(trimmed);
  if (withRandom?.[1]) {
    return withRandom[1].trim();
  }
  const legacy = /^USER-QR-(.+)$/i.exec(trimmed);
  if (legacy?.[1]) {
    return legacy[1].trim();
  }
  const colonFormat = /^QR:([^:]+):[A-Fa-f0-9]+$/i.exec(trimmed);
  return colonFormat?.[1]?.trim() || trimmed;
}

function formatTimer(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function downloadDataUrl(dataUrl: string, fileName: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  link.click();
}

function formatDateTime(value?: string | null, fallbackDate?: string | null) {
  if (value) {
    return new Date(value).toLocaleString();
  }
  return fallbackDate ?? "—";
}

export default function MobileApp() {
  const [collegeName, setCollegeName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [studentPasswordRequired, setStudentPasswordRequired] = useState(false);
  const [currentUser, setCurrentUser] = useState<LoginResponse | null>(null);
  const [sessionRemainingSeconds, setSessionRemainingSeconds] = useState<number | null>(null);
  const [message, setMessageText] = useState("");
  const [messageTone, setMessageTone] = useState<MessageTone>("info");

  const [guestTab, setGuestTab] = useState<GuestTab>("student");
  const [staffTab, setStaffTab] = useState<StaffTab>("issue");
  const [borrowerTab, setBorrowerTab] = useState<BorrowerTab>("catalog");
  const [moreScreen, setMoreScreen] = useState<MoreScreen>("hub");
  const [booksSubTab, setBooksSubTab] = useState<BooksSubTab>("add");

  const [studentRoll, setStudentRoll] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [staffIdentifierType, setStaffIdentifierType] = useState<IdentifierType>("ROLL_NUMBER");
  const [staffIdentifier, setStaffIdentifier] = useState("");
  const [staffPassword, setStaffPassword] = useState("");

  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogCategory, setCatalogCategory] = useState("");
  const [catalogAuthor, setCatalogAuthor] = useState("");
  const [catalogAvailableOnly, setCatalogAvailableOnly] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [catalogBooks, setCatalogBooks] = useState<GroupedBookSummary[]>([]);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [titleCopies, setTitleCopies] = useState<BookCopySummary[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const [myBooks, setMyBooks] = useState<CirculationResponse[]>([]);
  const [renewDaysByTx, setRenewDaysByTx] = useState<Record<string, number>>({});

  const [borrowerIdType, setBorrowerIdType] = useState<IdentifierType>("ROLL_NUMBER");
  const [borrowerId, setBorrowerId] = useState("");
  const [bookScanType, setBookScanType] = useState<ScanType>("QR");
  const [bookScanValue, setBookScanValue] = useState("");
  const [issueDays, setIssueDays] = useState(14);
  const [returnResetFine, setReturnResetFine] = useState(false);
  const [renewDays, setRenewDays] = useState(7);

  const [selfScanType, setSelfScanType] = useState<ScanType>("QR");
  const [selfScanValue, setSelfScanValue] = useState("");
  const [selfScanResult, setSelfScanResult] = useState<BookCopyScanResponse | null>(null);
  const [selfIssueDays, setSelfIssueDays] = useState(14);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [settingsCollegeName, setSettingsCollegeName] = useState("");
  const [settingsLogoPreview, setSettingsLogoPreview] = useState("");

  const [registrationForm, setRegistrationForm] = useState<UserRegistrationRequest>({
    fullName: "",
    department: "",
    rollNumber: "",
    collegeEmail: "",
    password: "",
    role: "STUDENT"
  });

  const [users, setUsers] = useState<UserSummary[]>([]);
  const [userDirectoryQuery, setUserDirectoryQuery] = useState("");
  const [userDirectoryPage, setUserDirectoryPage] = useState(0);
  const [userDirectoryPageSize, setUserDirectoryPageSize] = useState<PageSize>(10);
  const [userDirectoryTotalPages, setUserDirectoryTotalPages] = useState(0);
  const [userDirectoryTotalElements, setUserDirectoryTotalElements] = useState(0);
  const [selectedUserDetails, setSelectedUserDetails] = useState<UserDetailsResponse | null>(null);
  const [selectedUserIssuedBooks, setSelectedUserIssuedBooks] = useState<CirculationResponse[]>([]);
  const [showUserIssued, setShowUserIssued] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [userEditForm, setUserEditForm] = useState<UserUpdateRequest>({
    fullName: "",
    department: "",
    rollNumber: "",
    collegeEmail: "",
    password: "",
    role: "STUDENT"
  });
  const [generatedQr, setGeneratedQr] = useState<{ fullName: string; dataUrl: string; value: string } | null>(null);
  const [passwordResetUser, setPasswordResetUser] = useState<UserSummary | null>(null);
  const [adminNewPassword, setAdminNewPassword] = useState("");
  const [adminConfirmPassword, setAdminConfirmPassword] = useState("");

  const [clearFinesLookupType, setClearFinesLookupType] = useState<"ROLL_NUMBER" | "QR_CREDENTIAL">("ROLL_NUMBER");
  const [clearFinesLookupValue, setClearFinesLookupValue] = useState("");
  const [clearFinesBorrower, setClearFinesBorrower] = useState<UserDetailsResponse | null>(null);
  const [clearFinesBooks, setClearFinesBooks] = useState<CirculationResponse[]>([]);

  const [allIssuedBooks, setAllIssuedBooks] = useState<CirculationResponse[]>([]);
  const [allIssuedPage, setAllIssuedPage] = useState(0);
  const [allIssuedPageSize, setAllIssuedPageSize] = useState<PageSize>(10);
  const [allIssuedTotalPages, setAllIssuedTotalPages] = useState(0);
  const [allIssuedTotalElements, setAllIssuedTotalElements] = useState(0);

  const [bookForm, setBookForm] = useState({
    title: "",
    author: "",
    publisher: "",
    category: "",
    finePerDay: 5,
    loanPeriodDays: 14
  });
  const [bookCopyDrafts, setBookCopyDrafts] = useState<Array<{ id: string; ssnNumber: string; shelfLocation: string }>>([
    { id: createDraftId(), ssnNumber: "", shelfLocation: "" }
  ]);
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
  const [removeCopyMethod, setRemoveCopyMethod] = useState<"QR" | "SSN">("QR");
  const [bookCopyQrValue, setBookCopyQrValue] = useState("");
  const [bookCopySsnToRemove, setBookCopySsnToRemove] = useState("");

  const [bookHistoryScanType, setBookHistoryScanType] = useState<ScanType>("SSN");
  const [bookHistoryScanValue, setBookHistoryScanValue] = useState("");
  const [bookCopyHistory, setBookCopyHistory] = useState<BookCopyHistoryResponse | null>(null);

  const [auditEvents, setAuditEvents] = useState<AuditEventResponse[]>([]);
  const [auditPage, setAuditPage] = useState(0);
  const [auditPageSize, setAuditPageSize] = useState<PageSize>(10);
  const [auditTotalPages, setAuditTotalPages] = useState(0);
  const [auditTotalElements, setAuditTotalElements] = useState(0);
  const [auditFromDate, setAuditFromDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().slice(0, 10);
  });
  const [auditToDate, setAuditToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [auditActionFilter, setAuditActionFilter] = useState("");
  const [auditLogsLoaded, setAuditLogsLoaded] = useState(false);

  const activeRole = currentUser?.roles[0] ?? "Guest";
  const isStudent = currentUser?.roles.includes("STUDENT") ?? false;
  const isFaculty = currentUser?.roles.includes("FACULTY") ?? false;
  const canManageStudents =
    currentUser?.roles.some((role) => ["LIBRARIAN", "ADMIN", "SUPER_ADMIN"].includes(role)) ?? false;
  const canManageLibrarians =
    currentUser?.roles.some((role) => ["ADMIN", "SUPER_ADMIN"].includes(role)) ?? false;
  const canManageBooks =
    currentUser?.roles.some((role) => ["LIBRARIAN", "ADMIN", "SUPER_ADMIN"].includes(role)) ?? false;
  const canIssueToStudents = canManageBooks;
  const canManageCollegeBranding =
    currentUser?.roles.some((role) => ["ADMIN", "SUPER_ADMIN"].includes(role)) ?? false;
  const canViewUserDirectory = canManageStudents || isFaculty;
  const canRegisterUsers = canManageLibrarians;
  const canChangeOwnPassword =
    (currentUser?.roles.some((role) => ["FACULTY", "LIBRARIAN", "ADMIN", "SUPER_ADMIN"].includes(role)) ?? false)
    || (isStudent && studentPasswordRequired);
  const canViewStudentRecords =
    currentUser?.roles.some((role) => ["FACULTY", "LIBRARIAN", "ADMIN", "SUPER_ADMIN"].includes(role)) ?? false;
  const canCirculate = canIssueToStudents;
  const isBorrower = isStudent || isFaculty;

  function setMessage(text: string, tone: MessageTone = "info") {
    setMessageTone(text ? tone : "info");
    setMessageText(text);
  }

  useEffect(() => {
    void (async () => {
      try {
        const branding = await getBranding();
        setCollegeName(branding.collegeName || "");
        setLogoUrl(branding.logoUrl || "");
        setSettingsCollegeName(branding.collegeName || "");
        setSettingsLogoPreview(branding.logoUrl || "");
      } catch {
        // Keep defaults when branding is unavailable.
      }
      try {
        const settings = await getAppSettings();
        setStudentPasswordRequired(settings.studentPasswordRequired);
      } catch {
        // Keep defaults.
      }
      try {
        setCategories(await listBookCategories());
      } catch {
        setCategories([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setSessionRemainingSeconds(null);
      return;
    }

    const isHardTimeout = isStudent;
    let expiresAt = Date.now() + SESSION_TIMEOUT_MS;

    function expireSession() {
      clearAccessToken();
      setCurrentUser(null);
      setMyBooks([]);
      setMessage("Session timed out after 15 minutes. Please sign in again.", "error");
    }

    let timeoutId = window.setTimeout(expireSession, SESSION_TIMEOUT_MS);
    setSessionRemainingSeconds(Math.ceil(SESSION_TIMEOUT_MS / 1000));

    const tickId = window.setInterval(() => {
      setSessionRemainingSeconds(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    }, 1000);

    function bump() {
      if (isHardTimeout) {
        return;
      }
      expiresAt = Date.now() + SESSION_TIMEOUT_MS;
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(expireSession, SESSION_TIMEOUT_MS);
      setSessionRemainingSeconds(Math.ceil(SESSION_TIMEOUT_MS / 1000));
    }

    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart"];
    events.forEach((eventName) => window.addEventListener(eventName, bump, { passive: true }));

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(tickId);
      events.forEach((eventName) => window.removeEventListener(eventName, bump));
    };
  }, [currentUser, isStudent]);

  const sessionLabel = useMemo(() => {
    if (sessionRemainingSeconds == null) {
      return "";
    }
    return formatTimer(sessionRemainingSeconds);
  }, [sessionRemainingSeconds]);

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

  async function afterLogin(user: LoginResponse, welcome: string) {
    setCurrentUser(user);
    setStudentRoll("");
    setStudentPassword("");
    setStaffIdentifier("");
    setStaffPassword("");
    setMoreScreen("hub");
    if (user.roles.includes("STUDENT") || user.roles.includes("FACULTY")) {
      const staffLike = user.roles.some((role) => ["LIBRARIAN", "ADMIN", "SUPER_ADMIN"].includes(role));
      if (!staffLike) {
        setBorrowerTab("catalog");
      } else {
        setStaffTab("issue");
      }
      try {
        setMyBooks(await listIssuedBooksForUser(user.userId, user.userId));
      } catch {
        setMyBooks([]);
      }
    } else {
      setStaffTab("issue");
    }
    setMessage(welcome, "success");
  }

  async function handleStudentLogin(event: FormEvent) {
    event.preventDefault();
    const roll = studentRoll.trim();
    if (!roll) {
      setMessage("Enter or scan your roll number first.", "error");
      return;
    }
    if (!studentPassword) {
      setMessage("Enter your password.", "error");
      return;
    }
    try {
      const user = await login("ROLL_NUMBER", roll, studentPassword, false);
      await afterLogin(user, `Welcome, ${user.fullName}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Student login failed.", "error");
    }
  }

  async function handleStudentQr(value: string) {
    if (studentPasswordRequired) {
      setStudentRoll(rollNumberFromStudentQr(value));
      setMessage("Roll number filled from QR. Enter your password.", "info");
      return;
    }
    try {
      const user = await scanLogin("QR_CREDENTIAL", value.trim());
      await afterLogin(user, `QR login approved for ${user.fullName}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "QR login failed.", "error");
    }
  }

  async function handleStaffLogin(event: FormEvent) {
    event.preventDefault();
    if (!staffIdentifier.trim() || !staffPassword) {
      setMessage("Enter staff ID and password.", "error");
      return;
    }
    try {
      const user = await login(staffIdentifierType, staffIdentifier.trim(), staffPassword, true);
      await afterLogin(user, `Welcome, ${user.fullName}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Staff login failed.", "error");
    }
  }

  function handleLogout() {
    clearAccessToken();
    setCurrentUser(null);
    setMyBooks([]);
    setSelectedTitle(null);
    setTitleCopies([]);
    setMoreScreen("hub");
    setSelectedUserDetails(null);
    setMessage("Signed out.", "info");
  }

  async function runCatalogSearch() {
    setCatalogLoading(true);
    setSelectedTitle(null);
    setTitleCopies([]);
    try {
      const page = await searchGroupedBooks(catalogQuery.trim(), {
        availableOnly: catalogAvailableOnly,
        category: catalogCategory,
        author: catalogAuthor,
        page: 0,
        size: 30
      });
      setCatalogBooks(page.content);
      if (page.content.length === 0) {
        setMessage("No titles matched your search.", "info");
      }
    } catch (error) {
      setCatalogBooks([]);
      setMessage(error instanceof Error ? error.message : "Catalog search failed.", "error");
    } finally {
      setCatalogLoading(false);
    }
  }

  async function openTitle(title: string) {
    setSelectedTitle(title);
    try {
      setTitleCopies(await listCopiesByTitle(title));
    } catch (error) {
      setTitleCopies([]);
      setMessage(error instanceof Error ? error.message : "Unable to load copies.", "error");
    }
  }

  async function refreshMyBooks() {
    if (!currentUser) {
      return;
    }
    try {
      setMyBooks(await listIssuedBooksForUser(currentUser.userId, currentUser.userId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load issued books.", "error");
    }
  }

  async function handleRenewMyBook(book: CirculationResponse) {
    if (!currentUser) {
      return;
    }
    const days = renewDaysByTx[book.transactionId] ?? Math.min(7, book.loanPeriodDays);
    try {
      const updated = await renewTransaction(book.transactionId, currentUser.userId, days);
      await refreshMyBooks();
      setMessage(`${updated.bookTitle} renewed until ${updated.dueOn}.`, "success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Renewal failed.", "error");
    }
  }

  async function handleChangePassword(event: FormEvent) {
    event.preventDefault();
    if (!currentUser || !canChangeOwnPassword) {
      return;
    }
    if (!oldPassword || !newPassword) {
      setMessage("Enter current and new password.", "error");
      return;
    }
    if (newPassword.trim().length < 4) {
      setMessage("New password must be at least 4 characters.", "error");
      return;
    }
    try {
      await changeOwnPassword(oldPassword, newPassword.trim(), currentUser.userId);
      setOldPassword("");
      setNewPassword("");
      setMessage("Password updated.", "success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Password change failed.", "error");
    }
  }

  async function handleIssue() {
    if (!currentUser) {
      return;
    }
    if (!borrowerId.trim() || !bookScanValue.trim()) {
      setMessage("Enter borrower ID and book scan value.", "error");
      return;
    }
    try {
      const tx = await issueBookByIdentifier(
        currentUser.userId,
        borrowerIdType,
        borrowerId.trim(),
        bookScanType,
        bookScanValue.trim(),
        issueDays
      );
      setMessage(`${tx.bookTitle} issued to ${tx.borrowerName}. Due ${tx.dueOn}.`, "success");
      setBookScanValue("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Issue failed.", "error");
    }
  }

  async function handleReturn() {
    if (!currentUser) {
      return;
    }
    if (!borrowerId.trim() || !bookScanValue.trim()) {
      setMessage("Enter borrower ID and book scan value.", "error");
      return;
    }
    try {
      const tx = await returnBookByIdentifier(
        currentUser.userId,
        borrowerIdType,
        borrowerId.trim(),
        bookScanType,
        bookScanValue.trim(),
        returnResetFine
      );
      const fine = tx.fineAmount === 0 ? "No fine." : `Fine due: Rs ${tx.fineAmount}.`;
      setMessage(`${tx.bookTitle} returned for ${tx.borrowerName}. ${fine}`, "success");
      setBookScanValue("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Return failed.", "error");
    }
  }

  async function handleRenewStaff() {
    if (!currentUser) {
      return;
    }
    if (!borrowerId.trim() || !bookScanValue.trim()) {
      setMessage("Enter borrower ID and book scan value.", "error");
      return;
    }
    try {
      const tx = await renewBookByIdentifier(
        currentUser.userId,
        borrowerIdType,
        borrowerId.trim(),
        bookScanType,
        bookScanValue.trim(),
        renewDays
      );
      setMessage(`${tx.bookTitle} renewed for ${tx.borrowerName} until ${tx.dueOn}.`, "success");
      setBookScanValue("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Renewal failed.", "error");
    }
  }

  async function resolveSelfCopy(type = selfScanType, value = selfScanValue) {
    if (!currentUser) {
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      setMessage("Enter or scan a book QR/RFID/SSN value.", "error");
      return null;
    }
    try {
      const result = await scanBookCopy(type, trimmed, currentUser.userId);
      setSelfScanResult(result);
      setSelfIssueDays(result.loanPeriodDays);
      return result;
    } catch (error) {
      setSelfScanResult(null);
      setMessage(error instanceof Error ? error.message : "No book copy found.", "error");
      return null;
    }
  }

  async function handleSelfIssue() {
    if (!currentUser) {
      return;
    }
    const selectedCopy = selfScanResult ?? (await resolveSelfCopy());
    if (!selectedCopy) {
      return;
    }
    if (selfIssueDays < 1 || selfIssueDays > selectedCopy.loanPeriodDays) {
      setMessage(`Borrow days must be between 1 and ${selectedCopy.loanPeriodDays}.`, "error");
      return;
    }
    try {
      const transaction = await issueBookCopy(
        selectedCopy.copyId,
        currentUser.userId,
        currentUser.userId,
        selfIssueDays
      );
      await refreshMyBooks();
      setSelfScanResult({ ...selectedCopy, status: "ISSUED" });
      setMessage(`${transaction.bookTitle} issued to you. Due ${transaction.dueOn}.`, "success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Self-issue failed.", "error");
    }
  }

  async function saveBranding(nextCollegeName: string, logoDataUrl?: string) {
    if (!currentUser || !canManageCollegeBranding) {
      setMessage("Sign in as admin to update college branding.", "error");
      return;
    }
    try {
      const branding = await updateBranding(
        { collegeName: nextCollegeName, logoDataUrl },
        currentUser.userId
      );
      setCollegeName(branding.collegeName || "");
      setLogoUrl(branding.logoUrl || "");
      setSettingsCollegeName(branding.collegeName || "");
      setSettingsLogoPreview(branding.logoUrl || "");
      setMessage("Portal branding saved.", "success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save college branding.", "error");
    }
  }

  function handleLogoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (file.size > 2_500_000) {
      setMessage("Logo image is too large. Choose an image under 2.5 MB.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const uploadedLogoUrl = String(reader.result);
      setSettingsLogoPreview(uploadedLogoUrl);
      void saveBranding(settingsCollegeName, uploadedLogoUrl);
    };
    reader.readAsDataURL(file);
  }

  async function handleStudentPasswordRequiredChange(nextValue: boolean) {
    if (!currentUser || !canManageCollegeBranding) {
      setMessage("Sign in as admin to update portal settings.", "error");
      return;
    }
    const previous = studentPasswordRequired;
    setStudentPasswordRequired(nextValue);
    try {
      const settings = await updateAppSettings({ studentPasswordRequired: nextValue }, currentUser.userId);
      setStudentPasswordRequired(settings.studentPasswordRequired);
      setMessage(
        settings.studentPasswordRequired
          ? "Students must now sign in with roll number and password."
          : "Students now sign in with QR scan only.",
        "success"
      );
    } catch (error) {
      setStudentPasswordRequired(previous);
      setMessage(error instanceof Error ? error.message : "Unable to save portal settings.", "error");
    }
  }

  async function handleRegisterUser(event: FormEvent) {
    event.preventDefault();
    if (!currentUser || !canRegisterUsers) {
      setMessage("Sign in as admin to register users.", "error");
      return;
    }
    if ((registrationForm.role !== "STUDENT" || studentPasswordRequired) && !registrationForm.password?.trim()) {
      setMessage(
        registrationForm.role === "STUDENT"
          ? "Password is required for student accounts when student password login is enabled."
          : "Password is required for faculty, librarian, and admin accounts.",
        "error"
      );
      return;
    }
    try {
      const payload = {
        ...registrationForm,
        collegeEmail: registrationForm.collegeEmail || undefined,
        password:
          registrationForm.role === "STUDENT" && !studentPasswordRequired
            ? undefined
            : registrationForm.password?.trim()
      };
      const user = await registerUser(payload, currentUser.userId);
      setRegistrationForm({
        fullName: "",
        department: "",
        rollNumber: "",
        collegeEmail: "",
        password: "",
        role: "STUDENT"
      });
      setMessage(`${user.fullName} registered as ${user.roles[0]}.`, "success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Registration failed.", "error");
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

  async function openUserDirectory() {
    if (!currentUser || !canViewUserDirectory) {
      setMessage("You cannot view the user directory.", "error");
      return;
    }
    try {
      setUserDirectoryPage(0);
      setSelectedUserDetails(null);
      setShowUserIssued(false);
      setIsEditingUser(false);
      setGeneratedQr(null);
      await refreshUserDirectory(currentUser.userId, userDirectoryQuery, 0, userDirectoryPageSize);
      setMoreScreen("users");
      if (canCirculate) {
        setStaffTab("more");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to open user directory.", "error");
    }
  }

  async function handleUserDirectorySearch(event: FormEvent) {
    event.preventDefault();
    if (!currentUser) {
      return;
    }
    try {
      setUserDirectoryPage(0);
      await refreshUserDirectory(currentUser.userId, userDirectoryQuery, 0, userDirectoryPageSize);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "User directory search failed.", "error");
    }
  }

  async function handleViewUser(user: UserSummary) {
    if (!currentUser) {
      return;
    }
    try {
      const details = await getUserDetails(user.id, currentUser.userId);
      setSelectedUserDetails(details);
      setSelectedUserIssuedBooks([]);
      setShowUserIssued(false);
      setIsEditingUser(false);
      setMessage(`Showing details for ${details.fullName}.`, "info");
    } catch (error) {
      setSelectedUserDetails(null);
      setMessage(error instanceof Error ? error.message : "Unable to load user details.", "error");
    }
  }

  async function handleOpenIssuedBooks() {
    if (!currentUser || !selectedUserDetails) {
      setMessage("Select a user before viewing issued books.", "error");
      return;
    }
    if (!canViewIssuedBooksFor(selectedUserDetails)) {
      setMessage("You are not allowed to view issued books for this user.", "error");
      return;
    }
    try {
      setSelectedUserIssuedBooks(await listIssuedBooksForUser(selectedUserDetails.id, currentUser.userId));
      setShowUserIssued(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load issued books.", "error");
    }
  }

  async function handleGenerateUserQr(user: UserSummary) {
    if (!currentUser || !canManageLibrarians) {
      setMessage("Sign in as admin to generate user QR codes.", "error");
      return;
    }
    try {
      const qrCredential = await getUserQrCredential(user.id, currentUser.userId);
      const dataUrl = await QRCode.toDataURL(qrCredential.qrCredential, { margin: 2, width: 220 });
      setGeneratedQr({ fullName: qrCredential.fullName, dataUrl, value: qrCredential.qrCredential });
      setMessage(`QR code generated for ${qrCredential.fullName}.`, "success");
    } catch (error) {
      setGeneratedQr(null);
      setMessage(error instanceof Error ? error.message : "QR generation failed.", "error");
    }
  }

  async function handleRemoveUser(user: UserSummary) {
    if (!currentUser) {
      return;
    }
    try {
      await removeUser(user.id, currentUser.userId);
      if (selectedUserDetails?.id === user.id) {
        setSelectedUserDetails(null);
        setShowUserIssued(false);
      }
      await refreshUserDirectory(currentUser.userId, userDirectoryQuery, 0, userDirectoryPageSize);
      setMessage(`${user.fullName} removed from active users.`, "success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "User removal failed.", "error");
    }
  }

  function handleStartEditUser() {
    if (!selectedUserDetails || !canManageLibrarians) {
      setMessage("Only admin can edit users.", "error");
      return;
    }
    if (selectedUserDetails.roles.includes("SUPER_ADMIN")) {
      setMessage("Super admin accounts cannot be edited from this screen.", "error");
      return;
    }
    const editableRole =
      selectedUserDetails.roles.find(
        (role) => role === "STUDENT" || role === "FACULTY" || role === "LIBRARIAN" || role === "ADMIN"
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

  async function handleUpdateUser(event: FormEvent) {
    event.preventDefault();
    if (!currentUser || !selectedUserDetails || !canManageLibrarians) {
      setMessage("Only admin can edit users.", "error");
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
      await refreshUserDirectory(currentUser.userId, userDirectoryQuery, 0, userDirectoryPageSize);
      setIsEditingUser(false);
      setUserEditForm((current) => ({ ...current, password: "" }));
      setMessage(`${updated.fullName} details updated.`, "success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "User update failed.", "error");
    }
  }

  async function handleAdminPasswordReset(event: FormEvent) {
    event.preventDefault();
    if (!currentUser || !passwordResetUser || !canManageLibrarians) {
      setMessage("Sign in as admin to reset passwords.", "error");
      return;
    }
    if (adminNewPassword.trim().length < 4) {
      setMessage("New password must be at least 4 characters.", "error");
      return;
    }
    if (adminNewPassword !== adminConfirmPassword) {
      setMessage("New password and confirmation do not match.", "error");
      return;
    }
    try {
      await resetUserPassword(passwordResetUser.id, adminNewPassword.trim(), currentUser.userId);
      setMessage(`Password updated for ${passwordResetUser.fullName}.`, "success");
      setPasswordResetUser(null);
      setAdminNewPassword("");
      setAdminConfirmPassword("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to reset password.", "error");
    }
  }

  async function handleLoadClearFinesBorrower(
    value = clearFinesLookupValue,
    type: "ROLL_NUMBER" | "QR_CREDENTIAL" = clearFinesLookupType
  ) {
    if (!currentUser || !canIssueToStudents) {
      setMessage("Sign in as librarian or admin to clear fines.", "error");
      return;
    }
    const lookupValue = value.trim();
    if (!lookupValue) {
      setMessage(
        type === "QR_CREDENTIAL"
          ? "Scan or enter a borrower QR credential first."
          : "Enter a roll number or staff code first.",
        "error"
      );
      return;
    }
    try {
      const borrower = await getStudentDetailsByIdentifier(type, lookupValue, currentUser.userId);
      const books = await listIssuedBooksForUser(borrower.id, currentUser.userId);
      setClearFinesLookupType(type);
      setClearFinesLookupValue(lookupValue);
      setClearFinesBorrower(borrower);
      setClearFinesBooks(books);
      setMessage(`Loaded loans for ${borrower.fullName}.`, "success");
    } catch (error) {
      setClearFinesBorrower(null);
      setClearFinesBooks([]);
      setMessage(error instanceof Error ? error.message : "Unable to load borrower loans.", "error");
    }
  }

  async function handleClearFine(book: CirculationResponse) {
    if (!currentUser || !clearFinesBorrower) {
      setMessage("Load a borrower before clearing a fine.", "error");
      return;
    }
    if (book.fineAmount <= 0) {
      setMessage("This loan has no outstanding fine.", "error");
      return;
    }
    try {
      const transaction = await clearOutstandingFine(book.transactionId, currentUser.userId);
      const books = await listIssuedBooksForUser(clearFinesBorrower.id, currentUser.userId);
      setClearFinesBooks(books);
      setMessage(`Fine cleared for ${transaction.bookTitle}.`, "success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not clear fine.", "error");
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

  async function openAllIssuedBooks() {
    if (!currentUser || !canManageBooks) {
      setMessage("Sign in as librarian or admin to view all issued books.", "error");
      return;
    }
    try {
      setAllIssuedPage(0);
      await refreshAllIssuedBooks(0, allIssuedPageSize);
      setStaffTab("more");
      setMoreScreen("issued");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load issued books.", "error");
    }
  }

  function resetBookRegistrationForms() {
    setBookForm({
      title: "",
      author: "",
      publisher: "",
      category: "",
      finePerDay: 5,
      loanPeriodDays: 14
    });
    setBookCopyDrafts([{ id: createDraftId(), ssnNumber: "", shelfLocation: "" }]);
  }

  async function handleAddBook(event: FormEvent) {
    event.preventDefault();
    if (!currentUser || !canManageBooks) {
      setMessage("Sign in as librarian or admin to add books.", "error");
      return;
    }
    if (!bookForm.title.trim() || !bookForm.author.trim() || !bookForm.category.trim()) {
      setMessage("Enter title, author, and category.", "error");
      return;
    }
    if (bookForm.loanPeriodDays < 1 || bookForm.loanPeriodDays > 14) {
      setMessage("Loan period must be between 1 and 14 days.", "error");
      return;
    }
    const copies = bookCopyDrafts.map((copy) => ({
      ssnNumber: copy.ssnNumber.trim(),
      shelfLocation: copy.shelfLocation.trim()
    }));
    if (copies.some((copy) => !copy.ssnNumber || !copy.shelfLocation)) {
      setMessage("Each copy needs an SSN number and shelf location.", "error");
      return;
    }
    const uniqueSsns = new Set(copies.map((copy) => copy.ssnNumber.toLowerCase()));
    if (uniqueSsns.size !== copies.length) {
      setMessage("Each copy SSN must be unique.", "error");
      return;
    }
    const payload: BookCreateRequest = {
      title: bookForm.title.trim(),
      author: bookForm.author.trim(),
      publisher: bookForm.publisher.trim() || undefined,
      category: bookForm.category.trim(),
      finePerDay: bookForm.finePerDay,
      loanPeriodDays: bookForm.loanPeriodDays,
      copies
    };
    try {
      const book = await addBook(payload, currentUser.userId);
      try {
        setCategories(await listBookCategories());
      } catch {
        // Ignore category refresh failures.
      }
      resetBookRegistrationForms();
      setMessage(`${book.title} added with ${payload.copies.length} copy/copies.`, "success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Book add failed.", "error");
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
      copies.find((copy) => copy.ssnNumber.trim().toLowerCase() === cleanedSsn.toLowerCase()) ?? copies[0];
    if (!matchingCopy) {
      throw new Error(`Book "${book.title}" has no physical copies to edit.`);
    }
    applyBookCopyToEditForm(matchingCopy);
    return matchingCopy;
  }

  async function handleLoadBookForEdit() {
    const ssn = bookEditForm.ssnNumber.trim();
    if (!ssn) {
      setMessage("Enter a book or copy SSN to load details for editing.", "error");
      return;
    }
    try {
      const copy = await fillBookEditFormFromSsn(ssn);
      setMessage(`Loaded copy ${copy.ssnNumber} (${copy.title}) for editing.`, "success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load book details.", "error");
    }
  }

  async function handleLoadBookForEditByQr() {
    if (!currentUser) {
      setMessage("Sign in as librarian or admin to edit books.", "error");
      return;
    }
    const qrCodeValue = bookEditQrValue.trim();
    if (!qrCodeValue) {
      setMessage("Enter or scan a book copy QR value to load details.", "error");
      return;
    }
    try {
      const copy = await getBookCopyByQrCode(qrCodeValue, currentUser.userId);
      applyBookCopyToEditForm(copy);
      setMessage(`Loaded copy ${copy.ssnNumber} (${copy.title}) from QR.`, "success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load book details from QR.", "error");
    }
  }

  async function handleUpdateBook(event: FormEvent) {
    event.preventDefault();
    if (!currentUser || !canManageBooks) {
      setMessage("Sign in as librarian or admin to edit books.", "error");
      return;
    }
    const bookSsn = bookEditForm.bookSsnNumber.trim();
    const copySsn = bookEditForm.copySsnNumber.trim();
    if (!bookSsn || !copySsn) {
      setMessage("Load a physical copy before saving changes.", "error");
      return;
    }
    if (!bookEditForm.shelfLocation.trim()) {
      setMessage("Shelf location is required.", "error");
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
      try {
        setCategories(await listBookCategories());
      } catch {
        // Ignore.
      }
      setMessage(`${book.title} copy ${copy.ssnNumber} updated.`, "success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update book.", "error");
    }
  }

  async function handleRemoveBookCopy() {
    if (!currentUser || !canManageBooks) {
      setMessage("Sign in as librarian or admin to remove books.", "error");
      return;
    }
    try {
      if (removeCopyMethod === "QR") {
        const qrCodeValue = bookCopyQrValue.trim();
        if (!qrCodeValue) {
          setMessage("Enter or scan the book copy QR code first.", "error");
          return;
        }
        await removeBookCopyByQrCode(qrCodeValue, currentUser.userId);
        setBookCopyQrValue("");
      } else {
        const ssnNumber = bookCopySsnToRemove.trim();
        if (!ssnNumber) {
          setMessage("Enter the book copy SSN first.", "error");
          return;
        }
        await removeBookCopyBySsn(ssnNumber, currentUser.userId);
        setBookCopySsnToRemove("");
      }
      setMessage("Book copy removed from catalog.", "success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Book copy removal failed.", "error");
    }
  }

  async function handleLookupBookHistory(override?: { type?: ScanType; value?: string }) {
    if (!currentUser || !canManageBooks) {
      setMessage("Sign in as librarian or admin to view book history.", "error");
      return;
    }
    const type = override?.type ?? bookHistoryScanType;
    const value = (override?.value ?? bookHistoryScanValue).trim();
    if (!value) {
      setMessage("Enter or scan a book QR/RFID/SSN value to view history.", "error");
      return;
    }
    try {
      const scanned = await scanBookCopy(type, value, currentUser.userId);
      const history = await getBookCopyHistory(scanned.copyId, currentUser.userId);
      setBookCopyHistory(history);
      setBookHistoryScanType(type);
      setBookHistoryScanValue(value);
      setMessage(`Loaded history for ${history.title}.`, "success");
    } catch (error) {
      setBookCopyHistory(null);
      setMessage(error instanceof Error ? error.message : "Unable to load book copy history.", "error");
    }
  }

  async function refreshAuditLogs(actorUserId: string, page = auditPage, size: PageSize = auditPageSize) {
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

  async function handleFilterAuditLogs(event: FormEvent) {
    event.preventDefault();
    if (!currentUser || !canManageLibrarians) {
      setMessage("Sign in as admin to view audit logs.", "error");
      return;
    }
    if (auditFromDate && auditToDate && auditToDate < auditFromDate) {
      setMessage("To date cannot be before from date.", "error");
      return;
    }
    try {
      setAuditPage(0);
      await refreshAuditLogs(currentUser.userId, 0, auditPageSize);
    } catch (error) {
      setAuditLogsLoaded(false);
      setMessage(error instanceof Error ? error.message : "Failed to load audit logs.", "error");
    }
  }

  function renderPagination(opts: {
    page: number;
    totalPages: number;
    totalElements: number;
    pageSize: PageSize;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: PageSize) => void;
    label?: string;
  }) {
    const safeTotalPages = Math.max(opts.totalPages, 1);
    return (
      <div className="m-pagination">
        <label className="m-field">
          <span>Per page</span>
          <select
            value={opts.pageSize}
            onChange={(event) => opts.onPageSizeChange(Number(event.target.value) as PageSize)}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <p className="m-pagination-meta">
          {opts.totalElements === 0
            ? `0 ${opts.label ?? "records"}`
            : `Page ${opts.page + 1} of ${safeTotalPages} · ${opts.totalElements} ${opts.label ?? "records"}`}
        </p>
        <div className="m-row">
          <button
            type="button"
            className="m-btn secondary"
            disabled={opts.page <= 0}
            onClick={() => opts.onPageChange(opts.page - 1)}
          >
            Previous
          </button>
          <button
            type="button"
            className="m-btn secondary"
            disabled={opts.page + 1 >= safeTotalPages || opts.totalElements === 0}
            onClick={() => opts.onPageChange(opts.page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    );
  }

  function renderHeader() {
    return (
      <header className="m-header">
        <div className={logoUrl ? "m-logo" : "m-logo fallback"}>
          {logoUrl ? <img src={logoUrl} alt="College logo" /> : "CL"}
        </div>
        <div className="m-header-copy">
          <p className="m-college">{collegeName || "College Portal"}</p>
          <h1 className="m-title">Central Library</h1>
          {currentUser ? (
            <div className="m-session">
              {currentUser.fullName} · {activeRole}
              {sessionLabel ? ` · ${sessionLabel}` : ""}
            </div>
          ) : (
            <div className="m-session">Sign in to continue</div>
          )}
        </div>
      </header>
    );
  }

  function renderSelfIssue() {
    if (!isBorrower || canCirculate) {
      return null;
    }
    return (
      <section className="m-card">
        <h2>Issue To Me</h2>
        <p>Scan a book copy to borrow it for yourself.</p>
        <label className="m-field">
          <span>Scan type</span>
          <select value={selfScanType} onChange={(event) => setSelfScanType(event.target.value as ScanType)}>
            <option value="QR">QR</option>
            <option value="SSN">SSN</option>
            <option value="RFID">RFID</option>
          </select>
        </label>
        <label className="m-field">
          <span>Book value</span>
          <input
            value={selfScanValue}
            onChange={(event) => {
              setSelfScanValue(event.target.value);
              setSelfScanResult(null);
            }}
            placeholder="Book QR / SSN / RFID"
          />
        </label>
        <QrScanner
          label="Scan Book QR"
          onDetected={(value) => {
            setSelfScanType("QR");
            setSelfScanValue(value.trim());
            void resolveSelfCopy("QR", value.trim());
          }}
        />
        <button type="button" className="m-btn secondary" onClick={() => void resolveSelfCopy()}>
          Check Copy
        </button>
        {selfScanResult && (
          <div className="m-item">
            <strong>{selfScanResult.title}</strong>
            <span>
              SSN {selfScanResult.ssnNumber} · {selfScanResult.shelfLocation || "—"}
            </span>
            <span className={statusToneClass(selfScanResult.status)}>{selfScanResult.status}</span>
            <label className="m-field">
              <span>Loan days (max {selfScanResult.loanPeriodDays})</span>
              <input
                type="number"
                min={1}
                max={selfScanResult.loanPeriodDays}
                value={selfIssueDays}
                onChange={(event) => setSelfIssueDays(Number(event.target.value))}
              />
            </label>
            <button type="button" className="m-btn" onClick={() => void handleSelfIssue()}>
              Issue To Me
            </button>
          </div>
        )}
      </section>
    );
  }

  function renderCatalog() {
    return (
      <>
        {renderSelfIssue()}
        <section className="m-card">
          <h2>Catalog</h2>
          <p>Search titles, then open a result to see copies and status.</p>
          <label className="m-field">
            <span>Search</span>
            <input
              value={catalogQuery}
              onChange={(event) => setCatalogQuery(event.target.value)}
              placeholder="Title keywords"
            />
          </label>
          <label className="m-field">
            <span>Author</span>
            <input
              value={catalogAuthor}
              onChange={(event) => setCatalogAuthor(event.target.value)}
              placeholder="Optional"
            />
          </label>
          <label className="m-field">
            <span>Category</span>
            <select value={catalogCategory} onChange={(event) => setCatalogCategory(event.target.value)}>
              <option value="">All</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label className="m-check">
            <input
              type="checkbox"
              checked={catalogAvailableOnly}
              onChange={(event) => setCatalogAvailableOnly(event.target.checked)}
            />
            Available only
          </label>
          <button type="button" className="m-btn" disabled={catalogLoading} onClick={() => void runCatalogSearch()}>
            {catalogLoading ? "Searching…" : "Search"}
          </button>

          {!selectedTitle ? (
            <div className="m-list">
              {catalogBooks.length === 0 ? (
                <div className="m-empty">No results yet.</div>
              ) : (
                catalogBooks.map((book) => (
                  <button
                    type="button"
                    className="m-item"
                    key={`${book.title}-${book.author}-${book.category}`}
                    onClick={() => void openTitle(book.title)}
                  >
                    <strong>{book.title}</strong>
                    <span>
                      {book.author}
                      {book.publisher ? ` · ${book.publisher}` : ""}
                      {book.category ? ` · ${book.category}` : ""}
                    </span>
                    <div className="m-meta">
                      <span className="m-chip">{book.availableCopies} available</span>
                      <span className="m-chip">{book.totalCopies} total</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : (
            <div className="m-stack">
              <div className="m-row">
                <button type="button" className="m-btn secondary" onClick={() => setSelectedTitle(null)}>
                  Back to titles
                </button>
              </div>
              <h3 className="m-section-title">{selectedTitle}</h3>
              <div className="m-list">
                {titleCopies.length === 0 ? (
                  <div className="m-empty">No copies found.</div>
                ) : (
                  titleCopies.map((copy) => (
                    <div className="m-item" key={copy.copyId}>
                      <strong>SSN {copy.ssnNumber}</strong>
                      <span>
                        {copy.shelfLocation || "—"} · Acc {copy.accessionNumber || "—"}
                      </span>
                      <span className={statusToneClass(copy.status)}>{copy.status}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </section>
      </>
    );
  }

  function renderCirculation(mode: "issue" | "return" | "renew") {
    return (
      <section className="m-card">
        <h2>{mode === "issue" ? "Issue Book" : mode === "return" ? "Return Book" : "Renew Book"}</h2>
        <p>Scan or type borrower and book identifiers.</p>

        <label className="m-field">
          <span>Borrower ID type</span>
          <select
            value={borrowerIdType}
            onChange={(event) => setBorrowerIdType(event.target.value as IdentifierType)}
          >
            <option value="ROLL_NUMBER">Roll / Staff code</option>
            <option value="QR_CREDENTIAL">QR credential</option>
          </select>
        </label>
        <label className="m-field">
          <span>Borrower ID</span>
          <input
            value={borrowerId}
            onChange={(event) => setBorrowerId(event.target.value)}
            placeholder="Roll number or staff code"
          />
        </label>
        <QrScanner
          label="Scan Borrower QR"
          onDetected={(value) => {
            setBorrowerIdType("QR_CREDENTIAL");
            setBorrowerId(value.trim());
          }}
        />

        <label className="m-field">
          <span>Book scan type</span>
          <select value={bookScanType} onChange={(event) => setBookScanType(event.target.value as ScanType)}>
            <option value="QR">QR</option>
            <option value="SSN">SSN</option>
            <option value="RFID">RFID</option>
          </select>
        </label>
        <label className="m-field">
          <span>Book value</span>
          <input
            value={bookScanValue}
            onChange={(event) => setBookScanValue(event.target.value)}
            placeholder="Book QR / SSN / RFID"
          />
        </label>
        <QrScanner
          label="Scan Book QR"
          onDetected={(value) => {
            setBookScanType("QR");
            setBookScanValue(value.trim());
          }}
        />

        {mode === "issue" && (
          <label className="m-field">
            <span>Loan days</span>
            <input
              type="number"
              min={1}
              value={issueDays}
              onChange={(event) => setIssueDays(Number(event.target.value))}
            />
          </label>
        )}
        {mode === "return" && (
          <label className="m-check">
            <input
              type="checkbox"
              checked={returnResetFine}
              onChange={(event) => setReturnResetFine(event.target.checked)}
            />
            Reset fine on return
          </label>
        )}
        {mode === "renew" && (
          <label className="m-field">
            <span>Renewal days</span>
            <input
              type="number"
              min={1}
              value={renewDays}
              onChange={(event) => setRenewDays(Number(event.target.value))}
            />
          </label>
        )}

        {mode === "issue" && (
          <button type="button" className="m-btn" onClick={() => void handleIssue()}>
            Issue
          </button>
        )}
        {mode === "return" && (
          <button type="button" className="m-btn danger" onClick={() => void handleReturn()}>
            Return
          </button>
        )}
        {mode === "renew" && (
          <button type="button" className="m-btn" onClick={() => void handleRenewStaff()}>
            Renew
          </button>
        )}
      </section>
    );
  }

  function renderMyBooks() {
    return (
      <section className="m-card">
        <h2>My Books</h2>
        <p>Issued loans for your account.</p>
        <button type="button" className="m-btn secondary" onClick={() => void refreshMyBooks()}>
          Refresh
        </button>
        <div className="m-list">
          {myBooks.length === 0 ? (
            <div className="m-empty">No issued books.</div>
          ) : (
            myBooks.map((book) => (
              <div className="m-item" key={book.transactionId}>
                <strong>{book.bookTitle}</strong>
                <span>
                  Due {book.dueOn}
                  {book.fineAmount > 0 ? ` · Fine Rs ${book.fineAmount}` : ""}
                </span>
                <span className={statusToneClass(book.status)}>{book.status}</span>
                {book.status === "ISSUED" || book.status === "OVERDUE" ? (
                  <div className="m-stack">
                    <label className="m-field">
                      <span>Renew days</span>
                      <input
                        type="number"
                        min={1}
                        max={book.loanPeriodDays}
                        value={renewDaysByTx[book.transactionId] ?? Math.min(7, book.loanPeriodDays)}
                        onChange={(event) =>
                          setRenewDaysByTx((current) => ({
                            ...current,
                            [book.transactionId]: Number(event.target.value)
                          }))
                        }
                      />
                    </label>
                    <button type="button" className="m-btn" onClick={() => void handleRenewMyBook(book)}>
                      Renew
                    </button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>
    );
  }

  function renderAccount() {
    return (
      <section className="m-card">
        <h2>Account</h2>
        <p>
          {currentUser?.fullName} · {activeRole}
        </p>
        {!canCirculate && canViewUserDirectory && (
          <button
            type="button"
            className="m-btn secondary"
            onClick={() => {
              void openUserDirectory();
              setBorrowerTab("account");
              setMoreScreen("users");
            }}
          >
            User Directory
          </button>
        )}
        {canChangeOwnPassword ? (
          <form className="m-stack" onSubmit={(event) => void handleChangePassword(event)}>
            <h3 className="m-section-title">Change password</h3>
            <label className="m-field">
              <span>Current password</span>
              <input
                type="password"
                value={oldPassword}
                onChange={(event) => setOldPassword(event.target.value)}
              />
            </label>
            <label className="m-field">
              <span>New password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>
            <button type="submit" className="m-btn">
              Update password
            </button>
          </form>
        ) : null}
        <button type="button" className="m-btn danger" onClick={handleLogout}>
          Logout
        </button>
      </section>
    );
  }

  function renderSettings() {
    return (
      <section className="m-card">
        <div className="m-row">
          <button type="button" className="m-btn secondary" onClick={() => setMoreScreen("hub")}>
            Back
          </button>
        </div>
        <h2>Portal Settings</h2>
        <p>College branding and student login mode.</p>
        <label className="m-field">
          <span>College name</span>
          <input
            value={settingsCollegeName}
            onChange={(event) => setSettingsCollegeName(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="m-btn"
          onClick={() => void saveBranding(settingsCollegeName.trim())}
        >
          Save college name
        </button>
        <label className="m-field">
          <span>Logo upload</span>
          <input type="file" accept="image/*" onChange={handleLogoUpload} />
        </label>
        {settingsLogoPreview ? (
          <div className="m-logo-preview">
            <img src={settingsLogoPreview} alt="Logo preview" />
          </div>
        ) : null}
        <label className="m-check">
          <input
            type="checkbox"
            checked={studentPasswordRequired}
            onChange={(event) => void handleStudentPasswordRequiredChange(event.target.checked)}
          />
          Require student password login
        </label>
      </section>
    );
  }

  function renderRegister() {
    return (
      <section className="m-card">
        <div className="m-row">
          <button type="button" className="m-btn secondary" onClick={() => setMoreScreen("hub")}>
            Back
          </button>
        </div>
        <h2>User Registration</h2>
        <p>Create student, faculty, librarian, or admin accounts.</p>
        <form className="m-stack" onSubmit={(event) => void handleRegisterUser(event)}>
          <label className="m-field">
            <span>Full name</span>
            <input
              value={registrationForm.fullName}
              onChange={(event) => setRegistrationForm((current) => ({ ...current, fullName: event.target.value }))}
              required
            />
          </label>
          <label className="m-field">
            <span>Department</span>
            <input
              value={registrationForm.department}
              onChange={(event) => setRegistrationForm((current) => ({ ...current, department: event.target.value }))}
              required
            />
          </label>
          <label className="m-field">
            <span>Roll / Staff code</span>
            <input
              value={registrationForm.rollNumber}
              onChange={(event) => setRegistrationForm((current) => ({ ...current, rollNumber: event.target.value }))}
              required
            />
          </label>
          <label className="m-field">
            <span>College email</span>
            <input
              value={registrationForm.collegeEmail ?? ""}
              onChange={(event) =>
                setRegistrationForm((current) => ({ ...current, collegeEmail: event.target.value }))
              }
            />
          </label>
          <label className="m-field">
            <span>Role</span>
            <select
              value={registrationForm.role}
              onChange={(event) =>
                setRegistrationForm((current) => ({
                  ...current,
                  role: event.target.value as UserRegistrationRequest["role"]
                }))
              }
            >
              <option value="STUDENT">Student</option>
              <option value="FACULTY">Faculty</option>
              <option value="LIBRARIAN">Librarian</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>
          {(registrationForm.role !== "STUDENT" || studentPasswordRequired) && (
            <label className="m-field">
              <span>Password</span>
              <input
                type="password"
                value={registrationForm.password ?? ""}
                onChange={(event) =>
                  setRegistrationForm((current) => ({ ...current, password: event.target.value }))
                }
              />
            </label>
          )}
          <button type="submit" className="m-btn">
            Register user
          </button>
        </form>
      </section>
    );
  }

  function renderUsers() {
    const visibleUsers = users.filter(canViewListedUser);
    const readOnly = !canManageLibrarians && isFaculty;

    return (
      <section className="m-card">
        {canCirculate ? (
          <div className="m-row">
            <button type="button" className="m-btn secondary" onClick={() => setMoreScreen("hub")}>
              Back
            </button>
          </div>
        ) : (
          <div className="m-row">
            <button
              type="button"
              className="m-btn secondary"
              onClick={() => {
                setMoreScreen("hub");
                setSelectedUserDetails(null);
              }}
            >
              Close directory
            </button>
          </div>
        )}
        <h2>{canManageLibrarians ? "User Directory" : isFaculty ? "Student And Librarian Directory" : "Student Directory"}</h2>
        <p>{readOnly ? "Read-only directory view." : "Search, view, edit, and manage users."}</p>
        <form className="m-stack" onSubmit={(event) => void handleUserDirectorySearch(event)}>
          <label className="m-field">
            <span>Search</span>
            <input
              value={userDirectoryQuery}
              onChange={(event) => setUserDirectoryQuery(event.target.value)}
              placeholder="Name, roll, or code"
            />
          </label>
          <button type="submit" className="m-btn">
            Search users
          </button>
        </form>

        {!selectedUserDetails ? (
          <>
            <div className="m-list">
              {visibleUsers.length === 0 ? (
                <div className="m-empty">No users found.</div>
              ) : (
                visibleUsers.map((user) => (
                  <div className="m-item" key={user.id}>
                    <strong>{user.fullName}</strong>
                    <span>
                      {user.department} · {user.roles.join(", ")}
                      {user.rollNumber ? ` · ${user.rollNumber}` : ""}
                    </span>
                    <div className="m-row">
                      <button type="button" className="m-btn secondary" onClick={() => void handleViewUser(user)}>
                        View
                      </button>
                    </div>
                    {canManageLibrarians
                      && ((user.roles.includes("STUDENT") && canManageStudents)
                        || (user.roles.includes("FACULTY") && canManageLibrarians)
                        || (user.roles.includes("LIBRARIAN") && canManageLibrarians)
                        || (user.roles.includes("ADMIN") && canManageLibrarians && user.id !== currentUser?.userId)) && (
                      <div className="m-stack">
                        <button type="button" className="m-btn secondary" onClick={() => void handleGenerateUserQr(user)}>
                          Generate QR
                        </button>
                        <button
                          type="button"
                          className="m-btn secondary"
                          onClick={() => {
                            setPasswordResetUser(user);
                            setAdminNewPassword("");
                            setAdminConfirmPassword("");
                          }}
                        >
                          Reset password
                        </button>
                        <button type="button" className="m-btn danger" onClick={() => void handleRemoveUser(user)}>
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            {renderPagination({
              page: userDirectoryPage,
              totalPages: userDirectoryTotalPages,
              totalElements: userDirectoryTotalElements,
              pageSize: userDirectoryPageSize,
              label: "users",
              onPageChange: (page) => {
                if (!currentUser) {
                  return;
                }
                void refreshUserDirectory(currentUser.userId, userDirectoryQuery, page, userDirectoryPageSize);
              },
              onPageSizeChange: (size) => {
                if (!currentUser) {
                  return;
                }
                setUserDirectoryPageSize(size);
                void refreshUserDirectory(currentUser.userId, userDirectoryQuery, 0, size);
              }
            })}
          </>
        ) : (
          <div className="m-stack">
            <button
              type="button"
              className="m-btn secondary"
              onClick={() => {
                setSelectedUserDetails(null);
                setShowUserIssued(false);
                setIsEditingUser(false);
              }}
            >
              Back to list
            </button>
            <div className="m-item">
              <strong>{selectedUserDetails.fullName}</strong>
              <span>
                {selectedUserDetails.department} · {selectedUserDetails.roles.join(", ")}
              </span>
              {selectedUserDetails.identifiers.map((identifier) => (
                <span key={`${identifier.type}-${identifier.value}`}>
                  {identifier.type.replace(/_/g, " ")}: {identifier.value}
                </span>
              ))}
            </div>
            {canViewIssuedBooksFor(selectedUserDetails) && (
              <button type="button" className="m-btn secondary" onClick={() => void handleOpenIssuedBooks()}>
                {showUserIssued ? "Refresh issued books" : "View issued books"}
              </button>
            )}
            {showUserIssued && (
              <div className="m-list">
                {selectedUserIssuedBooks.length === 0 ? (
                  <div className="m-empty">No issued books.</div>
                ) : (
                  selectedUserIssuedBooks.map((book) => (
                    <div className="m-item" key={book.transactionId}>
                      <strong>{book.bookTitle}</strong>
                      <span>
                        Due {book.dueOn}
                        {book.fineAmount > 0 ? ` · Fine Rs ${book.fineAmount}` : ""}
                      </span>
                      <span className={statusToneClass(book.status)}>{book.status}</span>
                    </div>
                  ))
                )}
              </div>
            )}
            {canManageLibrarians && !selectedUserDetails.roles.includes("SUPER_ADMIN") && (
              <>
                {!isEditingUser ? (
                  <button type="button" className="m-btn" onClick={handleStartEditUser}>
                    Edit user
                  </button>
                ) : (
                  <form className="m-stack" onSubmit={(event) => void handleUpdateUser(event)}>
                    <h3 className="m-section-title">Edit user</h3>
                    <label className="m-field">
                      <span>Full name</span>
                      <input
                        value={userEditForm.fullName}
                        onChange={(event) =>
                          setUserEditForm((current) => ({ ...current, fullName: event.target.value }))
                        }
                      />
                    </label>
                    <label className="m-field">
                      <span>Department</span>
                      <input
                        value={userEditForm.department}
                        onChange={(event) =>
                          setUserEditForm((current) => ({ ...current, department: event.target.value }))
                        }
                      />
                    </label>
                    <label className="m-field">
                      <span>Roll / Staff code</span>
                      <input
                        value={userEditForm.rollNumber}
                        onChange={(event) =>
                          setUserEditForm((current) => ({ ...current, rollNumber: event.target.value }))
                        }
                      />
                    </label>
                    <label className="m-field">
                      <span>College email</span>
                      <input
                        value={userEditForm.collegeEmail ?? ""}
                        onChange={(event) =>
                          setUserEditForm((current) => ({ ...current, collegeEmail: event.target.value }))
                        }
                      />
                    </label>
                    <label className="m-field">
                      <span>Role</span>
                      <select
                        value={userEditForm.role}
                        onChange={(event) =>
                          setUserEditForm((current) => ({
                            ...current,
                            role: event.target.value as UserUpdateRequest["role"]
                          }))
                        }
                      >
                        <option value="STUDENT">Student</option>
                        <option value="FACULTY">Faculty</option>
                        <option value="LIBRARIAN">Librarian</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </label>
                    <div className="m-row">
                      <button type="button" className="m-btn secondary" onClick={() => setIsEditingUser(false)}>
                        Cancel
                      </button>
                      <button type="submit" className="m-btn">
                        Save
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        )}

        {generatedQr && (
          <div className="m-qr-preview">
            <img src={generatedQr.dataUrl} alt={`QR for ${generatedQr.fullName}`} />
            <p>{generatedQr.fullName}</p>
            <button
              type="button"
              className="m-btn"
              onClick={() =>
                downloadDataUrl(
                  generatedQr.dataUrl,
                  `${generatedQr.fullName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-qr.png`
                )
              }
            >
              Download QR
            </button>
          </div>
        )}

        {passwordResetUser && (
          <form className="m-stack" onSubmit={(event) => void handleAdminPasswordReset(event)}>
            <h3 className="m-section-title">Reset password · {passwordResetUser.fullName}</h3>
            <label className="m-field">
              <span>New password</span>
              <input
                type="password"
                value={adminNewPassword}
                onChange={(event) => setAdminNewPassword(event.target.value)}
              />
            </label>
            <label className="m-field">
              <span>Confirm password</span>
              <input
                type="password"
                value={adminConfirmPassword}
                onChange={(event) => setAdminConfirmPassword(event.target.value)}
              />
            </label>
            <div className="m-row">
              <button
                type="button"
                className="m-btn secondary"
                onClick={() => {
                  setPasswordResetUser(null);
                  setAdminNewPassword("");
                  setAdminConfirmPassword("");
                }}
              >
                Cancel
              </button>
              <button type="submit" className="m-btn">
                Reset
              </button>
            </div>
          </form>
        )}
      </section>
    );
  }

  function renderFines() {
    return (
      <section className="m-card">
        <div className="m-row">
          <button type="button" className="m-btn secondary" onClick={() => setMoreScreen("hub")}>
            Back
          </button>
        </div>
        <h2>Clear Fines</h2>
        <p>Look up a borrower and clear outstanding fines.</p>
        <label className="m-field">
          <span>Lookup type</span>
          <select
            value={clearFinesLookupType}
            onChange={(event) =>
              setClearFinesLookupType(event.target.value as "ROLL_NUMBER" | "QR_CREDENTIAL")
            }
          >
            <option value="ROLL_NUMBER">Roll / Staff code</option>
            <option value="QR_CREDENTIAL">QR credential</option>
          </select>
        </label>
        <label className="m-field">
          <span>Borrower</span>
          <input
            value={clearFinesLookupValue}
            onChange={(event) => setClearFinesLookupValue(event.target.value)}
            placeholder="Roll number or QR"
          />
        </label>
        <QrScanner
          label="Scan Borrower QR"
          onDetected={(value) => {
            setClearFinesLookupType("QR_CREDENTIAL");
            setClearFinesLookupValue(value.trim());
            void handleLoadClearFinesBorrower(value.trim(), "QR_CREDENTIAL");
          }}
        />
        <button type="button" className="m-btn" onClick={() => void handleLoadClearFinesBorrower()}>
          Load borrower
        </button>
        {clearFinesBorrower && (
          <>
            <div className="m-item">
              <strong>{clearFinesBorrower.fullName}</strong>
              <span>
                {clearFinesBorrower.department} · {clearFinesBorrower.roles.join(", ")}
              </span>
            </div>
            <div className="m-list">
              {clearFinesBooks.length === 0 ? (
                <div className="m-empty">No loans found.</div>
              ) : (
                clearFinesBooks.map((book) => (
                  <div className="m-item" key={book.transactionId}>
                    <strong>{book.bookTitle}</strong>
                    <span>
                      {book.status} · Fine Rs {book.fineAmount}
                    </span>
                    {book.fineAmount > 0 && (
                      <button type="button" className="m-btn" onClick={() => void handleClearFine(book)}>
                        Clear fine
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </section>
    );
  }

  function renderIssued() {
    return (
      <section className="m-card">
        <div className="m-row">
          <button type="button" className="m-btn secondary" onClick={() => setMoreScreen("hub")}>
            Back
          </button>
        </div>
        <h2>All Issued Books</h2>
        <p>Paginated list of active and historical loans.</p>
        <button
          type="button"
          className="m-btn secondary"
          onClick={() => void refreshAllIssuedBooks(allIssuedPage, allIssuedPageSize)}
        >
          Refresh
        </button>
        <div className="m-list">
          {allIssuedBooks.length === 0 ? (
            <div className="m-empty">No issued books.</div>
          ) : (
            allIssuedBooks.map((book) => (
              <div className="m-item" key={book.transactionId}>
                <strong>{book.bookTitle}</strong>
                <span>
                  {book.borrowerName}
                  {book.borrowerCode ? ` · ${book.borrowerCode}` : ""}
                </span>
                <span>
                  Due {book.dueOn}
                  {book.fineAmount > 0 ? ` · Fine Rs ${book.fineAmount}` : ""}
                </span>
                <span className={statusToneClass(book.status)}>{book.status}</span>
              </div>
            ))
          )}
        </div>
        {renderPagination({
          page: allIssuedPage,
          totalPages: allIssuedTotalPages,
          totalElements: allIssuedTotalElements,
          pageSize: allIssuedPageSize,
          label: "loans",
          onPageChange: (page) => void refreshAllIssuedBooks(page, allIssuedPageSize),
          onPageSizeChange: (size) => {
            setAllIssuedPageSize(size);
            void refreshAllIssuedBooks(0, size);
          }
        })}
      </section>
    );
  }

  function renderBooks() {
    return (
      <section className="m-card">
        <div className="m-row">
          <button type="button" className="m-btn secondary" onClick={() => setMoreScreen("hub")}>
            Back
          </button>
        </div>
        <h2>Catalog Management</h2>
        <div className="m-tabs m-tabs-3">
          <button
            type="button"
            className={`m-tab${booksSubTab === "add" ? " active" : ""}`}
            onClick={() => setBooksSubTab("add")}
          >
            Add
          </button>
          <button
            type="button"
            className={`m-tab${booksSubTab === "edit" ? " active" : ""}`}
            onClick={() => setBooksSubTab("edit")}
          >
            Edit
          </button>
          <button
            type="button"
            className={`m-tab${booksSubTab === "remove" ? " active" : ""}`}
            onClick={() => setBooksSubTab("remove")}
          >
            Remove
          </button>
        </div>

        {booksSubTab === "add" && (
          <form className="m-stack" onSubmit={(event) => void handleAddBook(event)}>
            <label className="m-field">
              <span>Title</span>
              <input
                value={bookForm.title}
                onChange={(event) => setBookForm((current) => ({ ...current, title: event.target.value }))}
                required
              />
            </label>
            <label className="m-field">
              <span>Author</span>
              <input
                value={bookForm.author}
                onChange={(event) => setBookForm((current) => ({ ...current, author: event.target.value }))}
                required
              />
            </label>
            <label className="m-field">
              <span>Publisher</span>
              <input
                value={bookForm.publisher}
                onChange={(event) => setBookForm((current) => ({ ...current, publisher: event.target.value }))}
              />
            </label>
            <label className="m-field">
              <span>Category</span>
              <input
                value={bookForm.category}
                onChange={(event) => setBookForm((current) => ({ ...current, category: event.target.value }))}
                list="m-book-categories"
                required
              />
              <datalist id="m-book-categories">
                {categories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </label>
            <label className="m-field">
              <span>Fine per day</span>
              <input
                type="number"
                min={0}
                value={bookForm.finePerDay}
                onChange={(event) =>
                  setBookForm((current) => ({ ...current, finePerDay: Number(event.target.value) }))
                }
              />
            </label>
            <label className="m-field">
              <span>Loan days</span>
              <input
                type="number"
                min={1}
                max={14}
                value={bookForm.loanPeriodDays}
                onChange={(event) =>
                  setBookForm((current) => ({ ...current, loanPeriodDays: Number(event.target.value) }))
                }
              />
            </label>
            <h3 className="m-section-title">Copies</h3>
            {bookCopyDrafts.map((draft, index) => (
              <div className="m-item" key={draft.id}>
                <strong>Copy {index + 1}</strong>
                <label className="m-field">
                  <span>SSN</span>
                  <input
                    value={draft.ssnNumber}
                    onChange={(event) =>
                      setBookCopyDrafts((current) =>
                        current.map((item) =>
                          item.id === draft.id ? { ...item, ssnNumber: event.target.value } : item
                        )
                      )
                    }
                  />
                </label>
                <label className="m-field">
                  <span>Shelf</span>
                  <input
                    value={draft.shelfLocation}
                    onChange={(event) =>
                      setBookCopyDrafts((current) =>
                        current.map((item) =>
                          item.id === draft.id ? { ...item, shelfLocation: event.target.value } : item
                        )
                      )
                    }
                  />
                </label>
                {bookCopyDrafts.length > 1 && (
                  <button
                    type="button"
                    className="m-btn ghost"
                    onClick={() =>
                      setBookCopyDrafts((current) => current.filter((item) => item.id !== draft.id))
                    }
                  >
                    Remove draft
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="m-btn secondary"
              onClick={() =>
                setBookCopyDrafts((current) => [
                  ...current,
                  { id: createDraftId(), ssnNumber: "", shelfLocation: "" }
                ])
              }
            >
              Add another copy
            </button>
            <button type="submit" className="m-btn">
              Add book
            </button>
          </form>
        )}

        {booksSubTab === "edit" && (
          <form className="m-stack" onSubmit={(event) => void handleUpdateBook(event)}>
            <label className="m-field">
              <span>Load by SSN</span>
              <input
                value={bookEditForm.ssnNumber}
                onChange={(event) =>
                  setBookEditForm((current) => ({ ...current, ssnNumber: event.target.value }))
                }
                placeholder="Copy or book SSN"
              />
            </label>
            <button type="button" className="m-btn secondary" onClick={() => void handleLoadBookForEdit()}>
              Load by SSN
            </button>
            <label className="m-field">
              <span>Load by QR</span>
              <input
                value={bookEditQrValue}
                onChange={(event) => setBookEditQrValue(event.target.value)}
                placeholder="Book copy QR"
              />
            </label>
            <QrScanner
              label="Scan Book QR"
              onDetected={(value) => {
                setBookEditQrValue(value.trim());
                void (async () => {
                  setBookEditQrValue(value.trim());
                  if (!currentUser) {
                    return;
                  }
                  try {
                    const copy = await getBookCopyByQrCode(value.trim(), currentUser.userId);
                    applyBookCopyToEditForm(copy);
                    setMessage(`Loaded copy ${copy.ssnNumber} (${copy.title}) from QR.`, "success");
                  } catch (error) {
                    setMessage(
                      error instanceof Error ? error.message : "Unable to load book details from QR.",
                      "error"
                    );
                  }
                })();
              }}
            />
            <button type="button" className="m-btn secondary" onClick={() => void handleLoadBookForEditByQr()}>
              Load by QR
            </button>
            {bookEditForm.copySsnNumber ? (
              <>
                <label className="m-field">
                  <span>Title</span>
                  <input
                    value={bookEditForm.title}
                    onChange={(event) => setBookEditForm((current) => ({ ...current, title: event.target.value }))}
                  />
                </label>
                <label className="m-field">
                  <span>Author</span>
                  <input
                    value={bookEditForm.author}
                    onChange={(event) => setBookEditForm((current) => ({ ...current, author: event.target.value }))}
                  />
                </label>
                <label className="m-field">
                  <span>Publisher</span>
                  <input
                    value={bookEditForm.publisher}
                    onChange={(event) =>
                      setBookEditForm((current) => ({ ...current, publisher: event.target.value }))
                    }
                  />
                </label>
                <label className="m-field">
                  <span>Category</span>
                  <input
                    value={bookEditForm.category}
                    onChange={(event) =>
                      setBookEditForm((current) => ({ ...current, category: event.target.value }))
                    }
                  />
                </label>
                <label className="m-field">
                  <span>Fine per day</span>
                  <input
                    type="number"
                    min={0}
                    value={bookEditForm.finePerDay}
                    onChange={(event) =>
                      setBookEditForm((current) => ({ ...current, finePerDay: Number(event.target.value) }))
                    }
                  />
                </label>
                <label className="m-field">
                  <span>Loan days</span>
                  <input
                    type="number"
                    min={1}
                    value={bookEditForm.loanPeriodDays}
                    onChange={(event) =>
                      setBookEditForm((current) => ({
                        ...current,
                        loanPeriodDays: Number(event.target.value)
                      }))
                    }
                  />
                </label>
                <label className="m-field">
                  <span>Shelf location</span>
                  <input
                    value={bookEditForm.shelfLocation}
                    onChange={(event) =>
                      setBookEditForm((current) => ({ ...current, shelfLocation: event.target.value }))
                    }
                  />
                </label>
                <p>
                  Copy {bookEditForm.copySsnNumber} · Acc {bookEditForm.accessionNumber || "—"} ·{" "}
                  <span className={statusToneClass(bookEditForm.status)}>{bookEditForm.status}</span>
                </p>
                <button type="submit" className="m-btn">
                  Save changes
                </button>
              </>
            ) : (
              <div className="m-empty">Load a copy to edit.</div>
            )}
          </form>
        )}

        {booksSubTab === "remove" && (
          <div className="m-stack">
            <label className="m-field">
              <span>Remove method</span>
              <select
                value={removeCopyMethod}
                onChange={(event) => setRemoveCopyMethod(event.target.value as "QR" | "SSN")}
              >
                <option value="QR">By QR</option>
                <option value="SSN">By SSN</option>
              </select>
            </label>
            {removeCopyMethod === "QR" ? (
              <>
                <label className="m-field">
                  <span>Book QR</span>
                  <input
                    value={bookCopyQrValue}
                    onChange={(event) => setBookCopyQrValue(event.target.value)}
                  />
                </label>
                <QrScanner
                  label="Scan Book QR"
                  onDetected={(value) => setBookCopyQrValue(value.trim())}
                />
              </>
            ) : (
              <label className="m-field">
                <span>Copy SSN</span>
                <input
                  value={bookCopySsnToRemove}
                  onChange={(event) => setBookCopySsnToRemove(event.target.value)}
                />
              </label>
            )}
            <button type="button" className="m-btn danger" onClick={() => void handleRemoveBookCopy()}>
              Remove copy
            </button>
          </div>
        )}
      </section>
    );
  }

  function renderHistory() {
    return (
      <section className="m-card">
        <div className="m-row">
          <button type="button" className="m-btn secondary" onClick={() => setMoreScreen("hub")}>
            Back
          </button>
        </div>
        <h2>Book Copy History</h2>
        <p>Scan or enter a copy identifier to view loan history.</p>
        <label className="m-field">
          <span>Scan type</span>
          <select
            value={bookHistoryScanType}
            onChange={(event) => setBookHistoryScanType(event.target.value as ScanType)}
          >
            <option value="SSN">SSN</option>
            <option value="QR">QR</option>
            <option value="RFID">RFID</option>
          </select>
        </label>
        <label className="m-field">
          <span>Value</span>
          <input
            value={bookHistoryScanValue}
            onChange={(event) => setBookHistoryScanValue(event.target.value)}
            placeholder="Book QR / SSN / RFID"
          />
        </label>
        <QrScanner
          label="Scan Book QR"
          onDetected={(value) => {
            setBookHistoryScanType("QR");
            setBookHistoryScanValue(value.trim());
            void handleLookupBookHistory({ type: "QR", value: value.trim() });
          }}
        />
        <button type="button" className="m-btn" onClick={() => void handleLookupBookHistory()}>
          Load history
        </button>
        {bookCopyHistory && (
          <div className="m-stack">
            <div className="m-item">
              <strong>{bookCopyHistory.title}</strong>
              <span>
                SSN {bookCopyHistory.ssnNumber} · Acc {bookCopyHistory.accessionNumber || "—"}
              </span>
              <span className={statusToneClass(bookCopyHistory.status)}>{bookCopyHistory.status}</span>
            </div>
            <div className="m-list">
              {bookCopyHistory.loans.length === 0 ? (
                <div className="m-empty">No loan history.</div>
              ) : (
                bookCopyHistory.loans.map((loan) => (
                  <div className="m-item" key={loan.transactionId}>
                    <strong>{loan.borrowerName}</strong>
                    <span>
                      Issued {formatDateTime(loan.issuedAt, loan.issuedOn)} · Due {loan.dueOn}
                    </span>
                    <span>
                      Returned {formatDateTime(loan.returnedAt, loan.returnedOn)}
                      {loan.fineAmount > 0 ? ` · Fine Rs ${loan.fineAmount}` : ""}
                    </span>
                    <span className={statusToneClass(loan.status)}>{loan.status}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </section>
    );
  }

  function renderAudit() {
    return (
      <section className="m-card">
        <div className="m-row">
          <button type="button" className="m-btn secondary" onClick={() => setMoreScreen("hub")}>
            Back
          </button>
        </div>
        <h2>Audit Logs</h2>
        <p>Filter portal activity by date and action.</p>
        <form className="m-stack" onSubmit={(event) => void handleFilterAuditLogs(event)}>
          <label className="m-field">
            <span>From</span>
            <input type="date" value={auditFromDate} onChange={(event) => setAuditFromDate(event.target.value)} />
          </label>
          <label className="m-field">
            <span>To</span>
            <input type="date" value={auditToDate} onChange={(event) => setAuditToDate(event.target.value)} />
          </label>
          <label className="m-field">
            <span>Action</span>
            <select value={auditActionFilter} onChange={(event) => setAuditActionFilter(event.target.value)}>
              {AUDIT_ACTION_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="m-btn">
            Load logs
          </button>
        </form>
        <div className="m-list">
          {!auditLogsLoaded ? (
            <div className="m-empty">Set filters and load logs.</div>
          ) : auditEvents.length === 0 ? (
            <div className="m-empty">No audit events.</div>
          ) : (
            auditEvents.map((event) => (
              <div className="m-item" key={event.id}>
                <strong>{event.actionLabel || event.action}</strong>
                <span>{event.summary}</span>
                <span>
                  {event.doneBy} · {formatDateTime(event.createdAt)}
                </span>
              </div>
            ))
          )}
        </div>
        {auditLogsLoaded &&
          renderPagination({
            page: auditPage,
            totalPages: auditTotalPages,
            totalElements: auditTotalElements,
            pageSize: auditPageSize,
            label: "events",
            onPageChange: (page) => {
              if (!currentUser) {
                return;
              }
              void refreshAuditLogs(currentUser.userId, page, auditPageSize);
            },
            onPageSizeChange: (size) => {
              if (!currentUser) {
                return;
              }
              setAuditPageSize(size);
              void refreshAuditLogs(currentUser.userId, 0, size);
            }
          })}
      </section>
    );
  }

  function renderMoreHub() {
    const items: Array<{ id: MoreScreen; label: string; description: string; show: boolean; icon: ReactNode }> = [
      {
        id: "settings",
        label: "Portal Settings",
        description: "College name, logo, student login",
        show: canManageCollegeBranding,
        icon: <Settings size={18} />
      },
      {
        id: "register",
        label: "User Registration",
        description: "Create new accounts",
        show: canRegisterUsers,
        icon: <UserPlus size={18} />
      },
      {
        id: "users",
        label: "User Directory",
        description: canManageLibrarians ? "Search and manage users" : "Browse users",
        show: canViewUserDirectory,
        icon: <Users size={18} />
      },
      {
        id: "books",
        label: "Catalog Management",
        description: "Add, edit, or remove copies",
        show: canManageBooks,
        icon: <Library size={18} />
      },
      {
        id: "fines",
        label: "Clear Fines",
        description: "Look up borrower fines",
        show: canIssueToStudents,
        icon: <ClipboardList size={18} />
      },
      {
        id: "issued",
        label: "All Issued Books",
        description: "Paginated loan list",
        show: canManageBooks,
        icon: <BookOpen size={18} />
      },
      {
        id: "history",
        label: "Book Copy History",
        description: "Loan history by copy",
        show: canManageBooks,
        icon: <History size={18} />
      },
      {
        id: "audit",
        label: "Audit Logs",
        description: "Admin activity trail",
        show: canManageLibrarians,
        icon: <ClipboardList size={18} />
      },
      {
        id: "account",
        label: "Account",
        description: "Password and logout",
        show: true,
        icon: <UserRound size={18} />
      }
    ];

    return (
      <section className="m-card">
        <h2>More</h2>
        <p>Admin and management tools.</p>
        <div className="m-more-list">
          {items
            .filter((item) => item.show)
            .map((item) => (
              <button
                key={item.id}
                type="button"
                className="m-more-item"
                onClick={() => {
                  if (item.id === "users") {
                    void openUserDirectory();
                    return;
                  }
                  if (item.id === "issued") {
                    void openAllIssuedBooks();
                    return;
                  }
                  setMoreScreen(item.id);
                }}
              >
                <span className="m-more-icon">{item.icon}</span>
                <span className="m-more-copy">
                  <strong>{item.label}</strong>
                  <span>{item.description}</span>
                </span>
              </button>
            ))}
        </div>
      </section>
    );
  }

  function renderMore() {
    if (!canCirculate && moreScreen === "users" && canViewUserDirectory) {
      return renderUsers();
    }
    switch (moreScreen) {
      case "settings":
        return canManageCollegeBranding ? renderSettings() : renderMoreHub();
      case "register":
        return canRegisterUsers ? renderRegister() : renderMoreHub();
      case "users":
        return canViewUserDirectory ? renderUsers() : renderMoreHub();
      case "books":
        return canManageBooks ? renderBooks() : renderMoreHub();
      case "fines":
        return canIssueToStudents ? renderFines() : renderMoreHub();
      case "issued":
        return canManageBooks ? renderIssued() : renderMoreHub();
      case "history":
        return canManageBooks ? renderHistory() : renderMoreHub();
      case "audit":
        return canManageLibrarians ? renderAudit() : renderMoreHub();
      case "account":
        return renderAccount();
      default:
        return renderMoreHub();
    }
  }

  function renderGuest() {
    return (
      <>
        {renderHeader()}
        <section className="m-card">
          <div className="m-tabs">
            <button
              type="button"
              className={`m-tab${guestTab === "student" ? " active" : ""}`}
              onClick={() => setGuestTab("student")}
            >
              Student
            </button>
            <button
              type="button"
              className={`m-tab${guestTab === "staff" ? " active" : ""}`}
              onClick={() => setGuestTab("staff")}
            >
              Staff
            </button>
          </div>

          {guestTab === "student" ? (
            studentPasswordRequired ? (
              <form className="m-stack" onSubmit={(event) => void handleStudentLogin(event)}>
                <h2>Student Login</h2>
                <p>Scan QR to fill roll number, then enter password.</p>
                <label className="m-field">
                  <span>Roll number</span>
                  <input value={studentRoll} onChange={(event) => setStudentRoll(event.target.value)} />
                </label>
                <label className="m-field">
                  <span>Password</span>
                  <input
                    type="password"
                    value={studentPassword}
                    onChange={(event) => setStudentPassword(event.target.value)}
                  />
                </label>
                <button type="submit" className="m-btn">
                  Sign In
                </button>
                <QrScanner label="Scan Student QR" onDetected={(value) => void handleStudentQr(value)} />
              </form>
            ) : (
              <div className="m-stack">
                <h2>Student Login</h2>
                <p>Scan your student ID QR to sign in.</p>
                <QrScanner label="Scan Student QR To Login" onDetected={(value) => void handleStudentQr(value)} />
              </div>
            )
          ) : (
            <form className="m-stack" onSubmit={(event) => void handleStaffLogin(event)}>
              <h2>Staff Login</h2>
              <p>Faculty, librarian, and admin sign in here.</p>
              <label className="m-field">
                <span>Login method</span>
                <select
                  value={staffIdentifierType}
                  onChange={(event) => setStaffIdentifierType(event.target.value as IdentifierType)}
                >
                  <option value="ROLL_NUMBER">Staff Code</option>
                  <option value="COLLEGE_EMAIL">College Email</option>
                </select>
              </label>
              <label className="m-field">
                <span>{staffIdentifierType === "COLLEGE_EMAIL" ? "College email" : "Staff code"}</span>
                <input
                  value={staffIdentifier}
                  onChange={(event) => setStaffIdentifier(event.target.value)}
                />
              </label>
              <label className="m-field">
                <span>Password</span>
                <input
                  type="password"
                  value={staffPassword}
                  onChange={(event) => setStaffPassword(event.target.value)}
                />
              </label>
              <button type="submit" className="m-btn">
                Sign In Staff
              </button>
            </form>
          )}
        </section>
      </>
    );
  }

  function renderStaffNav() {
    const items: Array<{ id: StaffTab; label: string; icon: ReactNode }> = [
      { id: "issue", label: "Issue", icon: <BookOpen size={18} /> },
      { id: "return", label: "Return", icon: <Undo2 size={18} /> },
      { id: "renew", label: "Renew", icon: <RefreshCw size={18} /> },
      { id: "catalog", label: "Catalog", icon: <Search size={18} /> },
      { id: "more", label: "More", icon: <MoreHorizontal size={18} /> }
    ];
    return (
      <nav className="m-nav">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={staffTab === item.id ? "active" : ""}
            onClick={() => {
              setStaffTab(item.id);
              if (item.id === "more") {
                setMoreScreen("hub");
              }
            }}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>
    );
  }

  function renderBorrowerNav() {
    const items: Array<{ id: BorrowerTab; label: string; icon: ReactNode }> = [
      { id: "catalog", label: "Catalog", icon: <Search size={18} /> },
      { id: "books", label: "My Books", icon: <Library size={18} /> },
      { id: "account", label: "Account", icon: <LogOut size={18} /> }
    ];
    return (
      <nav className="m-nav">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={borrowerTab === item.id ? "active" : ""}
            onClick={() => {
              setBorrowerTab(item.id);
              if (item.id !== "account") {
                setMoreScreen("hub");
              }
            }}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>
    );
  }

  const showBorrowerDirectory = !canCirculate && isBorrower && moreScreen === "users" && canViewUserDirectory;

  return (
    <main className={`m-app${currentUser ? "" : " guest"}`}>
      {!currentUser && renderGuest()}

      {currentUser && canCirculate && (
        <>
          {renderHeader()}
          {staffTab === "issue" && renderCirculation("issue")}
          {staffTab === "return" && renderCirculation("return")}
          {staffTab === "renew" && renderCirculation("renew")}
          {staffTab === "catalog" && renderCatalog()}
          {staffTab === "more" && renderMore()}
          {renderStaffNav()}
        </>
      )}

      {currentUser && !canCirculate && isBorrower && (
        <>
          {renderHeader()}
          {showBorrowerDirectory
            ? renderUsers()
            : (
              <>
                {borrowerTab === "catalog" && renderCatalog()}
                {borrowerTab === "books" && renderMyBooks()}
                {borrowerTab === "account" && renderAccount()}
              </>
            )}
          {renderBorrowerNav()}
        </>
      )}

      {currentUser && !canCirculate && !isBorrower && (
        <>
          {renderHeader()}
          {renderAccount()}
        </>
      )}

      {message && (
        <div
          className="m-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setMessage("");
            }
          }}
        >
          <div className="m-dialog">
            {messageTone === "success" && <CheckCircle2 className="m-dialog-icon ok" size={48} />}
            {messageTone === "error" && <XCircle className="m-dialog-icon bad" size={48} />}
            <h3>{messageTone === "success" ? "Success" : messageTone === "error" ? "Error" : "Message"}</h3>
            <p>{message}</p>
            <button type="button" className="m-btn" onClick={() => setMessage("")}>
              OK
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
