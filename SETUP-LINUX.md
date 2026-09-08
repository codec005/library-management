# Linux Setup Guide — College Library Management Portal

Step-by-step setup for Ubuntu/Debian and other Linux distributions.

Assumes the project is at `~/library-management`.

## What You Will Run

| App | URL | Folder |
|-----|-----|--------|
| Backend (Spring Boot) | http://localhost:8080 | `backend/` |
| Frontend (Vite React) | http://localhost:5173 | `frontend/` |
| Database | MariaDB on port `3306` | local install |

---

## Step 1 — Install Prerequisites

Ubuntu/Debian:

```bash
sudo apt update
sudo apt install -y openjdk-21-jdk maven nodejs npm git mariadb-server
sudo systemctl start mariadb
sudo systemctl enable mariadb
```

Verify tools:

```bash
java -version
mvn -version
node -v
npm -v
sudo systemctl status mariadb
```

You should see Java **21** and MariaDB **active (running)**.

---

## Step 2 — Go to the Project Folder

If you already have the repo:

```bash
cd ~/library-management
```

If you need to clone it first:

```bash
cd ~
git clone git@github.com:codec005/library-management.git library-management
cd ~/library-management
```

Confirm you are in the right place:

```bash
pwd
ls
```

You should see `backend/`, `frontend/`, and `README.md`.

---

## Step 3 — Create the MariaDB Database

Open the MariaDB client:

```bash
sudo mariadb
```

If you see `Access denied for user 'root'@'localhost'`, always use `sudo mariadb` on Linux instead of `mariadb -u root`.

Create the database and user:

```sql
CREATE DATABASE library_management;
CREATE USER 'library_user'@'localhost' IDENTIFIED BY 'library_password';
GRANT ALL PRIVILEGES ON library_management.* TO 'library_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Default connection values (from `application-mariadb.yml`):

| Setting | Value |
|---------|-------|
| Database | `library_management` |
| User | `library_user` |
| Password | `library_password` |
| Port | `3306` |

---

## Step 4 — Start the Backend

Open a terminal and run:

```bash
cd ~/library-management/backend
mvn spring-boot:run -Dspring-boot.run.profiles=mariadb
```

Wait until you see the app listening on port **8080**.

Leave this terminal open.

---

## Step 5 — Install Frontend Dependencies (with npm Cache)

Open a **second** terminal.

Use a project-local npm cache to avoid permission errors and keep cache inside the repo (ignored by git):

```bash
cd ~/library-management/frontend
npm install --cache ../.npm-cache
```

This creates `.npm-cache/` at the project root. It is safe to delete and reinstall if needed:

```bash
cd ~/library-management
rm -rf .npm-cache frontend/node_modules
cd ~/library-management/frontend
npm install --cache ../.npm-cache
```

For later npm commands in this project, you can reuse the same cache:

```bash
cd ~/library-management/frontend
npm install --cache ../.npm-cache
```

---

## Step 6 — Enable HTTPS for Camera Scanning (Optional)

Find your machine's IP:

```bash
hostname -I
```

Example output: `192.168.1.25` — use the first address as `YOUR_LOCAL_IP` below.

Install `mkcert`:

```bash
sudo apt install -y mkcert libnss3-tools
```

If your distro does not package `mkcert`, install from [https://github.com/FiloSottile/mkcert](https://github.com/FiloSottile/mkcert).

Create certificates (replace `YOUR_LOCAL_IP` with your IP from above):

```bash
mkcert -install
cd ~/library-management
mkdir -p certs
mkcert -key-file certs/library-local-key.pem -cert-file certs/library-local-cert.pem localhost 127.0.0.1 YOUR_LOCAL_IP
```

Start the HTTPS frontend:

```bash
cd ~/library-management/frontend
VITE_HTTPS_KEY=../certs/library-local-key.pem VITE_HTTPS_CERT=../certs/library-local-cert.pem npm run dev -- --host 0.0.0.0 --port 5174
```

Open from another device on the same Wi-Fi:

```text
https://YOUR_LOCAL_IP:5174
```

Example:

```text
https://192.168.1.25:5174
```

Trust the mkcert root certificate on phones/tablets if the camera is still blocked.

---

## Troubleshooting

### `sh: 1: vite: not found`

Dependencies were not installed. Run:

```bash
cd ~/library-management/frontend
npm install --cache ../.npm-cache
npm run dev
```

### npm permission or cache errors

Use the project-local cache and reinstall:

```bash
cd ~/library-management
rm -rf .npm-cache frontend/node_modules
cd ~/library-management/frontend
npm install --cache ../.npm-cache
```

Clear only the project cache (keep `node_modules`):

```bash
rm -rf ~/library-management/.npm-cache
cd ~/library-management/frontend
npm install --cache ../.npm-cache
```

### MariaDB connection failed

Check MariaDB is running:

```bash
sudo systemctl status mariadb
sudo systemctl start mariadb
```

Verify the database and user exist:

```bash
sudo mariadb -e "SHOW DATABASES LIKE 'library_management';"
sudo mariadb -e "SELECT User, Host FROM mysql.user WHERE User='library_user';"
```

If missing, repeat the SQL from Step 3.

### Backend and frontend on different machines

The default Vite proxy points to `localhost:8080` on the **frontend** machine. Run both apps on the same Linux box, or change `frontend/vite.config.ts`:

```ts
"/api": "http://BACKEND_MACHINE_IP:8080"
```

Then restart the frontend dev server.

### Port already in use

Find and stop the process using port 8080 or 5173:

```bash
sudo lsof -i :8080
sudo lsof -i :5173
```

---

## Quick Reference — Daily Dev Workflow

Terminal 1 (backend):

```bash
cd ~/library-management/backend
mvn spring-boot:run -Dspring-boot.run.profiles=mariadb
```

Terminal 2 (frontend HTTPS):

```bash
cd ~/library-management/frontend
VITE_HTTPS_KEY=../certs/library-local-key.pem VITE_HTTPS_CERT=../certs/library-local-cert.pem npm run dev -- --host 0.0.0.0 --port 5174
```

Browser: https://YOUR_LOCAL_IP:5174

---

## Raspberry Pi Autostart

For boot-time setup on Raspberry Pi OS, see the Raspberry Pi section in the main [README.md](README.md) or run:

```bash
cd ~/library-management
./deploy/raspberry-pi/install-autostart.sh
```
