# College Library Management Portal

An industry-style college library portal built with a Java Spring Boot backend and a React TypeScript frontend.

The architecture is designed so the college can start with roll-number login now, add college email login later, use QR codes for users and books, and integrate RFID without redesigning the core database.

## Tech Stack

- Backend: Java 21, Spring Boot, Spring Web, Spring Security, Spring Data JPA
- Frontend: React, TypeScript, Vite
- Local database: H2 for quick development
- External database: MariaDB using the `mariadb` Spring profile
- Optional production database: PostgreSQL profile can still be configured separately

## Project Structure

```text
backend/
  src/main/java/com/college/library/
    auth/          Login API
    catalog/       Books, physical copies, QR/RFID scan resolution
    circulation/   Issue and return flows
    config/        Security, CORS, local seed data
    identity/      Users, roles, identifiers, credentials
frontend/
  src/
    App.tsx        Main portal UI
    api.ts         Typed API client
```

## Backend Design Principles

- Controllers depend on service interfaces such as `AuthUseCase`, `CatalogService`, and `CirculationUseCase`.
- Services depend on abstractions such as `AuditLogger` and `IdentityResolver` instead of concrete implementations.
- Repository interfaces stay in the persistence layer and are hidden from controllers.
- QR and RFID are modeled as identifier inputs, not separate business workflows.
- Circulation logic is centralized so QR and RFID scans both use the same issue, return, and renew rules.

## Full Setup Guide

The project has two apps:

- Backend: Spring Boot on `http://localhost:8080`
- Frontend: Vite React on `http://localhost:5173`

Use H2 for the fastest local start. Use MariaDB when you want persistent database storage.

### 1. Install Prerequisites

macOS with Homebrew:

```bash
brew install openjdk@21 maven node
brew install --cask docker
```

If Java is not detected after installing on macOS, add it to your shell:

```bash
echo 'export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Ubuntu/Debian Linux:

```bash
sudo apt update
sudo apt install -y openjdk-21-jdk maven nodejs npm docker.io docker-compose-plugin
sudo usermod -aG docker "$USER"
```

After adding yourself to the Docker group on Linux, log out and log back in.

Windows with PowerShell:

```powershell
winget install EclipseAdoptium.Temurin.21.JDK
winget install Apache.Maven
winget install OpenJS.NodeJS
winget install Git.Git
winget install Docker.DockerDesktop
```

Restart PowerShell after installing these tools.

Verify installation on any OS:

```bash
java -version
mvn -version
node -v
npm -v
```

### 2. Start Backend With H2

H2 is the default local in-memory database. It needs no separate database setup.

macOS/Linux:

```bash
cd backend
mvn spring-boot:run
```

Windows PowerShell:

```powershell
cd backend
mvn spring-boot:run
```

The backend runs on `http://localhost:8080`.

### 3. Start Frontend

Open a second terminal.

macOS/Linux:

```bash
cd frontend
npm install
npm run dev
```

Windows PowerShell:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

### 4. Run With MariaDB

The easiest MariaDB setup is Docker.

macOS/Linux/Windows:

```bash
docker compose up -d mariadb
```

Then start the backend with the MariaDB profile.

macOS/Linux:

```bash
cd backend
mvn spring-boot:run -Dspring-boot.run.profiles=mariadb
```

Windows PowerShell:

```powershell
cd backend
mvn spring-boot:run "-Dspring-boot.run.profiles=mariadb"
```

MariaDB defaults from `docker-compose.yml` and `application-mariadb.yml`:

- Database: `library_management`
- User: `library_user`
- Password: `library_password`
- Port: `3306`

Override MariaDB settings if needed.

macOS/Linux:

```bash
export DB_URL=jdbc:mariadb://localhost:3306/library_management
export DB_USERNAME=library_user
export DB_PASSWORD=library_password
export ALLOWED_ORIGINS=http://localhost:5173
cd backend
mvn spring-boot:run -Dspring-boot.run.profiles=mariadb
```

Windows PowerShell:

```powershell
$env:DB_URL="jdbc:mariadb://localhost:3306/library_management"
$env:DB_USERNAME="library_user"
$env:DB_PASSWORD="library_password"
$env:ALLOWED_ORIGINS="http://localhost:5173"
cd backend
mvn spring-boot:run "-Dspring-boot.run.profiles=mariadb"
```

### 5. Optional Local MariaDB Without Docker

macOS:

```bash
brew install mariadb
brew services start mariadb
mariadb -u root
```

Ubuntu/Debian Linux:

```bash
sudo apt install -y mariadb-server
sudo systemctl start mariadb
sudo mariadb
```

Windows:

Install MariaDB from [https://mariadb.org/download](https://mariadb.org/download), then open the MariaDB client.

Create the database and user:

```sql
CREATE DATABASE library_management;
CREATE USER 'library_user'@'localhost' IDENTIFIED BY 'library_password';
GRANT ALL PRIVILEGES ON library_management.* TO 'library_user'@'localhost';
FLUSH PRIVILEGES;
```

Then run the backend with the `mariadb` profile as shown above.

## Demo Accounts

Admin:

- Identifier type: `ROLL_NUMBER`
- Identifier: `ADMIN001`
- Password: `admin123`
- User QR credential: `USER-QR-ADMIN001`

No default student or librarian accounts are seeded. Use the admin account to register librarians and students from the portal.

## QR And RFID Design

Users are not identified directly by only one field. The system uses a `UserAccount` plus many `UserIdentifier` records.

Supported identifier types:

- `ROLL_NUMBER`
- `COLLEGE_EMAIL`
- `PHONE_NUMBER`
- `QR_CREDENTIAL`
- `RFID_CARD`

Books are tracked at physical-copy level. Each `BookCopy` has:

- Accession number
- QR code value
- Optional RFID tag UID hash
- Shelf location
- Availability status

This means QR scanning and RFID scanning can both resolve to the same book copy and use the same issue/return logic.

## Current API Endpoints

- `POST /api/auth/login`
- `POST /api/auth/scan-login`
- `GET /api/catalog/books?query=clean`
- `GET /api/catalog/scan?type=QR&value=BOOK-QR-ACC-0001`
- `POST /api/circulation/issue`
- `POST /api/circulation/issue/by-identifier`
- `POST /api/circulation/return/{bookCopyId}`
- `POST /api/circulation/renew/{transactionId}`

## MVP Implemented In This Scaffold

- Role-ready users: student, faculty, librarian, admin, super admin.
- Roll-number login with hashed password storage.
- Passwordless QR/RFID credential login endpoint for controlled scan sessions.
- Book catalog with copy-level tracking.
- QR and RFID scan resolver for physical book copies.
- Issue, return, and renew workflows.
- Automatic overdue fine calculation in circulation responses.
- Audit records for login, scans, issue, return, and renew actions.
- H2 local database, MariaDB profile, and PostgreSQL production configuration.

## Next Features To Add

- JWT access token validation
- Admin book and user management screens
- QR code image generation
- Camera-based QR scanner integration
- Fine calculation and payment workflow
- Renewal workflow improvements
- Audit logs and reports
- PostgreSQL migration scripts using Flyway or Liquibase
