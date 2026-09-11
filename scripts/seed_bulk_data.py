#!/usr/bin/env python3
"""
Bulk-seed MariaDB for the college library management app.

Creates:
  - N catalog books with unique titles
  - 1..max_copies physical copies per book (same title, distinct copy SSNs)
  - M users across STUDENT / FACULTY / LIBRARIAN / ADMIN
  - password hash for plaintext "user" on every account (BCrypt, Spring-compatible)

Schema matches Hibernate tables:
  books, book_copies, users, user_account_roles, user_identifiers, user_credentials

Usage:
  python3 -m venv .venv && source .venv/bin/activate
  pip install -r requirements-seed.txt
  python seed_bulk_data.py --books 100000 --users 100000 --max-copies 10

Defaults connect to:
  host=127.0.0.1 port=3306 db=library_management user=library_user password=library_password

WARNING: --max-copies 1000 with --books 100000 can create tens of millions of rows.
Prefer a small max-copies (e.g. 5–20) unless you intentionally want that load.
"""

from __future__ import annotations

import argparse
import math
import random
import sys
import time
import uuid
from datetime import datetime, timezone
from typing import Iterable, Sequence

import bcrypt
import pymysql
from pymysql.connections import Connection

PASSWORD_PLAINTEXT = "user"
BATCH_SIZE = 2000

CATEGORIES = (
    "Computer Science",
    "Mathematics",
    "Physics",
    "Chemistry",
    "Biology",
    "Electronics",
    "Mechanical",
    "Civil",
    "Economics",
    "Literature",
    "History",
    "Philosophy",
)

DEPARTMENTS = (
    "CSE",
    "ECE",
    "EEE",
    "ME",
    "CE",
    "IT",
    "Mathematics",
    "Physics",
    "Chemistry",
    "Administration",
    "Library",
)

FIRST_NAMES = (
    "Aarav", "Aditi", "Ananya", "Arjun", "Diya", "Ishaan", "Kavya", "Krishna",
    "Meera", "Neha", "Om", "Priya", "Rahul", "Riya", "Rohan", "Saanvi",
    "Sahil", "Sneha", "Vikram", "Zara", "Kabir", "Anika", "Dev", "Isha",
)

LAST_NAMES = (
    "Sharma", "Patel", "Singh", "Gupta", "Kumar", "Reddy", "Nair", "Iyer",
    "Mehta", "Joshi", "Das", "Banerjee", "Chopra", "Malhotra", "Verma", "Rao",
)

TITLE_ADJECTIVES = (
    "Modern", "Advanced", "Practical", "Essential", "Applied", "Introductory",
    "Comprehensive", "Concise", "Foundational", "Experimental", "Quantitative",
    "Discrete", "Linear", "Digital", "Analog", "Distributed", "Secure",
)

TITLE_NOUNS = (
    "Algorithms", "Circuits", "Structures", "Systems", "Networks", "Databases",
    "Thermodynamics", "Mechanics", "Optics", "Algebra", "Analysis", "Design",
    "Architecture", "Compilers", "Graphics", "Robotics", "Signals", "Control",
)

PUBLISHERS = (
    "McGraw Hill", "Pearson", "Wiley", "Springer", "O'Reilly", "PHI Learning",
    "Cambridge Press", "Oxford Press", "Packt", "MIT Press",
)

AUTHORS = (
    "A. Knuth", "B. Cormen", "C. Tanenbaum", "D. Silberschatz", "E. Stroustrup",
    "F. Gamma", "G. Fowler", "H. Abelson", "I. Hopcroft", "J. Ullman",
    "K. Navathe", "L. Pressman", "M. Sommerville", "N. Patterson", "O. Hennessy",
)

ROLES = ("STUDENT", "FACULTY", "LIBRARIAN", "ADMIN")
# Rough campus mix; counts are derived from --users
ROLE_WEIGHTS = (0.85, 0.10, 0.04, 0.01)


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def bcrypt_hash(password: str) -> str:
    # $2b$ is accepted by Spring Security BCryptPasswordEncoder
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=10)).decode("utf-8")


def connect(args: argparse.Namespace) -> Connection:
    return pymysql.connect(
        host=args.host,
        port=args.port,
        user=args.db_user,
        password=args.db_password,
        database=args.database,
        charset="utf8mb4",
        autocommit=False,
        local_infile=True,
    )


def batched(items: Sequence, size: int) -> Iterable[Sequence]:
    for i in range(0, len(items), size):
        yield items[i : i + size]


def role_counts(total: int) -> dict[str, int]:
    """Largest-remainder allocation; keep campus mix and avoid zeroing small roles."""
    if total <= 0:
        return {r: 0 for r in ROLES}
    raw = [total * w for w in ROLE_WEIGHTS]
    counts = [int(math.floor(x)) for x in raw]
    remainder = total - sum(counts)
    # Give leftover seats to roles with largest fractional parts
    order = sorted(range(len(ROLES)), key=lambda i: (raw[i] - counts[i]), reverse=True)
    for i in order[:remainder]:
        counts[i] += 1
    # Ensure each non-student role appears at least once when volume allows
    for i, role in enumerate(ROLES):
        if role != "STUDENT" and counts[i] == 0 and total >= len(ROLES):
            counts[0] -= 1
            counts[i] += 1
    return dict(zip(ROLES, counts))


def unique_title(index: int, used: set[str]) -> str:
    # Deterministic uniqueness for 100k+ titles
    base = (
        f"{TITLE_ADJECTIVES[index % len(TITLE_ADJECTIVES)]} "
        f"{TITLE_NOUNS[(index // len(TITLE_ADJECTIVES)) % len(TITLE_NOUNS)]} "
        f"Vol {index}"
    )
    title = base
    suffix = 0
    while title in used:
        suffix += 1
        title = f"{base} ({suffix})"
    used.add(title)
    return title


def copy_count_for_book(max_copies: int) -> int:
    """
    Prefer fewer copies (skewed), still never exceeds max_copies (<= 1000).
    P(1)=40%, P(2-5)=35%, P(6-20)=15%, P(21-max)=10% when max is large.
    """
    if max_copies <= 1:
        return 1
    roll = random.random()
    if roll < 0.40:
        return 1
    if roll < 0.75:
        return random.randint(1, min(5, max_copies))
    if roll < 0.90:
        return random.randint(1, min(20, max_copies))
    return random.randint(1, max_copies)


def seed_books(conn: Connection, book_count: int, max_copies: int, batch_size: int) -> int:
    used_titles: set[str] = set()
    now = utc_now()
    total_copies = 0
    book_rows: list[tuple] = []
    copy_rows: list[tuple] = []

    cur = conn.cursor()
    print(f"Seeding {book_count:,} books (max {max_copies} copies each)...")

    for i in range(1, book_count + 1):
        base_ssn = f"BOOK-{i:08d}"
        title = unique_title(i, used_titles)
        author = AUTHORS[i % len(AUTHORS)]
        publisher = PUBLISHERS[i % len(PUBLISHERS)]
        category = CATEGORIES[i % len(CATEGORIES)]
        fine_per_day = 5 + (i % 10)
        loan_period_days = 7 if i % 3 else 14
        n_copies = copy_count_for_book(max_copies)

        book_rows.append(
            (base_ssn, title, author, publisher, category, fine_per_day, loan_period_days)
        )

        for c in range(1, n_copies + 1):
            copy_ssn = base_ssn if n_copies == 1 else f"{base_ssn}-{c}"
            copy_rows.append(
                (
                    str(uuid.uuid4()),
                    now,
                    now,
                    0,
                    f"ACC-{copy_ssn}",
                    f"BOOK-QR-{copy_ssn}",
                    None,
                    f"SHELF-{(i % 50) + 1:02d}-{(c % 20) + 1:02d}",
                    copy_ssn,
                    "AVAILABLE",
                    base_ssn,
                )
            )
            total_copies += 1

        if len(book_rows) >= batch_size:
            _flush_books(cur, book_rows, copy_rows)
            conn.commit()
            book_rows.clear()
            copy_rows.clear()
            if i % (batch_size * 5) == 0 or i == book_count:
                print(f"  books {i:,}/{book_count:,}  copies so far {total_copies:,}")

    if book_rows:
        _flush_books(cur, book_rows, copy_rows)
        conn.commit()

    print(f"Books done: {book_count:,} titles, {total_copies:,} copies")
    return total_copies


def _flush_books(cur, book_rows: list[tuple], copy_rows: list[tuple]) -> None:
    cur.executemany(
        """
        INSERT INTO books
          (ssn_number, title, author, publisher, category, fine_per_day, loan_period_days)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
        book_rows,
    )
    if copy_rows:
        cur.executemany(
            """
            INSERT INTO book_copies
              (id, created_at, updated_at, version, accession_number, qr_code_value,
               rfid_tag_uid_hash, shelf_location, ssn_number, status, book_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            copy_rows,
        )


def seed_users(conn: Connection, user_count: int, password_hash: str, batch_size: int) -> None:
    counts = role_counts(user_count)
    print(f"Seeding {user_count:,} users → {counts}")
    print(f"  shared BCrypt hash for password '{PASSWORD_PLAINTEXT}'")

    now = utc_now()
    cur = conn.cursor()

    users: list[tuple] = []
    roles: list[tuple] = []
    identifiers: list[tuple] = []
    credentials: list[tuple] = []

    seq = {role: 0 for role in ROLES}
    prefix = {
        "STUDENT": "STU",
        "FACULTY": "FAC",
        "LIBRARIAN": "LIB",
        "ADMIN": "ADM",
    }

    created = 0
    role_cycle: list[str] = []
    for role, n in counts.items():
        role_cycle.extend([role] * n)
    random.shuffle(role_cycle)

    for role in role_cycle:
        seq[role] += 1
        user_id = str(uuid.uuid4())
        roll = f"{prefix[role]}{seq[role]:06d}"
        full_name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
        department = (
            "Administration"
            if role == "ADMIN"
            else "Library"
            if role == "LIBRARIAN"
            else random.choice(DEPARTMENTS[:9])
        )
        email = f"{roll.lower()}@college.edu"

        users.append((user_id, now, now, 0, 1, department, full_name))
        roles.append((user_id, role))
        identifiers.append(
            (str(uuid.uuid4()), now, now, 0, "ROLL_NUMBER", roll, 1, user_id)
        )
        identifiers.append(
            (str(uuid.uuid4()), now, now, 0, "QR_CREDENTIAL", f"USER-QR-{roll}", 1, user_id)
        )
        identifiers.append(
            (str(uuid.uuid4()), now, now, 0, "COLLEGE_EMAIL", email, 1, user_id)
        )
        credentials.append((str(uuid.uuid4()), now, now, 0, password_hash, user_id))

        created += 1
        if len(users) >= batch_size:
            _flush_users(cur, users, roles, identifiers, credentials)
            conn.commit()
            users.clear()
            roles.clear()
            identifiers.clear()
            credentials.clear()
            if created % (batch_size * 5) == 0:
                print(f"  users {created:,}/{user_count:,}")

    if users:
        _flush_users(cur, users, roles, identifiers, credentials)
        conn.commit()

    print(f"Users done: {created:,}")


def _flush_users(
    cur,
    users: list[tuple],
    roles: list[tuple],
    identifiers: list[tuple],
    credentials: list[tuple],
) -> None:
    cur.executemany(
        """
        INSERT INTO users
          (id, created_at, updated_at, version, active, department, full_name)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
        users,
    )
    cur.executemany(
        "INSERT INTO user_account_roles (user_account_id, roles) VALUES (%s, %s)",
        roles,
    )
    cur.executemany(
        """
        INSERT INTO user_identifiers
          (id, created_at, updated_at, version, type, identifier_value, verified, user_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        identifiers,
    )
    cur.executemany(
        """
        INSERT INTO user_credentials
          (id, created_at, updated_at, version, password_hash, user_id)
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        credentials,
    )


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Bulk seed library MariaDB with books and users")
    p.add_argument("--books", type=int, default=100_000, help="Number of catalog titles")
    p.add_argument("--users", type=int, default=100_000, help="Number of user accounts")
    p.add_argument(
        "--max-copies",
        type=int,
        default=10,
        help="Max copies per book title (cap 1000). Default 10 to avoid huge tables.",
    )
    p.add_argument("--batch-size", type=int, default=BATCH_SIZE)
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=3306)
    p.add_argument("--database", default="library_management")
    p.add_argument("--db-user", default="library_user")
    p.add_argument("--db-password", default="library_password")
    p.add_argument("--seed", type=int, default=42, help="RNG seed for reproducibility")
    p.add_argument(
        "--skip-books",
        action="store_true",
        help="Only seed users",
    )
    p.add_argument(
        "--skip-users",
        action="store_true",
        help="Only seed books",
    )
    return p.parse_args()


def main() -> int:
    args = parse_args()
    if args.books < 0 or args.users < 0:
        print("books/users must be >= 0", file=sys.stderr)
        return 2
    if not 1 <= args.max_copies <= 1000:
        print("--max-copies must be between 1 and 1000", file=sys.stderr)
        return 2

    random.seed(args.seed)
    t0 = time.time()

    print("Generating shared BCrypt hash for password 'user'...")
    password_hash = bcrypt_hash(PASSWORD_PLAINTEXT)
    print(f"  {password_hash}")

    conn = connect(args)
    try:
        # Faster bulk load for this one-shot seed
        with conn.cursor() as cur:
            cur.execute("SET FOREIGN_KEY_CHECKS=0")
            cur.execute("SET UNIQUE_CHECKS=0")
            cur.execute("SET autocommit=0")
        conn.commit()

        if not args.skip_books and args.books > 0:
            seed_books(conn, args.books, args.max_copies, args.batch_size)
        if not args.skip_users and args.users > 0:
            seed_users(conn, args.users, password_hash, args.batch_size)

        with conn.cursor() as cur:
            cur.execute("SET FOREIGN_KEY_CHECKS=1")
            cur.execute("SET UNIQUE_CHECKS=1")
            cur.execute("SELECT COUNT(*) FROM books")
            books = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM book_copies")
            copies = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM users")
            users = cur.fetchone()[0]
            cur.execute(
                "SELECT roles, COUNT(*) FROM user_account_roles GROUP BY roles ORDER BY roles"
            )
            role_rows = cur.fetchall()
        conn.commit()

        print("\nFinal counts:")
        print(f"  books        = {books:,}")
        print(f"  book_copies  = {copies:,}")
        print(f"  users        = {users:,}")
        for role, n in role_rows:
            print(f"  role {role:12s} = {n:,}")
        print(f"\nElapsed: {time.time() - t0:.1f}s")
        print("Login example: roll STU000001 / password user")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
