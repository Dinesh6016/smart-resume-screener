const API = "http://localhost:3000";

let candidates = [];
let expandedIds = new Set();

// ── Helpers ──────────────────────────────────────────────────

function scoreClass(s) {
  return s >= 7 ? "score-high" : s >= 4 ? "score-mid" : "score-low";
}

function scoreLabel(s) {
  return s >= 7 ? "Strong Match" : s >= 4 ? "Partial Match" : "Weak Match";
}

function formatDate(dt) {
  if (!dt) return "";
  return new Date(dt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function tagsHtml(items, cls = "") {
  return (items || []).map(s => `<span class="tag${cls ? " " + cls : ""}">${s}</span>`).join("");
}

function listHtml(items) {
  if (!items?.length) return "<li>—</li>";
  return items.map(item => {
    if (typeof item === "object") {
      if (item.role) return `<li>${[item.role, item.company, item.duration].filter(Boolean).join(" · ")}</li>`;
      if (item.degree) return `<li>${item.degree}${item.institution ? " — " + item.institution : ""}</li>`;
    }
    return `<li>${item}</li>`;
  }).join("");
}

function scoreRingHtml(score) {
  const cls = scoreClass(score);
  const pct = Math.round(Math.max(0, Math.min(10, score ?? 0)) * 10);
  return `
    <div class="score-ring ${cls}">
      <div class="score-num">${score ?? "—"}</div>
      <div class="score-out">/10</div>
      <div class="score-bar"><div class="score-bar-fill" style="width:${pct}%"></div></div>
    </div>`;
}

// ── Render Card ───────────────────────────────────────────────

function renderCard(c) {
  const isExpanded = expandedIds.has(c.id);
  const skills     = (c.skills  || []).slice(0, 12);
  const matched    = c.matched_skills  || [];
  const missing    = c.missing_skills  || [];
  const strengths  = c.strengths       || [];
  const weaknesses = c.weaknesses      || [];
  const exp        = c.experience      || [];
  const edu        = c.education       || [];
  const expMatch   = c.experience_match || "";
  const eduMatch   = c.education_match  || "";
  const cls        = scoreClass(c.match_score);
  const shortlisted = c.match_score >= 7;

  return `
    <div class="candidate-card ${cls}" data-id="${c.id}">
      <div class="card-body">

        <!-- Header: score ring + name + badges -->
        <div class="candidate-header">
          ${scoreRingHtml(c.match_score)}
          <div class="candidate-info">
            <div class="candidate-name-row">
              <span class="candidate-name">${c.filename}</span>
              ${shortlisted ? `<span class="shortlisted-badge">⭐ Shortlisted</span>` : ""}
            </div>
            <div class="candidate-date">${formatDate(c.uploaded_at)}</div>
          </div>
          <span class="score-label ${cls}">${scoreLabel(c.match_score)}</span>
        </div>

        <!-- Requirement 3 & 4: LLM score justification — always visible -->
        ${c.justification ? `
          <div class="justification-block">
            <span class="justification-label">🤖 AI Justification</span>
            <p class="justification">${c.justification}</p>
          </div>` : ""}

        <!-- Requirement 2: Extracted structured data — always visible -->
        <div class="extracted-block">
          <div class="extracted-title">📊 Extracted Data</div>
          <div class="extracted-grid">
            <div class="extracted-col">
              <div class="extracted-col-label">Skills</div>
              ${skills.length
                ? `<div class="tags">${tagsHtml(skills)}</div>`
                : `<span class="none-text">—</span>`}
            </div>
            <div class="extracted-col">
              <div class="extracted-col-label">Experience</div>
              <ul class="detail-list">${listHtml(exp)}</ul>
            </div>
            <div class="extracted-col">
              <div class="extracted-col-label">Education</div>
              <ul class="detail-list">${listHtml(edu)}</ul>
            </div>
          </div>
        </div>

        <button class="toggle-btn" onclick="toggleDetails(${c.id})">
          ${isExpanded ? "▲ Hide Match Analysis" : "▼ Show Match Analysis"}
        </button>
      </div>

      <!-- Expandable: full match analysis -->
      ${isExpanded ? `
        <div class="details">
          ${(matched.length || missing.length) ? `
            <div class="detail-row">
              ${matched.length ? `<div class="detail-section"><label>✅ Matched Skills</label><div class="tags">${tagsHtml(matched, "matched")}</div></div>` : ""}
              ${missing.length ? `<div class="detail-section"><label>❌ Missing Skills</label><div class="tags">${tagsHtml(missing, "missing")}</div></div>` : ""}
            </div>` : ""}
          ${(strengths.length || weaknesses.length) ? `
            <div class="detail-row">
              ${strengths.length  ? `<div class="detail-section"><label>💪 Strengths</label><ul class="detail-list">${strengths.map(s=>`<li>${s}</li>`).join("")}</ul></div>` : ""}
              ${weaknesses.length ? `<div class="detail-section"><label>⚠️ Weaknesses</label><ul class="detail-list">${weaknesses.map(s=>`<li>${s}</li>`).join("")}</ul></div>` : ""}
            </div>` : ""}
          ${(expMatch || eduMatch) ? `
            <div class="detail-row">
              ${expMatch ? `<div class="detail-section"><label>💼 Experience Fit</label><p class="fit-note">${expMatch}</p></div>` : ""}
              ${eduMatch ? `<div class="detail-section"><label>🎓 Education Fit</label><p class="fit-note">${eduMatch}</p></div>` : ""}
            </div>` : ""}
        </div>` : ""}

      <div class="card-footer">
        <button class="delete-btn" onclick="deleteCandidate(${c.id})">🗑 Remove</button>
      </div>
    </div>`;
}

// ── Stats Row ─────────────────────────────────────────────────

function renderStats() {
  const high = candidates.filter(c => c.match_score >= 7).length;
  const mid  = candidates.filter(c => c.match_score >= 4 && c.match_score < 7).length;
  const low  = candidates.filter(c => c.match_score < 4).length;
  const row  = document.getElementById("statsRow");
  row.innerHTML = `
    ${high ? `<span class="stat-chip stat-high">🟢 ${high} Strong</span>` : ""}
    ${mid  ? `<span class="stat-chip stat-mid">🟡 ${mid} Partial</span>` : ""}
    ${low  ? `<span class="stat-chip stat-low">🔴 ${low} Weak</span>`   : ""}`;
}

// ── Render All ────────────────────────────────────────────────

function getFiltered() {
  const q = document.getElementById("searchInput").value.toLowerCase();
  if (!q) return candidates;
  return candidates.filter(c =>
    c.filename.toLowerCase().includes(q) ||
    (c.skills || []).some(s => s.toLowerCase().includes(q))
  );
}

function renderAll() {
  const section = document.getElementById("resultsSection");
  const list    = document.getElementById("candidateList");
  const title   = document.getElementById("resultsTitle");
  const empty   = document.getElementById("emptyState");

  if (!candidates.length) { section.classList.add("hidden"); return; }

  section.classList.remove("hidden");
  title.textContent = `Candidates (${candidates.length})`;
  renderStats();

  const filtered = getFiltered();
  empty.classList.toggle("hidden", filtered.length > 0);
  list.innerHTML = filtered.map(renderCard).join("");
}

// ── Toggle / Delete ───────────────────────────────────────────

function toggleDetails(id) {
  expandedIds.has(id) ? expandedIds.delete(id) : expandedIds.add(id);
  renderAll();
}

async function deleteCandidate(id) {
  await fetch(`${API}/candidates/${id}`, { method: "DELETE" }).catch(() => {});
  candidates = candidates.filter(c => c.id !== id);
  expandedIds.delete(id);
  renderAll();
}

// ── Drag & Drop ───────────────────────────────────────────────

const dropZone  = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");

dropZone.addEventListener("dragover",  e => { e.preventDefault(); dropZone.classList.add("drag-over"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
dropZone.addEventListener("drop", e => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  fileInput.files = e.dataTransfer.files;
  showFileList(e.dataTransfer.files);
});

fileInput.addEventListener("change", () => showFileList(fileInput.files));

function showFileList(files) {
  const el = document.getElementById("fileList");
  if (!files?.length) { el.classList.add("hidden"); return; }
  el.innerHTML = Array.from(files).map(f => `<div class="file-item">${f.name}</div>`).join("");
  el.classList.remove("hidden");
}

// ── Controls ──────────────────────────────────────────────────

document.getElementById("clearAllBtn").addEventListener("click", async () => {
  if (!confirm("Remove all candidates?")) return;
  await fetch(`${API}/candidates`, { method: "DELETE" }).catch(() => {});
  candidates = [];
  expandedIds.clear();
  renderAll();
});

document.getElementById("searchInput").addEventListener("input", renderAll);

document.getElementById("sortSelect").addEventListener("change", async e => {
  const res  = await fetch(`${API}/candidates?sort=${e.target.value}`).catch(() => null);
  if (!res) return;
  const data = await res.json().catch(() => ({}));
  candidates = data.candidates || [];
  renderAll();
});

// ── Upload Form ───────────────────────────────────────────────

document.getElementById("uploadForm").addEventListener("submit", async e => {
  e.preventDefault();

  const jobDesc   = document.getElementById("jobDesc").value.trim();
  const files     = document.getElementById("fileInput").files;
  const errorMsg  = document.getElementById("errorMsg");
  const submitBtn = document.getElementById("submitBtn");
  const btnText   = document.getElementById("btnText");
  const loading   = document.getElementById("loadingMsg");

  errorMsg.classList.add("hidden");
  submitBtn.disabled = true;
  btnText.textContent = "Processing...";
  loading.classList.remove("hidden");

  const form = new FormData();
  Array.from(files).forEach(f => form.append("files", f));
  form.append("job_description", jobDesc);

  try {
    const res  = await fetch(`${API}/upload`, { method: "POST", body: form });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); }
    catch {
      throw new Error(res.ok ? "Server returned an invalid response" : `Server error (${res.status})`);
    }
    if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);

    const ids = new Set(data.candidates.map(c => c.id));
    candidates = [...data.candidates, ...candidates.filter(c => !ids.has(c.id))];
    candidates.sort((a, b) => (b.match_score || 0) - (a.match_score || 0));

    renderAll();
    e.target.reset();
    document.getElementById("fileList").classList.add("hidden");
  } catch (err) {
    errorMsg.textContent = err.message;
    errorMsg.classList.remove("hidden");
  } finally {
    submitBtn.disabled = false;
    btnText.textContent = "Screen Resumes";
    loading.classList.add("hidden");
  }
});

// ── Init ──────────────────────────────────────────────────────

fetch(`${API}/candidates`)
  .then(r => r.json())
  .then(data => { candidates = data.candidates || []; renderAll(); })
  .catch(() => {});
