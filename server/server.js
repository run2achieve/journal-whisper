const express = require("express");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const FormData = require("form-data");
require("dotenv").config({ path: "./apikey.env" });

const app = express();
const PORT = process.env.PORT || 8090;

// Constants
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyu5woIzLeOyYlRAlaLl7ntxUDwfVtcbUq716Ywm5sFldapAY-JbXZMSdO_2OHdvq3a/exec";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error("❌ Missing OPENAI_API_KEY! Make sure apikey.env is set up correctly.");
  process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.json());

// Serve React static files from build
app.use(express.static(path.join(__dirname, "../build")));

// Health check route
app.get("/health", (req, res) => {
  res.send(`✅ Proxy server is running on port ${PORT}`);
});

// Multer config for audio upload
const upload = multer({ storage: multer.memoryStorage() });

// Whisper transcription endpoint
app.post("/transcribeAudio", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file uploaded" });
    }

    const formData = new FormData();
    formData.append("file", req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });
    formData.append("model", "whisper-1");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error: ${response.statusText} — ${errText}`);
    }

    const data = await response.json();
    res.json({ transcription: data.text });
  } catch (error) {
    console.error("Error in /transcribeAudio:", error);
    res.status(500).json({ error: error.message });
  }
});

// Save journal entry to Google Sheets
app.post("/saveEntry", async (req, res) => {
  try {
    const { timestamp, entry, user } = req.body;

    if (!timestamp || !entry || !user) {
      return res.status(400).json({ error: "Missing timestamp, entry, or user in request body." });
    }

    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timestamp, entry, user }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google Sheets API error:", errorText);
      return res.status(500).json({ error: "Failed to save entry to Google Sheets." });
    }

    const result = await response.text();

    try {
      res.json(JSON.parse(result));
    } catch {
      res.json({ message: result });
    }
  } catch (error) {
    console.error("Error in /saveEntry:", error);
    res.status(500).json({ error: error.message });
  }
});

// Catch-all route for React Router support (must be last!)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../build/index.html"));
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Unified server running at http://localhost:${PORT}`);
});
