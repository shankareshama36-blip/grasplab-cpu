# GraspLab

> **Understand. See. Learn. Work on it.**
> An interactive CPU architecture lab that turns gates, ISAs, datapaths, and pipelining into something you can actually touch.

GraspLab is a multi-tenant SaaS where students build a small CPU, run real assembly on it, then pipeline and optimize it — all in the browser. Instructors get a dashboard to track progress and spot hazards.

---

## Why GraspLab

Computer architecture is usually taught as slides and diagrams. GraspLab makes every concept hands-on:

| Concept | How GraspLab teaches it |
|---|---|
| Number systems, two's complement | **Binary Lab** — live converter + signed-number playground |
| Logic gates, Boolean algebra | **Gate Sandbox** — drag-and-drop gates to build a half-adder |
| Von Neumann vs Harvard | **Architecture Museum** — animated side-by-side diagrams |
| Registers, common bus | **Register Bus Visualizer** — animated data transfers |
| ISA, instruction cycle | **Build tab** — write assembly, step through fetch/decode/execute/writeback |
| Datapath, control unit | **SVG datapath** that lights up per cycle; hardwired vs microprogrammed toggle |
| Pipelining, hazards | **Optimize tab** — 5-stage pipeline, hazard injection, forwarding toggle |
| Performance | **CPI / clock / Amdahl** dashboard with live charts |

---

## Tech Stack

**Backend**
- Python 3.12+ · FastAPI · SQLAlchemy
- Postgres (prod) / SQLite (local)
- JWT auth (bcrypt hashing) · multi-tenant by `tenant_id`

**Frontend**
- React + TypeScript + Vite
- Pure CSS, premium dark theme (glassmorphism)
- SVG/Canvas for all visualizations

**Engine**
- Pure-logic CPU simulator (no framework imports, fully unit-testable)
- Assembler · cycle engine · 5-stage pipeline · hazard detector · performance calculator

---

## Project Structure
