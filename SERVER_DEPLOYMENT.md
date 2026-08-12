# 🚀 Production Server Deployment Guide - CodeVerdict

This guide provides step-by-step instructions to deploy **CodeVerdict** on a Linux server (Ubuntu 22.04 LTS / Debian 12 / RHEL / AWS / DigitalOcean VPS) using **Docker Compose** with self-hosted **Judge0**, **PostgreSQL 17**, and an **Nginx** reverse proxy with SSL (Let's Encrypt).

---

## 📋 System Requirements

### Recommended Hardware Specifications
| Component | Minimum | Recommended (100+ Concurrent Exam Takers) |
|-----------|---------|------------------------------------------|
| **CPU** | 2 vCPUs | 4 - 8 vCPUs (Judge0 sandboxed execution runs in parallel) |
| **RAM** | 4 GB | 8 GB - 16 GB |
| **Disk** | 20 GB SSD | 50 GB+ NVMe SSD |
| **OS** | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS or Debian 12 |

> **Note on Judge0:** Judge0 uses Docker containers (`--privileged`) to execute untrusted user code safely inside isolated sandboxes. Linux kernel cgroups are required.

---

## 🛠️ Step 1: Server Preparation & Firewall Configuration

Log into your server via SSH:

```bash
ssh user@your-server-ip
```

### 1. Update System Packages
```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Configure Firewall (UFW)
Allow SSH, HTTP (80), and HTTPS (443):

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## 🐳 Step 2: Install Docker & Docker Compose

Run the official Docker installation script:

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add current user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker compose version
```

---

## 📂 Step 3: Clone CodeVerdict & Configure Environment

### 1. Clone Repository
```bash
git clone https://github.com/ATOAPaymentsLimited/CodeVerdict.git
cd CodeVerdict
```

### 2. Create Production Environment File (`.env`)
Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

### 3. Generate Cryptographic Secrets
Generate strong, random keys for JWT and Admin setup:

```bash
# Generate 48-byte JWT Secret
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# Generate random Admin Setup Key
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

### 4. Fill in `.env`
Edit `.env` (`nano .env` or `vim .env`) with your production values:

```ini
# ── App Database ──────────────────────────────────────────────────────────────
DB_USERNAME=sanchit.sood
DB_PASSWORD=YourStrongProductionPassword123!
DB_NAME=gl_code_platform

# ── Application ───────────────────────────────────────────────────────────────
PORT=3000
APP_NAME=CodeVerdict

# ── Auth ──────────────────────────────────────────────────────────────────────
JWT_SECRET=your_generated_jwt_secret_here
JWT_EXPIRES_IN=7d

# ── Judge0 ────────────────────────────────────────────────────────────────────
JUDGE0_URL=http://judge0-server:2358

# ── Admin Setup Key ───────────────────────────────────────────────────────────
ADMIN_SETUP_KEY=your_generated_admin_setup_key_here

# ── Leaderboard ──────────────────────────────────────────────────────────────
LEADERBOARD_CRON=0 */5 * * * *

# ── CORS (Leave blank if Nginx handles domain / reverse proxy) ───────────────
CORS_ORIGIN=
```

---

## 🚢 Step 4: Build & Launch Container Stack

Start all containers in detached mode:

```bash
docker compose up --build -d
```

### Verify Container Status
```bash
docker compose ps
```

You should see 6 running services:
- `app-db` (PostgreSQL 17 for CodeVerdict)
- `app` (NestJS API + Vue SPA production bundle on port 3000)
- `judge0-db` (PostgreSQL 16 for Judge0)
- `judge0-redis` (Redis 7.2 job queue)
- `judge0-server` (Judge0 submission manager)
- `judge0-worker` (Judge0 code execution runner)

---

## 🌐 Step 5: Configure Reverse Proxy (Nginx + SSL)

### 1. Install Nginx & Certbot
```bash
sudo apt install nginx certbot python3-certbot-nginx -y
```

### 2. Configure Nginx Virtual Host
Create `/etc/nginx/sites-available/codeverdict.conf`:

```nginx
server {
    server_name codeverdict.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 25M;
    }
}
```

Enable site & restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/codeverdict.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. Issue SSL Certificate via Let's Encrypt
```bash
sudo certbot --nginx -d codeverdict.yourdomain.com
```

---

## 🎓 Step 6: Database Seeding & Admin Account Setup

### 1. Seed Exam & Problems (Optional)
To populate sample exam problems:

```bash
docker compose exec -T app-db psql -U sanchit.sood -d gl_code_platform < exam-problems.sql
```

### 2. Bootstrap Initial Admin User
Open your browser at `https://codeverdict.yourdomain.com` and register your admin account using the `ADMIN_SETUP_KEY` defined in your `.env`.

---

## 💾 Step 7: Database Backup & Maintenance

### 1. Automated Daily Database Backup
Add a cron job (`crontab -e`):

```cron
0 2 * * * docker compose -f ~/CodeVerdict/docker-compose.yml exec -T app-db pg_dump -U sanchit.sood gl_code_platform | gzip > /backups/codeverdict_$(date +\%F).sql.gz
```

### 2. View Logs
```bash
# View all container logs
docker compose logs -f

# View application logs only
docker compose logs -f app
```

---

## 🔄 Updating CodeVerdict
To deploy new updates in production:

```bash
git pull origin main
docker compose up --build -d
```
