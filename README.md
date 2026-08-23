# Smart Resume Screener

Intelligently parse resumes, extract structured data, and match candidates to job descriptions using Google Gemini AI.

## Architecture

```
┌──────────────────────┐        ┌──────────────────────────────────────┐
│  Frontend (Vite)     │──────▶ │  Node.js + Express Backend           │
│  HTML / CSS / JS     │◀────── │  /upload  /candidates  /candidates/:id│
└──────────────────────┘        └────────────┬─────────────────────────┘
                                             │
                                 ┌───────────▼──────────────┐
                                 │  Google Gemini 3.6 Flash │
                                 │  - Structured extraction │
                                 │  - Semantic match scoring│
                                 └───────────┬──────────────┘
                                             │
                                 ┌───────────▼──────────┐
                                 │  SQLite (resumes.db) │
                                 │  better-sqlite3      │
                                 └──────────────────────┘
```

## LLM Prompts

### 1. Structured Data Extraction
```
You are a resume parser. Extract structured information from the resume below.
Return ONLY valid JSON with exactly these keys:
- skills: array of strings (technical and soft skills)
- experience: array of objects with keys: role, company, duration
- education: array of objects with keys: degree, institution

Resume:
{resume_text}
```

### 2. Semantic Match Scoring
```
You are an expert technical recruiter.

Compare the candidate's resume with the provided job description and evaluate
how well the candidate fits the role.

JOB DESCRIPTION:
{job_description}

CANDIDATE RESUME:
{resume_text}

Evaluate the candidate based on:
1. Required and relevant technical skills
2. Years and relevance of experience
3. Educational qualifications
4. Relevant projects and achievements
5. Match between the candidate's background and the job requirements
6. Missing or insufficiently demonstrated requirements

Return ONLY valid JSON with exactly these keys:
- match_score: integer from 1 to 10
- matched_skills: array of strings
- missing_skills: array of strings
- experience_match: one sentence on experience fit
- education_match: one sentence on education fit
- strengths: array of strings
- weaknesses: array of strings
- justification: 2-3 sentence overall summary
```

## Setup & Run

### Prerequisites
- Node.js 18+
- A Google Gemini API key — get one free at https://aistudio.google.com/app/apikey

### Backend Setup
```bash
cd backend
npm install

# Create backend .env file
echo "GEMINI_API_KEY=your_gemini_api_key_here" > .env

# Run Backend
npm run dev     # (or node index.js)
# Server starts at http://localhost:3000
```

### Frontend Setup
```bash
cd frontend
npm install

# Create frontend .env file
echo "VITE_BACKEND_API=https://smart-resume-screener-7jg0.onrender.com" > .env

# Run Development Server
npm run dev

# Build for Production
npm run build
```

## Environment Variables

| Variable | Scope | File | Description |
|----------|-------|------|-------------|
| `GEMINI_API_KEY` | Backend | `backend/.env` | Your Google Gemini API key |
| `VITE_BACKEND_API` | Frontend | `frontend/.env` | Deployed backend URL (e.g. `https://smart-resume-screener-7jg0.onrender.com`) |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/upload` | Upload resumes + job description, returns scored candidates |
| GET | `/candidates` | Fetch all stored candidates (supports `?sort=score\|name\|date`) |
| DELETE | `/candidates/:id` | Remove a single candidate |
| DELETE | `/candidates` | Clear all candidates |

## Database Schema

```sql
CREATE TABLE candidates (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  filename        TEXT,
  raw_text        TEXT,
  skills          TEXT,   -- JSON array
  experience      TEXT,   -- JSON array of {role, company, duration}
  education       TEXT,   -- JSON array of {degree, institution}
  match_score     REAL,
  justification   TEXT,
  matched_skills  TEXT,   -- JSON array
  missing_skills  TEXT,   -- JSON array
  job_description TEXT,
  uploaded_at     TEXT DEFAULT (datetime('now'))
);
```

## Features

- Upload multiple PDF, TXT, or DOCX resumes at once
- Drag & drop file upload with file preview
- Paste any job description
- Gemini AI (gemini-3.6-flash) extracts: skills, experience, education
- Gemini AI scores each candidate 1–10 with:
  - Written justification
  - Matched & missing skills
  - Strengths & weaknesses
  - Experience & education fit summary
- Animated SVG score ring per candidate
- Color-coded match labels (Strong ≥7 · Partial ≥4 · Weak <4)
- Stats summary: count of strong / partial / weak matches
- Search candidates by name or skill
- Sort by score, name, or upload date
- Persistent storage in SQLite
- Remove individual candidates or clear all

## Project Structure

```
SMARTRESUMESCREENER/
├── backend/
│   ├── index.js       # Express server, routes, file parsing
│   ├── llm.js         # Gemini AI integration (gemini-3.6-flash)
│   ├── db.js          # SQLite schema & migrations
│   ├── package.json
│   └── .env           # GEMINI_API_KEY (not committed)
├── frontend/
│   ├── index.html     # App shell (Vite module entry)
│   ├── app.js         # UI logic, fetch calls (reads VITE_BACKEND_API)
│   ├── style.css      # Styling
│   ├── package.json   # Frontend dependencies (Vite)
│   └── .env           # VITE_BACKEND_API (not committed)
├── .gitignore         # Excludes .env, node_modules, and .db files
└── README.md
```
