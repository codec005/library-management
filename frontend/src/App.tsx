import { useEffect, useMemo, useState } from "react";
import { BookOpen, Library, QrCode, Search, Users } from "lucide-react";
import QRCode from "qrcode";
import QrScanner from "./QrScanner";
import {
  BookCopyScanResponse,
  BookCopySummary,
  BookCreateRequest,
  BookSummary,
  CirculationResponse,
  IdentifierType,
  LoginResponse,
  ScanType,
  UserDetailsResponse,
  UserRegistrationRequest,
  UserSummary,
  addBook,
  getUserQrCredential,
  getUserDetails,
  issueBookByIdentifier,
  issueBookCopy,
  listBookCopies,
  listIssuedBooksForUser,
  listUsers,
  login,
  renewTransaction,
  registerUser,
  removeBookCopyByQrCode,
  removeUser,
  returnBookCopy,
  scanBookCopy,
  scanLogin,
  searchBooks
} from "./api";

export default function App() {
  const [identifierType, setIdentifierType] = useState<IdentifierType>("ROLL_NUMBER");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [userScanValue, setUserScanValue] = useState("");
  const [currentUser, setCurrentUser] = useState<LoginResponse | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [scanType, setScanType] = useState<ScanType>("QR");
  const [scanValue, setScanValue] = useState("");
  const [staffBorrowerIdentifierType, setStaffBorrowerIdentifierType] = useState<IdentifierType>("ROLL_NUMBER");
  const [staffBorrowerIdentifier, setStaffBorrowerIdentifier] = useState("");
  const [scanResult, setScanResult] = useState<BookCopyScanResponse | null>(null);
  const [myProfile, setMyProfile] = useState<UserDetailsResponse | null>(null);
  const [myIssuedBooks, setMyIssuedBooks] = useState<CirculationResponse[]>([]);
  const [selectedUserDetails, setSelectedUserDetails] = useState<UserDetailsResponse | null>(null);
  const [selectedUserIssuedBooks, setSelectedUserIssuedBooks] = useState<CirculationResponse[]>([]);
  const [generatedQr, setGeneratedQr] = useState<{ fullName: string; dataUrl: string; value: string } | null>(null);
  const [isUserDirectoryOpen, setIsUserDirectoryOpen] = useState(false);
  const [bookCopyQrValue, setBookCopyQrValue] = useState("");
  const [generateQrAfterAdd, setGenerateQrAfterAdd] = useState(false);
  const [generatedBookQrs, setGeneratedBookQrs] = useState<Array<BookCopySummary & { dataUrl: string }>>([]);
  const [registrationForm, setRegistrationForm] = useState<UserRegistrationRequest>({
    fullName: "",
    department: "",
    rollNumber: "",
    collegeEmail: "",
    password: "",
    role: "STUDENT"
  });
  const [bookForm, setBookForm] = useState<BookCreateRequest>({
    title: "",
    author: "",
    isbn: "",
    publisher: "",
    category: "",
    shelfLocation: "",
    finePerDay: 5,
    loanPeriodDays: 14,
    copyCount: 1
  });
  const [message, setMessage] = useState("");

  const activeRole = useMemo(() => currentUser?.roles[0] ?? "Guest", [currentUser]);
  const isStudent = currentUser?.roles.includes("STUDENT") ?? false;
  const canManageStudents = currentUser?.roles.some((role) => ["LIBRARIAN", "ADMIN", "SUPER_ADMIN"].includes(role)) ?? false;
  const canManageLibrarians = currentUser?.roles.some((role) => ["ADMIN", "SUPER_ADMIN"].includes(role)) ?? false;
  const canManageBooks = currentUser?.roles.some((role) => ["LIBRARIAN", "ADMIN", "SUPER_ADMIN"].includes(role)) ?? false;
  const canManageCollegeBranding = currentUser?.roles.some((role) => ["ADMIN", "SUPER_ADMIN"].includes(role)) ?? false;
  const canShowUserRegistration = canManageStudents || canManageLibrarians;
  const canShowManagement = canShowUserRegistration || canManageBooks;
  const visibleManagedUsers = useMemo(
    () => users.filter((user) => canManageLibrarians || user.roles.includes("STUDENT")),
    [canManageLibrarians, users]
  );
  const myTotalFine = useMemo(
    () => myIssuedBooks.reduce((total, book) => total + book.fineAmount, 0),
    [myIssuedBooks]
  );
  const selectedUserTotalFine = useMemo(
    () => selectedUserIssuedBooks.reduce((total, book) => total + book.fineAmount, 0),
    [selectedUserIssuedBooks]
  );

  useEffect(() => {
    searchBooks("")
      .then(setBooks)
      .catch(() => setBooks([]));
    listUsers()
      .then(setUsers)
      .catch(() => setUsers([]));
  }, []);

  function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setLogoUrl(String(reader.result));
    };
    reader.readAsDataURL(file);
  }

  async function loadCurrentUserViews(user: LoginResponse) {
    const [profile, issuedBooks, refreshedUsers] = await Promise.all([
      getUserDetails(user.userId, user.userId),
      listIssuedBooksForUser(user.userId, user.userId),
      listUsers()
    ]);

    setMyProfile(profile);
    setMyIssuedBooks(issuedBooks);
    setUsers(refreshedUsers);
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
    setGeneratedBookQrs([]);
    setBookCopyQrValue("");
    setScanResult(null);
    setScanValue("");
    setStaffBorrowerIdentifier("");
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    try {
      const user = await login(identifierType, identifier, password);
      clearSessionOnlyState();
      clearLoginInputs();
      setCurrentUser(user);
      await loadCurrentUserViews(user);
      setMessage(`Welcome, ${user.fullName}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login failed. Try the seeded student or librarian account.");
    }
  }

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBooks(await searchBooks(query));
  }

  async function handleUserScanLogin(value = userScanValue) {
    setMessage("");

    try {
      const user = await scanLogin("QR_CREDENTIAL", value);
      clearSessionOnlyState();
      clearLoginInputs();
      setCurrentUser(user);
      await loadCurrentUserViews(user);
      setMessage(`QR login approved for ${user.fullName}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "QR login failed. Try USER-QR-CS2026001.");
    }
  }

  async function resolveBookScan(type = scanType, value = scanValue) {
    setMessage("");

    try {
      setScanResult(await scanBookCopy(type, value));
    } catch (error) {
      setScanResult(null);
      setMessage(error instanceof Error ? error.message : "No book copy found for this scan value.");
    }
  }

  async function handleScan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await resolveBookScan();
  }

  async function handleIssue() {
    if (!currentUser || !scanResult) {
      setMessage("Sign in and scan a book copy before issuing.");
      return;
    }

    try {
      const transaction = await issueBookCopy(scanResult.copyId, currentUser.userId);
      await loadCurrentUserViews(currentUser);
      setBooks(await searchBooks(query));
      setMessage(`${transaction.bookTitle} issued to ${transaction.borrowerName}.`);
      setScanResult({ ...scanResult, status: "ISSUED" });
    } catch {
      setMessage("Issue failed. The copy may already be issued or unavailable.");
    }
  }

  async function handleStaffIssue() {
    if (!currentUser) {
      setMessage("Sign in as librarian or admin to issue a book to a student.");
      return;
    }

    if (!staffBorrowerIdentifier || !scanValue) {
      setMessage("Enter or scan both student details and book QR/RFID value.");
      return;
    }

    try {
      const transaction = await issueBookByIdentifier(
        currentUser.userId,
        staffBorrowerIdentifierType,
        staffBorrowerIdentifier,
        scanType,
        scanValue
      );
      setMessage(`${transaction.bookTitle} issued to ${transaction.borrowerName}. Return by ${transaction.dueOn}.`);
      setBooks(await searchBooks(query));
      if (selectedUserDetails) {
        setSelectedUserIssuedBooks(await listIssuedBooksForUser(selectedUserDetails.id, currentUser.userId));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Issue to student failed.");
    }
  }

  async function handleReturnIssuedBook(book: CirculationResponse) {
    if (!currentUser || !selectedUserDetails) {
      setMessage("Select a student before returning a book.");
      return;
    }

    try {
      const transaction = await returnBookCopy(book.bookCopyId);
      setSelectedUserIssuedBooks(await listIssuedBooksForUser(selectedUserDetails.id, currentUser.userId));
      setBooks(await searchBooks(query));
      setMessage(`${transaction.bookTitle} returned. Fine due: Rs ${transaction.fineAmount}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Return failed.");
    }
  }

  async function handleRenewIssuedBook(book: CirculationResponse) {
    if (!currentUser || !selectedUserDetails) {
      setMessage("Select a student before renewing a book.");
      return;
    }

    try {
      const transaction = await renewTransaction(book.transactionId);
      setSelectedUserIssuedBooks(await listIssuedBooksForUser(selectedUserDetails.id, currentUser.userId));
      setMessage(`${transaction.bookTitle} renewed until ${transaction.dueOn}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Renewal failed.");
    }
  }

  async function handleRegisterUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!currentUser) {
      setMessage("Sign in as librarian or admin to register users.");
      return;
    }

    try {
      const payload = {
        ...registrationForm,
        collegeEmail: registrationForm.collegeEmail || undefined
      };
      const user = await registerUser(payload, currentUser.userId);

      setUsers(await listUsers());
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
      setUsers(await listUsers());
      setMessage(`${user.fullName} removed from active users.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "User removal failed.");
    }
  }

  async function handleGenerateUserQr(user: UserSummary) {
    setGeneratedQr(null);

    if (!currentUser) {
      setMessage("Sign in as librarian or admin to generate user QR codes.");
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
      setMessage("Sign in as librarian or admin to view user details.");
      return;
    }

    try {
      const details = await getUserDetails(user.id, currentUser.userId);
      const issuedBooks = user.roles.includes("STUDENT")
        ? await listIssuedBooksForUser(user.id, currentUser.userId)
        : [];
      setSelectedUserDetails(details);
      setSelectedUserIssuedBooks(issuedBooks);
      setMessage(`Showing details for ${details.fullName}.`);
    } catch (error) {
      setSelectedUserDetails(null);
      setSelectedUserIssuedBooks([]);
      setMessage(error instanceof Error ? error.message : "Unable to load user details.");
    }
  }

  function handleDownloadQr() {
    if (!generatedQr) {
      return;
    }

    downloadDataUrl(generatedQr.dataUrl, `${generatedQr.fullName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-qr.png`);
  }

  function handleDownloadBookQr(copy: BookCopySummary & { dataUrl: string }) {
    downloadDataUrl(copy.dataUrl, `${copy.accessionNumber.toLowerCase()}-book-qr.png`);
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
      setBooks(await searchBooks(query));
      setBookForm({
        title: "",
        author: "",
        isbn: "",
        publisher: "",
        category: "",
        shelfLocation: "",
        finePerDay: 5,
        loanPeriodDays: 14,
        copyCount: 1
      });

      if (!generateQrAfterAdd) {
        setGeneratedBookQrs([]);
        setMessage(`${book.title} added to catalog.`);
        return;
      }

      try {
        const copies = await listBookCopies(book.id, currentUser.userId);
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
        setMessage(`${book.title} added. Generated ${qrImages.length} QR code(s) for the new copy/copies.`);
      } catch (error) {
        setGeneratedBookQrs([]);
        setMessage(error instanceof Error ? `${book.title} added, but QR generation failed: ${error.message}` : `${book.title} added, but QR generation failed.`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Book add failed.");
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
      setBooks(await searchBooks(query));
      setGeneratedBookQrs([]);
      setBookCopyQrValue("");
      setMessage("Book copy removed from catalog.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Book copy removal failed.");
    }
  }

  function handleLogout() {
    setCurrentUser(null);
    setMyProfile(null);
    setMyIssuedBooks([]);
    clearSessionOnlyState();
    clearLoginInputs();
    setMessage("You have been logged out.");
  }

  return (
    <main className="app-shell">
      <header className="portal-header">
        <div className="brand-block">
          <div className="college-mark">
            {logoUrl ? <img src={logoUrl} alt="College logo" /> : "CL"}
          </div>
          <div>
            <p className="eyebrow">College Portal</p>
            <h1>Central Library Management</h1>
            <p className="header-subtitle">Student registration, catalog search, circulation, and QR services.</p>
            {canManageCollegeBranding && (
              <label className="logo-upload">
                Add college logo
                <input type="file" accept="image/*" onChange={handleLogoUpload} />
              </label>
            )}
          </div>
        </div>

        <div className="session-panel">
          <Library size={22} />
          <div>
            <strong>{currentUser ? currentUser.fullName : "Not signed in"}</strong>
            <span>{currentUser ? activeRole : "Guest"}</span>
          </div>
          {currentUser && (
            <button type="button" className="logout-button" onClick={handleLogout}>
              Logout
            </button>
          )}
        </div>
      </header>

      {message && <p className="status-message">{message}</p>}

      <section className="portal-grid">
        {currentUser && myProfile && (
          <article className="panel profile-panel">
            <div className="panel-title">
              <Users size={22} />
              <div>
                <h2>{isStudent ? "My Details" : "Signed-in User"}</h2>
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
              {myProfile.identifiers.map((identifierItem) => (
                <div key={`${identifierItem.type}-${identifierItem.value}`}>
                  <dt>{identifierItem.type.replace(/_/g, " ")}</dt>
                  <dd>{identifierItem.value}</dd>
                </div>
              ))}
            </dl>

            {isStudent && (
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
                          {book.accessionNumber} · Return by {book.dueOn} · Loan {book.loanPeriodDays} days · {book.overdueDays} overdue days · Rs {book.finePerDay}/day
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
        <form className="login-card" onSubmit={handleLogin}>
          <div className="card-header">
            <Users size={22} />
            <div>
              <h2>Portal Login</h2>
              <p>Use roll number now. College email can be enabled later.</p>
            </div>
          </div>

          <label>
            Login Method
            <select value={identifierType} onChange={(event) => setIdentifierType(event.target.value as IdentifierType)}>
              <option value="ROLL_NUMBER">Roll Number</option>
              <option value="COLLEGE_EMAIL">College Email</option>
              <option value="QR_CREDENTIAL">QR Credential</option>
              <option value="RFID_CARD">RFID Card</option>
            </select>
          </label>

          <label>
            Identifier
            <input value={identifier} onChange={(event) => setIdentifier(event.target.value)} />
          </label>

          <label>
            Password / PIN
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>

          <button type="submit">Sign in</button>

          <div className="scan-login">
            <label>
              User QR Login
              <input value={userScanValue} onChange={(event) => setUserScanValue(event.target.value)} />
            </label>
            <button type="button" onClick={() => void handleUserScanLogin()}>
              Login with QR
            </button>
            <QrScanner
              label="Open Camera"
              onDetected={(value) => {
                setUserScanValue(value);
                void handleUserScanLogin(value);
              }}
            />
          </div>
        </form>
        )}

        <article className="panel">
          <div className="panel-title">
            <BookOpen size={22} />
            <div>
              <h2>Catalog Search</h2>
              <p>Search by title, author, or category.</p>
            </div>
          </div>

          <form className="inline-form" onSubmit={handleSearch}>
            <Search size={18} />
            <input placeholder="Search books" value={query} onChange={(event) => setQuery(event.target.value)} />
            <button type="submit">Search</button>
          </form>

          <div className="book-list">
            {books.map((book) => (
              <div className="book-row" key={book.id}>
                <div>
                  <strong>{book.title}</strong>
                  <span>
                    {book.author} · {book.category}
                  </span>
                </div>
                <div className="book-actions">
                  <span className="availability">{book.availableCopies}/{book.totalCopies} available</span>
                </div>
              </div>
            ))}
          </div>

        </article>

        <article className="panel">
          <div className="panel-title">
            <QrCode size={22} />
            <div>
              <h2>Scan Console</h2>
              <p>Works with QR now and can accept RFID reader values later.</p>
            </div>
          </div>

          <form className="scan-form" onSubmit={handleScan}>
            <select value={scanType} onChange={(event) => setScanType(event.target.value as ScanType)}>
              <option value="QR">QR Code</option>
              <option value="RFID">RFID Tag</option>
            </select>
            <input value={scanValue} onChange={(event) => setScanValue(event.target.value)} />
            <button type="submit">Resolve Scan</button>
          </form>
          <QrScanner
            label="Open Camera For Book QR"
            onDetected={(value) => {
              setScanType("QR");
              setScanValue(value);
              void resolveBookScan("QR", value);
            }}
          />

          {canManageBooks && (
            <div className="staff-issue-panel">
              <h3>Issue To Student</h3>
              <p>Enter student roll number, or scan the student QR, then enter or scan the book QR/RFID value.</p>
              <div className="staff-issue-grid">
                <select
                  value={staffBorrowerIdentifierType}
                  onChange={(event) => setStaffBorrowerIdentifierType(event.target.value as IdentifierType)}
                >
                  <option value="ROLL_NUMBER">Student Roll Number</option>
                  <option value="QR_CREDENTIAL">Student QR</option>
                </select>
                <input
                  placeholder="Student roll number or QR value"
                  value={staffBorrowerIdentifier}
                  onChange={(event) => setStaffBorrowerIdentifier(event.target.value)}
                />
              </div>
              <QrScanner
                label="Scan Student QR"
                onDetected={(value) => {
                  setStaffBorrowerIdentifierType("QR_CREDENTIAL");
                  setStaffBorrowerIdentifier(value);
                }}
              />
              <button type="button" onClick={() => void handleStaffIssue()}>
                Issue To Student
              </button>
            </div>
          )}

          {scanResult ? (
            <div className="scan-result">
              <span className="badge">{scanResult.status}</span>
              <h3>{scanResult.title}</h3>
              <p>{scanResult.author}</p>
              <dl>
                <div>
                  <dt>Accession</dt>
                  <dd>{scanResult.accessionNumber}</dd>
                </div>
                <div>
                  <dt>Shelf</dt>
                  <dd>{scanResult.shelfLocation}</dd>
                </div>
              </dl>
              {isStudent && (
                <div className="action-row">
                  <button type="button" onClick={handleIssue}>Issue To Me</button>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">Scan a book QR like BOOK-QR-ACC-0001 to resolve a copy.</div>
          )}
        </article>
      </section>

      {canShowManagement && (
      <section className="management-grid">
        {canShowUserRegistration && (
        <article className="panel registration-panel">
          <div className="panel-title">
            <Users size={22} />
            <div>
              <h2>User Registration</h2>
              <p>Librarians can register students. Admin can register librarians and admins.</p>
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
              placeholder="Roll number / staff code"
              value={registrationForm.rollNumber}
              onChange={(event) => setRegistrationForm({ ...registrationForm, rollNumber: event.target.value })}
            />
            <input
              placeholder="College email optional"
              value={registrationForm.collegeEmail}
              onChange={(event) => setRegistrationForm({ ...registrationForm, collegeEmail: event.target.value })}
            />
            <input
              placeholder="Password / PIN"
              type="password"
              value={registrationForm.password}
              onChange={(event) => setRegistrationForm({ ...registrationForm, password: event.target.value })}
            />
            <select
              value={registrationForm.role}
              onChange={(event) =>
                setRegistrationForm({ ...registrationForm, role: event.target.value as UserRegistrationRequest["role"] })
              }
            >
              <option value="STUDENT">Student</option>
              {canManageLibrarians && <option value="LIBRARIAN">Librarian</option>}
              {canManageLibrarians && <option value="ADMIN">Admin</option>}
            </select>
            <button type="submit">Register User</button>
          </form>

          {canManageStudents && (
            <button type="button" className="secondary-button directory-button" onClick={() => setIsUserDirectoryOpen(true)}>
              Open {canManageLibrarians ? "User Directory" : "Student Directory"}
            </button>
          )}
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
                ISBN
                <input
                  placeholder="Optional ISBN number"
                  value={bookForm.isbn}
                  onChange={(event) => setBookForm({ ...bookForm, isbn: event.target.value })}
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

            {generatedBookQrs.length > 0 && (
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
            )}

            <div className="staff-issue-panel">
              <h3>Remove Existing Copy</h3>
              <p>Enter or scan the exact QR value for the physical copy to remove.</p>
              <div className="staff-issue-grid">
                <input
                  placeholder="Example: BOOK-QR-ACC-..."
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
      </section>
      )}

      {canManageStudents && isUserDirectoryOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="User directory">
          <div className="modal-panel">
            <div className="modal-header">
              <div>
                <h2>{canManageLibrarians ? "User Directory" : "Student Directory"}</h2>
                <p>Open a user to view details, generated QR credentials, issued books, and fines.</p>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setIsUserDirectoryOpen(false);
                  setSelectedUserDetails(null);
                  setSelectedUserIssuedBooks([]);
                  setGeneratedQr(null);
                }}
              >
                Close
              </button>
            </div>

            <div className="modal-content-grid">
              <div className="user-list">
                <h3>{canManageLibrarians ? "Registered Users" : "Students"}</h3>
                {visibleManagedUsers.length === 0 ? (
                  <p>{canManageLibrarians ? "No registered users found." : "No students found."}</p>
                ) : (
                  visibleManagedUsers.map((user) => (
                    <div className="compact-row" key={user.id}>
                      <div>
                        <strong>{user.fullName}</strong>
                        <span>{user.roles.join(", ")} · {user.department}</span>
                      </div>
                      <div className="compact-actions">
                        {(user.roles.includes("STUDENT") || canManageLibrarians) && (
                          <button type="button" onClick={() => void handleViewUser(user)}>
                            View Details
                          </button>
                        )}
                        <button type="button" onClick={() => void handleGenerateUserQr(user)}>
                          Generate QR
                        </button>
                        {((user.roles.includes("STUDENT") && canManageStudents)
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
              </div>

              <div>
                {selectedUserDetails ? (
                  <div className="student-detail-card">
                    <h3>{selectedUserDetails.fullName}</h3>
                    <dl className="details-list">
                      <div>
                        <dt>Department</dt>
                        <dd>{selectedUserDetails.department}</dd>
                      </div>
                      <div>
                        <dt>Role</dt>
                        <dd>{selectedUserDetails.roles.join(", ")}</dd>
                      </div>
                      {selectedUserDetails.identifiers.map((identifierItem) => (
                        <div key={`${identifierItem.type}-${identifierItem.value}`}>
                          <dt>{identifierItem.type.replace(/_/g, " ")}</dt>
                          <dd>{identifierItem.value}</dd>
                        </div>
                      ))}
                    </dl>

                    {selectedUserDetails.roles.includes("STUDENT") && (
                      <div className="issued-list">
                        <h3>Issued Books</h3>
                        <div className="total-fine">Total Fine: Rs {selectedUserTotalFine}</div>
                        {selectedUserIssuedBooks.length === 0 ? (
                          <p>No books are currently issued to this user.</p>
                        ) : (
                          selectedUserIssuedBooks.map((book) => (
                            <div className="compact-row" key={book.transactionId}>
                              <div>
                                <strong>{book.bookTitle}</strong>
                                <span>
                                  {book.accessionNumber} · Return by {book.dueOn} · Loan {book.loanPeriodDays} days · {book.overdueDays} overdue days · Rs {book.finePerDay}/day
                                </span>
                              </div>
                              <div className="compact-actions">
                                <span className="availability">Fine Rs {book.fineAmount}</span>
                                <button type="button" onClick={() => void handleRenewIssuedBook(book)}>
                                  Renew
                                </button>
                                <button type="button" className="danger-button" onClick={() => void handleReturnIssuedBook(book)}>
                                  Return
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
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
    </main>
  );
}
