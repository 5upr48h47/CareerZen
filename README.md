# 🚀 CareerZen — Next-Gen Professional Network & Career Platform for Early Talent

CareerZen is an AI-ready professional networking and career platform engineered specifically for **students, freshers, and early-career talent**. It prioritizes project-first portfolios, transparent skills matching, and direct communication between early talent and university/technical recruiters.

---

## 🌟 Complete 16-Step MVP Flow Supported

1. **User Opens CareerZen**: Modern, responsive UI with dark/light mode and quick demo access.
2. **User Registers**: Role selection (`Student / Fresher` vs `Technical Recruiter`), profile setup.
3. **User Logs In**: Secure JWT session persistence with demo switcher for instant role toggling.
4. **Professional Profile**: Custom headline, bio, location, education, internships, portfolio & GitHub links.
5. **Verified Skills**: Categorized skills tagger (Frontend, Backend, AI/ML, DevOps, Database, Design) with proficiency levels.
6. **Post Creation**: Rich feed composer with tags (#BuildInPublic, #StudentProject, #Fresher2026), media link support, and topic categorization.
7. **Feed Visibility**: Interactive live feed with category filters (Project Showcase, Hiring, Career Updates, Questions).
8. **Post Engagement**: Real-time Likes toggle, comment threads with instant notifications.
9. **Networking & Connections**: Connection requests, Accept/Decline management, Suggested Peers & Mentors discovery.
10. **Company Management**: Recruiter company profile setup (logo, industry, perks, culture).
11. **Job Postings**: Recruiter job publisher (Fresher / Intern roles, Remote/Hybrid, Required skills, Salary ranges).
12. **Job Search & Filters**: Multi-faceted filter by keyword, location, workplace type, experience level, job type, and required skill.
13. **Skill-Matched Application**: Real-time skill match percentage calculator, 1-click apply modal with cover note and resume link.
14. **Recruiter Applicant Pipeline**: Recruiter applicant review drawer with candidate skills match, portfolio preview, and status updates (`Under Review`, `Shortlisted`, `Interview`, `Hired`, `Archived`).
15. **1-on-1 Direct Messaging**: Real-time chat interface with unread badges and WebSocket delivery.
16. **Live Notifications**: Real-time toast alerts and top-bar notification center for likes, comments, connections, application updates, and messages.

---

## ⚡ Quick Start

### Option A: Using the Launcher
Run `start.bat` (Command Prompt) or `./start.ps1` (PowerShell) inside the repo root.

### Option B: Manual Start

**1. Start Backend Server (Port 5009):**
```bash
cd server
npm start
```

**2. Start Frontend Client (Port 5173):**
```bash
cd client
npm run dev
```

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite 6 + Tailwind CSS |
| Backend | Node.js + Express 4 |
| Database | SQLite (dev) / PostgreSQL (prod) via Prisma ORM |
| Auth | JWT + bcrypt |
| Real-time | WebSocket (`ws` library) |
| Payments | Razorpay |
| AI | Google Gemini API |
| Hosting | Render (free tier) |

---

## 📦 Deploy (Render Free Tier)

1. Push this repo to GitHub
2. Render Dashboard → **New → Blueprint** → select repo
3. Render provisions:
   - Web service (Node, free)
   - PostgreSQL database (free, 30-day expiry)
4. Set these env vars in Render dashboard (marked `sync: false`):
   - `CORS_ORIGINS` = `https://your-app.onrender.com`
   - `CLIENT_URL` = `https://your-app.onrender.com`
   - `RAZORPAY_KEY_ID` = `rzp_live_...`
   - `RAZORPAY_KEY_SECRET` = from Razorpay dashboard
   - `GEMINI_API_KEY` = optional, enables real LLM inference
5. First deploy auto-runs `prisma db push` to create tables

---

## 🔐 Security

- `.env` files are gitignored
- JWT secret auto-generated on Render
- Rate limiting on auth endpoints
- Helmet + CSP headers
- CORS restricted to configured origins
- Demo accounts (password123) only seed if `SEED_DEMO=true`

---

## 📄 License

MIT License — see [LICENSE](LICENSE)
