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
Run `start.bat` (Command Prompt) or `./start.ps1` (PowerShell) inside `C:\Users\SUPRABHAT\.gemini\antigravity\scratch\careerconnect`.

### Option B: Manual Start

**1. Start Backend Server (Port 5000):**
```bash
cd server
npm start
```

**2. Start Frontend Client (Port 5173):**
```bash
cd client
npm run dev
```

Open your browser at **`http://localhost:5173`**.

---

## 👥 Seeded Demo Accounts (1-Click Switcher Available in Top Navbar)

- **Alex Chen** (`alexchen` / `password123`): CS Senior @ Berkeley | Full-Stack & GenAI Engineer
- **Priya Sharma** (`priyasharma` / `password123`): CS Graduate | Frontend & UI/UX Developer
- **Sarah Jenkins** (`sarahjenkins` / `password123`): Technical Recruiter @ TechCorp Innovations

---

## 🧪 Automated End-to-End Test Suite

To run the automated verification script testing all 16 flow steps:
```bash
cd server
node tests/api-flow.test.js
```

## Admin + SSO

CareerZen now includes a server-authorized admin control center and generic OIDC SSO for administrators.

### Configure OIDC

Set these server environment variables:

- `OIDC_ISSUER` — your provider issuer URL
- `OIDC_CLIENT_ID`
- `OIDC_CLIENT_SECRET`
- `OIDC_REDIRECT_URI` — normally `http://localhost:5000/api/auth/admin-sso/callback` locally
- `OIDC_ADMIN_GROUP` — trusted group/role claim value (recommended)
- `OIDC_ADMIN_EMAILS` — optional comma-separated emergency allowlist
- `CLIENT_URL` — frontend origin
- `CORS_ORIGINS` — comma-separated allowed frontend origins
- `JWT_SECRET` — random secret of at least 32 characters

Register the callback URL with your identity provider exactly as configured. The implementation uses Authorization Code + PKCE, validates issuer/audience/nonce/signature/expiry, and never accepts an `admin` role from the browser.

### Admin console

An authenticated administrator gets an **Admin** navigation item with:

- Overview metrics
- User search and role/activation management
- Job moderation
- Application visibility
- Post moderation
- Audit logs
- System/database status

Administrative mutations are protected server-side by `authenticate` + `requireAdmin` and recorded in `audit_logs`.

### Security notes

- Self-registration and Google/phone registration cannot create an admin account.
- The development demo-switch endpoint is disabled in production.
- CORS is restricted to `CORS_ORIGINS` instead of `*`.
- The JWT secret has no insecure hard-coded fallback.
- Existing credentials that were present in an old `.env` should be rotated before deployment.
## Enable local admin access

The local development environment does not create an administrator automatically, and SSO is optional.

1. Register or log in to your normal account once.
2. Stop the backend with `Ctrl+C`.
3. From the `server` folder run:

```powershell
node scripts/promote-admin.mjs your-email@example.com
```

4. Start the backend again with `npm start`.
5. Log out and log in again in the client.
6. Open the **Admin** tab.

Only run this command on your own local development database.

