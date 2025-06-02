const express = require("express");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const FormData = require("form-data");

// Load environment variables only in development
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const app = express();
const PORT = process.env.PORT || 8090;

// Constants
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyu5woIzLeOyYlRAlaLl7ntxUDwfVtcbUq716Ywm5sFldapAY-JbXZMSdO_2OHdvq3a/exec";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Validate required environment variables
if (!OPENAI_API_KEY) {
  console.error("❌ Missing OPENAI_API_KEY! Please set it in your environment variables.");
  process.exit(1);
}

// Configure CORS options
const corsOptions = {
  origin:
    process.env.NODE_ENV === "production"
      ? "https://journal-whisper.onrender.com" // <-- Update to your deployed frontend domain (no trailing slash)
      : "http://localhost:3000",               // React dev server default port
  optionsSuccessStatus: 200,  // For legacy browser support
};

app.use(cors(corsOptions));
app.use(express.json());

// Serve React build files
app.use(express.static(path.join(__dirname, "../build")));

// Health check endpoint
app.get("/health", (req, res) => {
  res.send(`✅ Proxy server running on port ${PORT}`);
});

// Multer setup for handling file uploads (in-memory)
const upload = multer({ storage: multer.memoryStorage() });

// Whisper API endpoint to transcribe audio
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

// Endpoint to save journal entry to Google Sheets
app.post("/saveEntry", async (req, res) => {
  try {
    const { date, time, entry, user } = req.body;

    if (!date || !time || !entry || !user) {
      return res.status(400).json({ error: "Missing date, time, entry, or user in request body." });
    }

    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, time, entry, user }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google Sheets API error:", errorText);
      return res.status(500).json({ error: "Failed to save entry to Google Sheets." });
    }

    const resultText = await response.text();

    try {
      const resultJson = JSON.parse(resultText);
      res.json(resultJson);
    } catch {
      res.json({ message: resultText });
    }
  } catch (error) {
    console.error("Error in /saveEntry:", error);
    res.status(500).json({ error: error.message });
  }
});

// Catch-all handler to serve React app for all other routes (supports React Router)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../build/index.html"));
});

// Start server and listen on specified port
app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT} (env: ${process.env.NODE_ENV})`);
}).on("error", (err) => {
  console.error("Failed to start server:", err);
});
