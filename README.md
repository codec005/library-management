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

## Run Locally

Start backend:

```bash
cd backend
mvn spring-boot:run
```

Start frontend:

```bash
cd frontend
npm install
npm run dev
```

Open the frontend at `http://localhost:5173`.

Optional MariaDB container:

```bash
docker compose up -d
```

Run backend with MariaDB:

```bash
cd backend
mvn spring-boot:run -Dspring-boot.run.profiles=mariadb
```

The included MariaDB defaults are:

- Database: `library_management`
- User: `library_user`
- Password: `library_password`
- Port: `3306`

You can override these values without changing code:

```bash
export DB_URL=jdbc:mariadb://localhost:3306/library_management
export DB_USERNAME=library_user
export DB_PASSWORD=library_password
export ALLOWED_ORIGINS=http://localhost:5173
cd backend
mvn spring-boot:run -Dspring-boot.run.profiles=mariadb
```

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
