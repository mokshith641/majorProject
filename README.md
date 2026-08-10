# AI-Based Smart Meeting Assistant with Participant Engagement Monitoring

An intelligent enterprise-style SaaS application designed to record meetings, generate executive transcripts using local **faster-whisper** models, extract summaries and action lists via **Groq Llama 3.1 8B**, monitor participant focus/telemetry (Webcam face gaze attention via **OpenCV** + **MediaPipe** and desktop activity via **pynput**), and export high-fidelity PDF reports via **ReportLab**.

---

## Technical Architecture Overview

- **Frontend**: React (v19) + TypeScript + Vite + Tailwind CSS + Recharts + Framer Motion
- **Backend**: FastAPI + SQLAlchemy + SQLite (local development) / PostgreSQL + Pydantic
- **AI Core**: Groq Cloud SDK (Llama 3.1 8B Instant)
- **Local Machine Learning**: faster-whisper (local CPU/GPU model)
- **Computer Vision**: OpenCV + MediaPipe FaceMesh (Gaze direction classification)
- **Desktop Telemetry**: pynput (key strokes/clicks count) + pygetwindow (active focused application)
- **Document Generator**: ReportLab (PDF compiler)

---

## Quickstart Installation (Windows Setup)

### Prerequisites
1. **Python 3.10+** installed.
2. **NodeJS 18+** installed.
3. **C++ Compilers** (PortAudio requires compiling wheels. For a seamless audio install on Windows, the dependencies use `sounddevice` which bundles pre-compiled PortAudio DLLs).

---

### Step 1: Run the Backend Service

1. Navigate to the backend directory:
   ```powershell
   cd backend
   ```

2. Create a Python virtual environment:
   ```powershell
   python -m venv venv
   ```

3. Activate the virtual environment:
   ```powershell
   .\venv\Scripts\Activate.ps1
   ```

4. Install the backend libraries:
   ```powershell
   pip install -r requirements.txt
   ```

5. (Optional) Run the local database container if PostgreSQL is preferred:
   ```powershell
   docker-compose up -d
   ```
   *Note: By default, the application is configured to fall back to a local SQLite database (`./sql_app.db`) for lightweight configuration-free runs.*

6. Launch the FastAPI development server:
   ```powershell
   uvicorn app.main:app --reload
   ```
   - Swagger Documentation: `http://localhost:8000/docs`

---

### Step 2: Run the Frontend React Client

1. Open a new terminal and navigate to the frontend directory:
   ```powershell
   cd frontend
   ```

2. Install dependency packages:
   ```powershell
   npm install
   ```

3. Launch the Vite development server:
   ```powershell
   npm run dev
   ```
   - Client Portal: `http://localhost:5173/`

---

## Configuration Settings

Copy `.env.example` to `.env` in the `backend/` directory:
- **`DATABASE_URL`**: Set database connection string.
- **`GROQ_API_KEY`**: Put Groq Developer API token (leave blank to run the system with mock summaries/Q&A fallback data).
- **`WHISPER_MODEL_NAME`**: Set `tiny` (default) or `base` for local speech-to-text.

---

## Core Operational Workflow

```
[ User Register/Login ]
        │
        ▼
[ Dashboard (Overview & Charts) ]
        │
        ▼
[ Create / Start Meeting ] ──► Starts local Mic capture, OpenCV Webcam gaze tracking, & inputs listener
        │
        ▼
[ Live Meeting Workspace ] ──► Shows client-side camera preview & streams live duration
        │
        ▼
[ End Session Trigger ] ──► Release hardware. Runs local Whisper. Synthesizes Llama notes. Compiles PDF.
        │
        ▼
[ Meeting Details Summary ] ──► Inspects transcripts, engagement charts, & downloads PDF reports
```
