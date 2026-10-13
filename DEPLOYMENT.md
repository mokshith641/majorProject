# Meet Assistant - Production Deployment Guide

This guide provides end-to-end instructions for deploying the **Meet Assistant** application in production environments using **Docker Compose**, **Cloud Hosting (PaaS)**, or **Virtual Private Servers (VPS)**.

---

## 1. Architecture Overview

```
                      +-----------------------------+
                      |   Client Browser / Mobile   |
                      +--------------+--------------+
                                     |
                                     | HTTP / HTTPS & WebSockets
                                     v
                 +-------------------+-------------------+
                 |         Nginx Reverse Proxy           |
                 |      (Port 80 / 443 with SSL)         |
                 +---------+-------------------+---------+
                           |                   |
            Static SPA /   |                   | /api/* & /api/v1/meetings/*/ws
            Asset Requests |                   |
                           v                   v
                +--------------------+   +-----------------------+
                |   React Frontend   |   |    FastAPI Backend    |
                |   (Vite / Tailwind)|   | (Python 3.11, Uvicorn)|
                +--------------------+   +-----------+-----------+
                                                     |
                         +---------------------------+---------------------------+
                         |                           |                           |
                         v                           v                           v
              +----------------------+   +-----------------------+   +-----------------------+
              | PostgreSQL Database  |   | Persistent Storage    |   | External AI APIs      |
              | (Port 5432)          |   | (/app/data/recordings |   | - Groq Whisper        |
              |                      |   |  /app/data/reports)   |   | - Google Gemini       |
              +----------------------+   +-----------------------+   | - AssemblyAI          |
                                                                     +-----------------------+
```

---

## 2. Prerequisites

Before deploying, ensure you have:
- **Docker** (v24.0+) & **Docker Compose** (v2.20+) installed on your server.
- API keys from external AI providers:
  - **Groq API Key**: [https://console.groq.com](https://console.groq.com)
  - **Google Gemini API Key**: [https://aistudio.google.com](https://aistudio.google.com)
  - **AssemblyAI API Key**: [https://www.assemblyai.com](https://www.assemblyai.com)
- A domain name pointing to your server IP (if setting up SSL/HTTPS).

---

## 3. Quick Start Deployment with Docker Compose (Recommended)

### Step 1: Clone the Repository
```bash
git clone https://github.com/mokshith641/majorProject.git
cd majorProject
```

### Step 2: Configure Environment Variables
Copy the root `.env.example` file to `.env`:
```bash
cp .env.example .env
```

Edit `.env` using `nano` or your favorite editor:
```bash
nano .env
```

Populate the required values:
```env
# Port for the frontend/reverse proxy
PORT=80

# PostgreSQL Configuration
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_db_password
POSTGRES_DB=meeting_assistant

# Security Key (Generate with: openssl rand -hex 32)
SECRET_KEY=e8c2f10b784a6c8e3...your_random_hex_key...

# AI Services Keys
GROQ_API_KEY=gsk_your_groq_api_key
GEMINI_API_KEY=AIzaSy_your_gemini_api_key
ASSEMBLYAI_API_KEY=your_assemblyai_api_key

# Transcription options
GROQ_TRANSCRIPTION_MODEL=whisper-large-v3-turbo
TRANSCRIPTION_LANGUAGE=auto
ENABLE_TRANSCRIPT_CLEANUP=True
```

### Step 3: Build and Launch Containers
```bash
docker compose up -d --build
```

### Step 4: Verify Deployment Health
Check running container status:
```bash
docker compose ps
```
You should see all three containers healthy:
- `meeting_assistant_db` (`healthy`)
- `meeting_assistant_backend` (`healthy`)
- `meeting_assistant_frontend` (`healthy`)

Check real-time application logs:
```bash
docker compose logs -f backend
```

Access the application in your browser at `http://your-server-ip` or `http://localhost`.

---

## 4. Setting up SSL / HTTPS with Let's Encrypt (Certbot)

To secure your production deployment with HTTPS:

### Option A: Cloudflare SSL (Easiest)
1. Point your domain DNS `A` record to your server IP via Cloudflare.
2. In Cloudflare Dashboard, set SSL/TLS encryption mode to **Full** or **Flexible**.
3. Enable **Always Use HTTPS**.
4. Traffic is automatically encrypted between users and Cloudflare.

### Option B: Certbot + Nginx on VPS Host
If terminating SSL on the host VPS:
1. Install Certbot:
   ```bash
   sudo apt update && sudo apt install -y certbot
   ```
2. Generate SSL certificates:
   ```bash
   sudo certbot certonly --standalone -d yourdomain.com
   ```
3. Map the generated certificates into `docker-compose.yml` frontend volumes:
   ```yaml
   volumes:
     - /etc/letsencrypt/live/yourdomain.com/fullchain.pem:/etc/nginx/certs/fullchain.pem:ro
     - /etc/letsencrypt/live/yourdomain.com/privkey.pem:/etc/nginx/certs/privkey.pem:ro
   ```

---

## 5. Alternative Cloud Platform Deployments

### A. Backend on Render / Railway
1. **Repository**: Connect your GitHub repository.
2. **Root Directory**: Select `backend`.
3. **Environment**: Python 3.11.
4. **Build Command**:
   ```bash
   apt-get update && apt-get install -y ffmpeg libsndfile1 libportaudio2 && pip install -r requirements.txt
   ```
5. **Start Command**:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 2
   ```
6. **Managed Database**: Create a PostgreSQL instance on Render/Supabase/Neon and add `DATABASE_URL` to environment variables.
7. **Persistent Disk**: Attach a persistent disk mounted to `/app/data` to retain audio recordings and reports.

### B. Frontend on Vercel / Netlify
1. **Root Directory**: Select `frontend`.
2. **Framework Preset**: Vite.
3. **Build Command**: `npm run build`
4. **Output Directory**: `dist`
5. **Environment Variables**:
   - `VITE_API_URL`: `https://your-backend.onrender.com/api/v1`
   - `VITE_WS_URL`: `wss://your-backend.onrender.com`

---

## 6. Backup & Maintenance

### Database Backup
Backup the PostgreSQL database to a SQL dump:
```bash
docker exec -t meeting_assistant_db pg_dump -U postgres meeting_assistant > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Database Restore
Restore a previous dump:
```bash
cat backup.sql | docker exec -i meeting_assistant_db psql -U postgres -d meeting_assistant
```

### Audio Recordings & Reports Backup
The persistent audio recordings and PDF reports are stored in named Docker volumes:
- `majorproject_recordings_data`
- `majorproject_reports_data`

To copy files directly out of the container:
```bash
docker cp meeting_assistant_backend:/app/data/recordings ./backup_recordings/
docker cp meeting_assistant_backend:/app/data/reports ./backup_reports/
```

### Updating to the Latest Code
To pull updates and rebuild without downtime:
```bash
git pull origin main
docker compose up -d --build --remove-orphans
```

---

## 7. Troubleshooting

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| **Audio upload fails (413 Request Entity Too Large)** | Nginx upload size restriction | Ensure `client_max_body_size 500M;` is present in `frontend/nginx.conf`. |
| **WebSocket disconnects during Live Meeting** | Missing proxy headers | Verify `Upgrade` and `Connection "Upgrade"` headers are present in `frontend/nginx.conf`. |
| **Missing speaker diarization** | AssemblyAI key missing | Ensure `ASSEMBLYAI_API_KEY` is configured in `.env`. |
| **CORS errors on frontend** | Mismatched domains | In split deployments, verify `VITE_API_URL` points to the correct backend host. |
| **Database connection refused** | Postgres still starting up | Check healthcheck status with `docker compose ps`. Backend waits for database to be healthy. |
