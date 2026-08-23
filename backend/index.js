const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
require("dotenv").config({ path: path.join(__dirname, "../frontend/.env") });
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const db = require("./db");
const { extractStructuredData, computeMatchScore } = require("./llm");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

// Dynamic env config endpoint for frontend
app.get("/config.js", (req, res) => {
  res.type("application/javascript");
  const apiUrl = process.env.backend_API || process.env.BACKEND_API || "";
  res.send(`window.ENV = ${JSON.stringify({ API_URL: apiUrl })};`);
});

app.use(express.static(path.join(__dirname, "../frontend")));


async function extractText(file) {
  if (file.originalname.toLowerCase().endsWith(".pdf")) {
    try {
      const parsed = await pdfParse(file.buffer);
      return parsed.text;
    } catch (err) {
      throw new Error(`Could not parse PDF "${file.originalname}": ${err.message}`);
    }
  }
  if (file.originalname.toLowerCase().endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return result.value;
  }
  return file.buffer.toString("utf-8");
}

// POST /upload
app.post("/upload", upload.array("files"), async (req, res) => {
  try {
    const { job_description } = req.body;

    if (!req.files?.length) {
      return res.status(400).json({ error: "At least one resume file is required" });
    }
    if (!job_description?.trim()) {
      return res.status(400).json({ error: "Job description is required" });
    }

    const results = [];

    for (const file of req.files) {
      const text = await extractText(file);

      if (!text.trim()) {
        results.push({ filename: file.originalname, error: "Could not extract text from file" });
        continue;
      }

      const [structured, match] = await Promise.all([
        extractStructuredData(text),
        computeMatchScore(text, job_description),
      ]);

      const score = Number(match.match_score) || 0;

      const info = db.prepare(`
        INSERT INTO candidates 
          (filename, raw_text, skills, experience, education, match_score, justification,
           job_description, matched_skills, missing_skills, strengths, weaknesses, experience_match, education_match)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        file.originalname,
        text,
        JSON.stringify(structured.skills || []),
        JSON.stringify(structured.experience || []),
        JSON.stringify(structured.education || []),
        score,
        match.justification,
        job_description,
        JSON.stringify(match.matched_skills || []),
        JSON.stringify(match.missing_skills || []),
        JSON.stringify(match.strengths || []),
        JSON.stringify(match.weaknesses || []),
        match.experience_match || "",
        match.education_match || ""
      );

      results.push({
        id: info.lastInsertRowid,
        filename: file.originalname,
        skills: structured.skills || [],
        experience: structured.experience || [],
        education: structured.education || [],
        match_score: score,
        justification: match.justification,
        matched_skills: match.matched_skills || [],
        missing_skills: match.missing_skills || [],
        strengths: match.strengths || [],
        weaknesses: match.weaknesses || [],
        experience_match: match.experience_match || "",
        education_match: match.education_match || "",
        job_description,
        uploaded_at: new Date().toISOString(),
      });
    }

    results.sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
    res.json({ candidates: results });
  } catch (err) {
    console.error("Upload error:", err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// GET /candidates
app.get("/candidates", (req, res) => {
  try {
    const { search, sort } = req.query;

    const allowedSorts = {
      name: "filename",
      date: "uploaded_at DESC",
      score: "match_score DESC",
    };
    const orderBy = allowedSorts[sort] || "match_score DESC";

    let rows = db.prepare(`SELECT * FROM candidates ORDER BY ${orderBy}`).all();

    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.filename.toLowerCase().includes(q) ||
        (r.skills || "").toLowerCase().includes(q)
      );
    }

    res.json({
      candidates: rows.map(r => ({
        id: r.id,
        filename: r.filename,
        skills: JSON.parse(r.skills || "[]"),
        experience: JSON.parse(r.experience || "[]"),
        education: JSON.parse(r.education || "[]"),
        match_score: r.match_score,
        justification: r.justification,
        matched_skills: JSON.parse(r.matched_skills || "[]"),
        missing_skills: JSON.parse(r.missing_skills || "[]"),
        strengths: JSON.parse(r.strengths || "[]"),
        weaknesses: JSON.parse(r.weaknesses || "[]"),
        experience_match: r.experience_match || "",
        education_match: r.education_match || "",
        job_description: r.job_description,
        uploaded_at: r.uploaded_at,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /candidates/:id
app.delete("/candidates/:id", (req, res) => {
  const result = db.prepare("DELETE FROM candidates WHERE id = ?").run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: "Candidate not found" });
  }
  res.json({ message: "Deleted" });
});

// DELETE /candidates (clear all)
app.delete("/candidates", (req, res) => {
  db.prepare("DELETE FROM candidates").run();
  res.json({ message: "All candidates cleared" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Global error:", err.message);
  res.status(500).json({ error: err.message });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});