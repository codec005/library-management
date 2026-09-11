#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

SERVICE_USER="${SERVICE_USER:-$(id -un)}"

PI_IP_ADDRESS="${PI_IP_ADDRESS:-$(hostname -I 2>/dev/null | awk '{print $1}')}"

DB_NAME="${DB_NAME:-library_management}"
DB_USERNAME="${DB_USERNAME:-library_user}"
DB_PASSWORD="${DB_PASSWORD:-library_password}"

DB_ADMIN_USER="${DB_ADMIN_USER:-root}"
DB_ADMIN_PASSWORD="${DB_ADMIN_PASSWORD:-}"

BACKEND_SERVICE="/etc/systemd/system/library-backend.service"
FRONTEND_SERVICE="/etc/systemd/system/library-frontend.service"

CERT_DIR="$PROJECT_DIR/certs"
CERT_KEY="$CERT_DIR/library-local-key.pem"
CERT_FILE="$CERT_DIR/library-local-cert.pem"

FRONTEND_PORT="5174"


# ============================================================
# Validate Raspberry Pi IP
# ============================================================

if [[ -z "$PI_IP_ADDRESS" ]]; then
  echo "Could not detect Raspberry Pi IP address."
  echo
  echo "Run again with PI_IP_ADDRESS set, for example:"
  echo
  echo "PI_IP_ADDRESS=192.168.1.25 $0"
  exit 1
fi


echo
echo "============================================================"
echo " Raspberry Pi Library Management Setup"
echo "============================================================"
echo
echo "Project directory : $PROJECT_DIR"
echo "Service user      : $SERVICE_USER"
echo "Pi IP address     : $PI_IP_ADDRESS"
echo "Frontend port     : $FRONTEND_PORT"
echo


# ============================================================
# MariaDB helper
# ============================================================

run_admin_sql() {

  local sql_file

  sql_file="$(mktemp)"

  cat > "$sql_file"

  if sudo mariadb -e "SELECT 1;" >/dev/null 2>&1; then

    sudo mariadb < "$sql_file"

  elif [[ -n "$DB_ADMIN_PASSWORD" ]]; then

    mariadb \
      -h 127.0.0.1 \
      -P 3306 \
      -u "$DB_ADMIN_USER" \
      -p"$DB_ADMIN_PASSWORD" \
      < "$sql_file"

  else

    echo "MariaDB root socket login failed."
    echo
    echo "Enter the MariaDB admin password for user '$DB_ADMIN_USER'."

    mariadb \
      -h 127.0.0.1 \
      -P 3306 \
      -u "$DB_ADMIN_USER" \
      -p \
      < "$sql_file"

  fi

  rm -f "$sql_file"
}


# ============================================================
# Install required packages
# ============================================================

install_packages() {

  echo
  echo "============================================================"
  echo "Installing packages"
  echo "============================================================"

  if command -v apt-get >/dev/null 2>&1; then

    sudo apt-get update

    sudo apt-get install -y \
      openjdk-21-jdk \
      maven \
      nodejs \
      npm \
      mariadb-server \
      openssl \
      psmisc

  else

    echo "apt-get not found."

    echo "Please install the following manually:"
    echo
    echo "  Java 21"
    echo "  Maven"
    echo "  Node.js"
    echo "  npm"
    echo "  MariaDB"
    echo "  OpenSSL"
    echo "  psmisc"

    exit 1

  fi
}


# ============================================================
# Setup MariaDB
# ============================================================

setup_database() {

  echo
  echo "============================================================"
  echo "Setting up MariaDB"
  echo "============================================================"

  sudo systemctl enable mariadb
  sudo systemctl start mariadb

  if mariadb \
      -h 127.0.0.1 \
      -P 3306 \
      -u "$DB_USERNAME" \
      -p"$DB_PASSWORD" \
      "$DB_NAME" \
      -e "SELECT 1;" >/dev/null 2>&1; then

    echo "MariaDB database '$DB_NAME' and user '$DB_USERNAME' already work."

    return

  fi


  echo "Creating database and user..."

  run_admin_sql <<SQL

CREATE DATABASE IF NOT EXISTS ${DB_NAME};

CREATE USER IF NOT EXISTS '${DB_USERNAME}'@'localhost'
IDENTIFIED BY '${DB_PASSWORD}';

GRANT ALL PRIVILEGES
ON ${DB_NAME}.*
TO '${DB_USERNAME}'@'localhost';

FLUSH PRIVILEGES;

SQL

  echo "MariaDB setup complete."
}


# ============================================================
# Install frontend dependencies
# ============================================================

install_frontend_dependencies() {

  echo
  echo "============================================================"
  echo "Installing frontend dependencies"
  echo "============================================================"

  cd "$PROJECT_DIR/frontend"

  npm install --cache ../.npm-cache

  npm audit fix --force || true

  echo "Frontend dependencies installed."
}


# ============================================================
# Create HTTPS certificate
# ============================================================

create_https_certificate() {

  echo
  echo "============================================================"
  echo "Creating HTTPS certificate"
  echo "============================================================"

  mkdir -p "$CERT_DIR"

  if [[ -f "$CERT_KEY" && -f "$CERT_FILE" ]]; then

    echo "HTTPS certificate already exists:"
    echo "$CERT_DIR"

    return

  fi


  openssl req \
    -x509 \
    -newkey rsa:2048 \
    -nodes \
    -keyout "$CERT_KEY" \
    -out "$CERT_FILE" \
    -days 825 \
    -subj "/CN=$PI_IP_ADDRESS" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:$PI_IP_ADDRESS"


  # Make sure the service user can read the certificate.
  sudo chown -R "$SERVICE_USER:$SERVICE_USER" "$CERT_DIR"

  chmod 600 "$CERT_KEY"
  chmod 644 "$CERT_FILE"

  echo "HTTPS certificate created."
}


# ============================================================
# Create backend systemd service
# ============================================================

write_backend_service() {

  echo
  echo "============================================================"
  echo "Creating backend systemd service"
  echo "============================================================"

  local mvn_bin

  mvn_bin="$(command -v mvn)"

  if [[ -z "$mvn_bin" ]]; then

    echo "Maven was not found."

    exit 1

  fi


  sudo tee "$BACKEND_SERVICE" >/dev/null <<SERVICE

[Unit]
Description=College Library Management Backend

After=network-online.target mariadb.service
Wants=network-online.target

[Service]

Type=simple

User=$SERVICE_USER

WorkingDirectory=$PROJECT_DIR/backend

Environment=DB_URL=jdbc:mariadb://localhost:3306/$DB_NAME
Environment=DB_USERNAME=$DB_USERNAME
Environment=DB_PASSWORD=$DB_PASSWORD

Environment=ALLOWED_ORIGINS=http://localhost:5173,http://$PI_IP_ADDRESS:5173,https://localhost:5174,https://$PI_IP_ADDRESS:5174

ExecStart=$mvn_bin spring-boot:run -Dspring-boot.run.profiles=mariadb

Restart=always
RestartSec=10

[Install]

WantedBy=multi-user.target

SERVICE

  echo "Backend service created:"
  echo "$BACKEND_SERVICE"
}


# ============================================================
# Create frontend systemd service
# ============================================================

write_frontend_service() {

  echo
  echo "============================================================"
  echo "Creating frontend systemd service"
  echo "============================================================"

  local npm_bin

  npm_bin="$(command -v npm)"

  if [[ -z "$npm_bin" ]]; then

    echo "npm was not found."

    exit 1

  fi


  sudo tee "$FRONTEND_SERVICE" >/dev/null <<SERVICE

[Unit]

Description=College Library Management Frontend

After=network-online.target library-backend.service
Wants=network-online.target

Requires=library-backend.service


[Service]

Type=simple

User=$SERVICE_USER

WorkingDirectory=$PROJECT_DIR/frontend


# HTTPS configuration

Environment=VITE_HTTPS_KEY=$CERT_KEY
Environment=VITE_HTTPS_CERT=$CERT_FILE


# ------------------------------------------------------------
# PORT PROTECTION
# ------------------------------------------------------------
#
# Kill anything currently listening on TCP 5174 before
# starting the frontend.
#
# The '+' tells systemd to execute this command with elevated
# privileges even though the main service runs as SERVICE_USER.
#

ExecStartPre=+/usr/bin/fuser -k ${FRONTEND_PORT}/tcp


# Give the old process a moment to terminate.

ExecStartPre=/bin/sleep 1


# ------------------------------------------------------------
# START VITE
# ------------------------------------------------------------
#
# --host 0.0.0.0
#     Allow other devices on the network to access the Pi.
#
# --port 5174
#     Always use port 5174.
#
# --strictPort
#     NEVER automatically change to 5175, 5176, etc.
#

ExecStart=$npm_bin run dev -- --host 0.0.0.0 --port $FRONTEND_PORT --strictPort


# Automatically restart if npm/Vite crashes.

Restart=always

RestartSec=5


[Install]

WantedBy=multi-user.target

SERVICE


  echo "Frontend service created:"
  echo "$FRONTEND_SERVICE"
}


# ============================================================
# Disable possible old frontend services
# ============================================================

disable_old_frontend_services() {

  echo
  echo "============================================================"
  echo "Checking for conflicting frontend services"
  echo "============================================================"


  # These are intentionally limited to likely names.
  # We do NOT blindly disable arbitrary Node services.

  POSSIBLE_SERVICES=(
    "frontend.service"
    "library-frontend-old.service"
    "vite.service"
    "npm.service"
  )


  for service in "${POSSIBLE_SERVICES[@]}"; do

    if systemctl list-unit-files "$service" \
        --no-legend 2>/dev/null |
        grep -q "$service"; then

      if [[ "$service" != "library-frontend.service" ]]; then

        echo "Found possible conflicting service: $service"

        sudo systemctl disable --now "$service" || true

      fi

    fi

  done
}


# ============================================================
# Kill existing process on frontend port
# ============================================================

free_frontend_port() {

  echo
  echo "============================================================"
  echo "Freeing frontend port $FRONTEND_PORT"
  echo "============================================================"


  if sudo fuser "${FRONTEND_PORT}/tcp" >/dev/null 2>&1; then

    echo "A process is currently using port $FRONTEND_PORT."

    sudo fuser -v "${FRONTEND_PORT}/tcp" || true

    echo
    echo "Stopping process..."

    sudo fuser -k "${FRONTEND_PORT}/tcp" || true

    sleep 2

  else

    echo "Port $FRONTEND_PORT is already free."

  fi


  # Verify that the port is free.

  if sudo fuser "${FRONTEND_PORT}/tcp" >/dev/null 2>&1; then

    echo
    echo "ERROR: Could not free port $FRONTEND_PORT."

    sudo fuser -v "${FRONTEND_PORT}/tcp" || true

    exit 1

  fi


  echo "Port $FRONTEND_PORT is free."
}


# ============================================================
# Enable and start services
# ============================================================

enable_services() {

  echo
  echo "============================================================"
  echo "Enabling systemd services"
  echo "============================================================"


  sudo systemctl daemon-reload


  sudo systemctl enable mariadb

  sudo systemctl enable library-backend

  sudo systemctl enable library-frontend


  echo
  echo "Starting backend..."

  sudo systemctl restart library-backend


  echo
  echo "Waiting for backend..."

  sleep 5


  echo
  echo "Starting frontend..."

  sudo systemctl restart library-frontend


  sleep 3
}


# ============================================================
# Verify services
# ============================================================

verify_services() {

  echo
  echo "============================================================"
  echo "Verifying services"
  echo "============================================================"


  echo
  echo "MariaDB:"
  sudo systemctl is-active mariadb || true


  echo
  echo "Backend:"
  sudo systemctl is-active library-backend || true


  echo
  echo "Frontend:"
  sudo systemctl is-active library-frontend || true


  echo
  echo "Port $FRONTEND_PORT:"
  sudo lsof -nP -iTCP:${FRONTEND_PORT} -sTCP:LISTEN || true


  echo
  echo "Frontend processes:"
  ps aux | grep -E 'npm|vite|node' | grep -v grep || true
}


# ============================================================
# Main
# ============================================================

main() {

  install_packages

  setup_database

  create_https_certificate

  disable_old_frontend_services

  free_frontend_port

  write_backend_service

  write_frontend_service

  enable_services

  verify_services


  echo
  echo "============================================================"
  echo " Raspberry Pi autostart setup complete"
  echo "============================================================"
  echo

  echo "Open the portal:"
  echo
  echo "  https://$PI_IP_ADDRESS:$FRONTEND_PORT"
  echo

  echo "Backend service:"
  echo
  echo "  sudo systemctl status library-backend"
  echo

  echo "Frontend service:"
  echo
  echo "  sudo systemctl status library-frontend"
  echo

  echo "Frontend logs:"
  echo
  echo "  journalctl -u library-frontend -f"
  echo

  echo "Backend logs:"
  echo
  echo "  journalctl -u library-backend -f"
  echo

  echo "Check port 5174:"
  echo
  echo "  sudo lsof -nP -iTCP:5174 -sTCP:LISTEN"
  echo

  echo "HTTPS certificate:"
  echo
  echo "  $CERT_FILE"
  echo

  echo "============================================================"
}


main "$@"