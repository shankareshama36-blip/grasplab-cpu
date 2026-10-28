# GraspLab

> **Understand. See. Learn. Work on it.**
> An interactive CPU architecture IDE and visual lab that turns logic gates, ISAs, datapaths, and 5-stage pipelining into something you can touch and experiment with in real time.

GraspLab is a multi-tenant computer architecture lab where students write RISC-V, MIPS, or x86 assembly, step backward and forward through a live SVG datapath, inspect 5-stage pipeline hazards (`RAW`, `Load-Use`, `Control`, `Structural`), and compare hardware forwarding ON vs. OFF — while instructors get real-time classroom analytics and 1-click program inspection in the simulator.

---

## Core Interactive Capabilities

| Module | What You Can Do |
|---|---|
| **Unified IDE Workspace** | Collapsible project explorer sidebar, persistent code/state across tabs, Live Scratchpad mode (simulate without saving first), starter benchmark templates, and 1-click Student ↔ Instructor role switching |
| **🛠️ CPU Simulator (`BuildTab`)** | Multi-ISA assembly editor (`RISC-V`, `MIPS`, `x86`), active instruction line highlighting (`▶`), Step Back / Step Forward / Auto-Play with speed control & timeline scrubber, interactive SVG Datapath (`Hardwired` vs. `Microprogrammed` control unit), clickable execution trace, and editable RAM (`[0..255]`) |
| **🚀 Pipeline & Hazards (`OptimizeTab`)** | 5-Stage (`IF`, `ID`, `EX`, `MEM`, `WB`) cycle-by-cycle space-time matrix with Auto-Play & scrubber, `Forwarding ON vs. OFF` side-by-side comparison card, active hazard diagnostics, and an SVG **Amdahl's Law** speedup curve chart |
| **📘 Concept Labs (`LearnTab`)** | **Binary & Bitwise ALU Lab** (signed Two's Complement + bitwise `AND`/`OR`/`XOR`/`SHL`/`SHR`), **Logic Gate & 1-Bit Half-Adder SVG Circuit**, **Von Neumann vs. Harvard** structural bus contention stepper, and **3-Port Register File & Shared Bus** RTL transfer simulator |
| **🎓 Classroom Analytics (`InstructorDashboard`)** | Tenant-wide KPI cards, search & hazard filters, student run history, assembly source code preview, and **🛠️ Open in Simulator** to load any student program directly into the interactive CPU debugger |

---

## Project Structure

```text
GraspLab/
├── backend/
│   ├── app/
│   │   ├── engine/         # Pure-logic CPU & 5-stage pipeline engine (isa, assembler, cpu, pipeline, performance)
│   │   ├── auth.py         # JWT authentication & bcrypt password hashing
│   │   ├── database.py     # SQLAlchemy engine & session management
│   │   ├── main.py         # FastAPI endpoints (/auth, /programs, /simulate, /tools, /instructor)
│   │   ├── models.py       # Multi-tenant User, Program, RunResult models & starter program seeder
│   │   └── schemas.py      # Pydantic request/response schemas
│   ├── tests/              # Pytest unit & API integration suite
│   └── requirements.txt    # Python backend dependencies
└── frontend/
    ├── src/
    │   ├── components/     # Reusable Modal, Skeleton, and Toast components
    │   ├── context/        # AuthContext & ToastContext
    │   ├── pages/          # StudentDashboard (IDE shell), InstructorDashboard, LoginPage, SignupPage
    │   │   └── tabs/       # BuildTab, OptimizeTab, LearnTab
    │   ├── services/       # Typed REST API client
    │   └── styles/         # Dark glassmorphism design system (theme.css)
    ├── package.json
    └── vite.config.ts      # Vite dev server with API proxy to port 8000
```

---

## Quick Start (Local Setup)

### 1. Backend API Server (Port 8000)
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
cd backend && uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Dev Server (Port 5173)
```bash
cd frontend
npm install
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## 🔑 Pre-Seeded Demo Accounts

Use the **1-Click Demo** buttons on the login screen or sign in with:

- **Student Account**: `demo@grasplab.dev` (Password: `demo1234`)
- **Alternative Student**: `student@grasplab.dev` (Password: `student123`)
- **Instructor Account**: `instructor@grasplab.dev` (Password: `instructor123`)

---

## 🧪 Automated Verification

```bash
# Run backend unit & API test suite
cd backend && ../.venv/bin/pytest -q

# Type-check and build production frontend bundle
cd frontend && npm run build
```
