import { useEffect, useMemo, useState } from "react";
import { BookOpen, Library, QrCode, Search, Users } from "lucide-react";
import QrScanner from "./QrScanner";
import {
  BookCopyScanResponse,
  BookCreateRequest,
  BookSummary,
  CirculationResponse,
  IdentifierType,
  LoginResponse,
  ScanType,
  UserRegistrationRequest,
  UserSummary,
  addBook,
  issueBookCopy,
  listUsers,
  login,
  renewTransaction,
  reserveBook,
  registerStudentAsGuest,
  registerUser,
  removeBook,
  removeStudent,
  returnBookCopy,
  scanBookCopy,
  scanLogin,
  searchBooks
} from "./api";

const demoAccounts = [
  { label: "Student", identifier: "CS2026001", password: "student123" },
  { label: "Librarian", identifier: "LIB001", password: "library123" },
  { label: "Admin", identifier: "ADMIN001", password: "admin123" }
];

export default function App() {
  const [identifierType, setIdentifierType] = useState<IdentifierType>("ROLL_NUMBER");
  const [identifier, setIdentifier] = useState("CS2026001");
  const [password, setPassword] = useState("student123");
  const [userScanValue, setUserScanValue] = useState("USER-QR-CS2026001");
  const [currentUser, setCurrentUser] = useState<LoginResponse | null>(null);
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [scanType, setScanType] = useState<ScanType>("QR");
  const [scanValue, setScanValue] = useState("BOOK-QR-ACC-0001");
  const [scanResult, setScanResult] = useState<BookCopyScanResponse | null>(null);
  const [lastCirculation, setLastCirculation] = useState<CirculationResponse | null>(null);
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
    copyCount: 1
  });
  const [message, setMessage] = useState("");

  const activeRole = useMemo(() => currentUser?.roles[0] ?? "Guest", [currentUser]);
  const canManageStudents = currentUser?.roles.some((role) => ["LIBRARIAN", "ADMIN", "SUPER_ADMIN"].includes(role)) ?? false;
  const canManageLibrarians = currentUser?.roles.some((role) => ["ADMIN", "SUPER_ADMIN"].includes(role)) ?? false;
  const canManageBooks = currentUser?.roles.some((role) => ["LIBRARIAN", "ADMIN", "SUPER_ADMIN"].includes(role)) ?? false;
  const canShowUserRegistration = !currentUser || canManageStudents || canManageLibrarians;
  const canShowManagement = canShowUserRegistration || canManageBooks;

  useEffect(() => {
    searchBooks("")
      .then(setBooks)
      .catch(() => setBooks([]));
    listUsers()
      .then(setUsers)
      .catch(() => setUsers([]));
  }, []);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    try {
      const user = await login(identifierType, identifier, password);
      setCurrentUser(user);
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
      setCurrentUser(user);
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
      setLastCirculation(transaction);
      setMessage(`${transaction.bookTitle} issued to ${transaction.borrowerName}.`);
      setScanResult({ ...scanResult, status: "ISSUED" });
    } catch {
      setMessage("Issue failed. The copy may already be issued or unavailable.");
    }
  }

  async function handleReturn() {
    if (!scanResult) {
      setMessage("Scan a book copy before returning.");
      return;
    }

    try {
      const transaction = await returnBookCopy(scanResult.copyId);
      setLastCirculation(transaction);
      setMessage(`${transaction.bookTitle} returned. Fine due: Rs ${transaction.fineAmount}.`);
      setScanResult({ ...scanResult, status: "AVAILABLE" });
    } catch {
      setMessage("Return failed. The copy may not be currently issued.");
    }
  }

  async function handleRenew() {
    if (!lastCirculation) {
      setMessage("Issue a book first so there is a transaction to renew.");
      return;
    }

    try {
      const transaction = await renewTransaction(lastCirculation.transactionId);
      setLastCirculation(transaction);
      setMessage(`Renewed until ${transaction.dueOn}.`);
    } catch {
      setMessage("Renewal failed. Only active issued books can be renewed.");
    }
  }

  async function handleReserve(book: BookSummary) {
    if (!currentUser) {
      setMessage("Sign in before reserving a book.");
      return;
    }

    try {
      const reservation = await reserveBook(book.id, currentUser.userId);
      setMessage(`${reservation.bookTitle} reserved until ${reservation.expiresOn}.`);
    } catch {
      setMessage("Reservation failed. Please try again.");
    }
  }

  async function handleRegisterUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    try {
      const payload = {
        ...registrationForm,
        collegeEmail: registrationForm.collegeEmail || undefined
      };
      const user = currentUser
        ? await registerUser(payload, currentUser.userId)
        : await registerStudentAsGuest(payload);

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

  async function handleRemoveStudent(studentId: string) {
    if (!currentUser) {
      setMessage("Sign in as librarian or admin to remove a student.");
      return;
    }

    try {
      await removeStudent(studentId, currentUser.userId);
      setUsers(await listUsers());
      setMessage("Student removed from active users.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Student removal failed.");
    }
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
        copyCount: 1
      });
      setMessage(`${book.title} added to catalog.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Book add failed.");
    }
  }

  async function handleRemoveBook(bookId: string) {
    if (!currentUser) {
      setMessage("Sign in as librarian or admin to remove books.");
      return;
    }

    try {
      await removeBook(bookId, currentUser.userId);
      setBooks(await searchBooks(query));
      setMessage("Book removed from catalog.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Book removal failed.");
    }
  }

  function handleLogout() {
    setCurrentUser(null);
    setLastCirculation(null);
    setMessage("You have been logged out.");
  }

  return (
    <main className="app-shell">
      <header className="portal-header">
        <div className="brand-block">
          <div className="college-mark">CL</div>
          <div>
            <p className="eyebrow">College Portal</p>
            <h1>Central Library Management</h1>
            <p className="header-subtitle">Student registration, catalog search, circulation, and QR services.</p>
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

          <div className="demo-accounts">
            {demoAccounts.map((account) => (
              <button
                type="button"
                key={account.identifier}
                onClick={() => {
                  setIdentifierType("ROLL_NUMBER");
                  setIdentifier(account.identifier);
                  setPassword(account.password);
                }}
              >
                Use {account.label}
              </button>
            ))}
          </div>

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
                  <span>{book.author} · {book.category}</span>
                </div>
                <div className="book-actions">
                  <span className="availability">{book.availableCopies}/{book.totalCopies} available</span>
                  <button type="button" onClick={() => handleReserve(book)}>Reserve</button>
                  {canManageBooks && (
                    <button type="button" className="danger-button" onClick={() => handleRemoveBook(book.id)}>
                      Remove
                    </button>
                  )}
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
              <div className="action-row">
                <button type="button" onClick={handleIssue}>Issue</button>
                <button type="button" onClick={handleReturn}>Return</button>
                <button type="button" onClick={handleRenew}>Renew Last</button>
              </div>
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
              <p>Guests can register students. Admin can register librarians.</p>
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
            </select>
            <button type="submit">Register User</button>
          </form>

          {canManageStudents && (
            <div className="user-list">
              <h3>Active Students</h3>
              {users
                .filter((user) => user.roles.includes("STUDENT"))
                .map((user) => (
                  <div className="compact-row" key={user.id}>
                    <span>{user.fullName}</span>
                    <button type="button" className="danger-button" onClick={() => handleRemoveStudent(user.id)}>
                      Remove
                    </button>
                  </div>
                ))}
            </div>
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
              <input
                placeholder="Book title"
                value={bookForm.title}
                onChange={(event) => setBookForm({ ...bookForm, title: event.target.value })}
              />
              <input
                placeholder="Author"
                value={bookForm.author}
                onChange={(event) => setBookForm({ ...bookForm, author: event.target.value })}
              />
              <input
                placeholder="ISBN optional"
                value={bookForm.isbn}
                onChange={(event) => setBookForm({ ...bookForm, isbn: event.target.value })}
              />
              <input
                placeholder="Publisher optional"
                value={bookForm.publisher}
                onChange={(event) => setBookForm({ ...bookForm, publisher: event.target.value })}
              />
              <input
                placeholder="Category"
                value={bookForm.category}
                onChange={(event) => setBookForm({ ...bookForm, category: event.target.value })}
              />
              <input
                placeholder="Shelf location"
                value={bookForm.shelfLocation}
                onChange={(event) => setBookForm({ ...bookForm, shelfLocation: event.target.value })}
              />
              <input
                min={1}
                type="number"
                value={bookForm.copyCount}
                onChange={(event) => setBookForm({ ...bookForm, copyCount: Number(event.target.value) })}
              />
              <button type="submit">Add Book</button>
            </form>
          </article>
        )}
      </section>
      )}
    </main>
  );
}
