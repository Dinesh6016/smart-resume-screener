const Database = require("better-sqlite3");
const db = new Database("resumes.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS candidates (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    filename         TEXT,
    raw_text         TEXT,
    skills           TEXT,
    experience       TEXT,
    education        TEXT,
    match_score      REAL,
    justification    TEXT,
    job_description  TEXT,
    matched_skills   TEXT,
    missing_skills   TEXT,
    strengths        TEXT,
    weaknesses       TEXT,
    experience_match TEXT,
    education_match  TEXT,
    uploaded_at      TEXT DEFAULT (datetime('now'))
  )
`);

// Migrate older databases
const cols = db.prepare("PRAGMA table_info(candidates)").all().map(c => c.name);

if (!cols.includes("job_description"))  db.exec("ALTER TABLE candidates ADD COLUMN job_description TEXT");
if (!cols.includes("uploaded_at"))      db.exec("ALTER TABLE candidates ADD COLUMN uploaded_at TEXT DEFAULT (datetime('now'))");
if (!cols.includes("matched_skills"))   db.exec("ALTER TABLE candidates ADD COLUMN matched_skills TEXT");
if (!cols.includes("missing_skills"))   db.exec("ALTER TABLE candidates ADD COLUMN missing_skills TEXT");
if (!cols.includes("strengths"))        db.exec("ALTER TABLE candidates ADD COLUMN strengths TEXT");
if (!cols.includes("weaknesses"))       db.exec("ALTER TABLE candidates ADD COLUMN weaknesses TEXT");
if (!cols.includes("experience_match")) db.exec("ALTER TABLE candidates ADD COLUMN experience_match TEXT");
if (!cols.includes("education_match"))  db.exec("ALTER TABLE candidates ADD COLUMN education_match TEXT");

// Useful indexes
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_match_score ON candidates(match_score DESC);
  CREATE INDEX IF NOT EXISTS idx_uploaded_at ON candidates(uploaded_at DESC);
`);

module.exports = db;