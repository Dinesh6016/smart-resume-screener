const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config({ override: true });

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("❌ GEMINI_API_KEY is missing or empty in .env");
} else {
  console.log("✅ GEMINI_API_KEY loaded:", apiKey.slice(0, 12) + "...");
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({
  model: "gemini-3.6-flash",
  generationConfig: { responseMimeType: "application/json" },
});


async function callGemini(prompt, label = "LLM") {
  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(text);
  } catch (err) {
    console.error(`\n❌ ${label} failed:`, err.message);
    throw err;
  }
}

async function extractStructuredData(resumeText) {
  const prompt = `You are a resume parser. Extract structured information from the resume below.
Return ONLY valid JSON with exactly these keys:
- skills: array of strings (technical and soft skills)
- experience: array of objects with keys: role, company, duration
- education: array of objects with keys: degree, institution

Resume:
${resumeText.slice(0, 3000)}`;

  return callGemini(prompt, "extractStructuredData");
}

async function computeMatchScore(resumeText, jobDescription) {
  const prompt = `You are an expert technical recruiter.

Compare the candidate's resume with the provided job description and evaluate how well the candidate fits the role.

JOB DESCRIPTION:
${jobDescription.slice(0, 2000)}

CANDIDATE RESUME:
${resumeText.slice(0, 3000)}

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
- justification: 2-3 sentence overall summary`;

  return callGemini(prompt, "computeMatchScore");
}

module.exports = { extractStructuredData, computeMatchScore };
