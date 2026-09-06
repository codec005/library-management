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

if [[ -z "$PI_IP_ADDRESS" ]]; then
  echo "Could not detect Raspberry Pi IP address."
  echo "Run again with PI_IP_ADDRESS set, for example:"
  echo "PI_IP_ADDRESS=192.168.1.25 $0"
  exit 1
fi

echo "Project directory: $PROJECT_DIR"
echo "Service user: $SERVICE_USER"
echo "Pi IP address: $PI_IP_ADDRESS"

run_admin_sql() {
  local sql_file
  sql_file="$(mktemp)"
  cat > "$sql_file"

  if sudo mariadb -e "SELECT 1;" >/dev/null 2>&1; then
    sudo mariadb < "$sql_file"
  elif [[ -n "$DB_ADMIN_PASSWORD" ]]; then
    mariadb -h 127.0.0.1 -P 3306 -u "$DB_ADMIN_USER" -p"$DB_ADMIN_PASSWORD" < "$sql_file"
  else
    echo "MariaDB root socket login failed."
    echo "Enter the MariaDB admin password for user '$DB_ADMIN_USER' when prompted."
    mariadb -h 127.0.0.1 -P 3306 -u "$DB_ADMIN_USER" -p < "$sql_file"
  fi

  rm -f "$sql_file"
}

install_packages() {
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y openjdk-21-jdk maven nodejs npm mariadb-server openssl
  else
    echo "apt-get not found. Install Java 21, Maven, Node.js, npm, MariaDB, and OpenSSL manually."
  fi
}

setup_database() {
  sudo systemctl enable mariadb
  sudo systemctl start mariadb

  if mariadb -h 127.0.0.1 -P 3306 -u "$DB_USERNAME" -p"$DB_PASSWORD" "$DB_NAME" -e "SELECT 1;" >/dev/null 2>&1; then
    echo "MariaDB database '$DB_NAME' and user '$DB_USERNAME' already work."
    return
  fi

  run_admin_sql <<SQL
CREATE DATABASE IF NOT EXISTS ${DB_NAME};
CREATE USER IF NOT EXISTS '${DB_USERNAME}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USERNAME}'@'localhost';
FLUSH PRIVILEGES;
SQL
}

install_frontend_dependencies() {
  cd "$PROJECT_DIR/frontend"
  npm install
}

create_https_certificate() {
  mkdir -p "$CERT_DIR"

  if [[ -f "$CERT_KEY" && -f "$CERT_FILE" ]]; then
    echo "HTTPS certificate already exists in $CERT_DIR"
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
}

write_backend_service() {
  local mvn_bin
  mvn_bin="$(command -v mvn)"

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
}

write_frontend_service() {
  local npm_bin
  npm_bin="$(command -v npm)"

  sudo tee "$FRONTEND_SERVICE" >/dev/null <<SERVICE
[Unit]
Description=College Library Management Frontend
After=network-online.target library-backend.service
Wants=network-online.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$PROJECT_DIR/frontend
Environment=VITE_HTTPS_KEY=$CERT_KEY
Environment=VITE_HTTPS_CERT=$CERT_FILE
ExecStart=$npm_bin run dev -- --host 0.0.0.0 --port 5174
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICE
}

enable_services() {
  sudo systemctl daemon-reload
  sudo systemctl enable library-backend
  sudo systemctl enable library-frontend
  sudo systemctl restart library-backend
  sudo systemctl restart library-frontend
}

install_packages
setup_database
install_frontend_dependencies
create_https_certificate
write_backend_service
write_frontend_service
enable_services

cat <<DONE

Raspberry Pi autostart setup complete.

Open the portal:
  https://$PI_IP_ADDRESS:5174

Check status:
  sudo systemctl status library-backend
  sudo systemctl status library-frontend

View logs:
  journalctl -u library-backend -f
  journalctl -u library-frontend -f

If another device does not trust the HTTPS certificate, import/trust:
  $CERT_FILE
DONE
