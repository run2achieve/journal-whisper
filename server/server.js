const express = require("express");
const cors = require("cors");
const path = require("path");

// Use node-fetch in Node.js (v18+ compatible)
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(cors()); // Allow requests from any origin
app.use(express.json()); // Automatically parse JSON bodies

// Replace with your actual Google Apps Script URL
const GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyu5woIzLeOyYlRAlaLl7ntxUDwfVtcbUq716Ywm5sFldapAY-JbXZMSdO_2OHdvq3a/exec";

const PORT = process.env.PORT || 8090;

// Health check endpoint
app.get("/", (req, res) => {
  res.send(`✅ Proxy server is running on port ${PORT}`);
});

// Serve React static files
app.use(express.static(path.join(__dirname, "../build")));

// Save entry route
app.post("/saveEntry", async (req, res) => {
  console.log("📩 Received entry:", req.body); // Log incoming data

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const text = await response.text();
    console.log("📤 Google Script response (raw):", text);

    if (!response.ok) {
      console.error("❌ Google Script error status:", response.status);
      return res.status(500).json({ error: "Google Script request failed" });
    }

    try {
      const data = JSON.parse(text);
      res.json(data); // Parsed JSON response
    } catch (jsonError) {
      console.warn("⚠️ Response not JSON, returning raw text");
      res.json({ message: text }); // If not JSON, return as plain text
    }
  } catch (error) {
    console.error("🚨 Proxy error:", error);
    res.status(500).json({ error: "Failed to save entry via proxy" });
  }
});

// React Router support: serve index.html for all other GET requests
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../build/index.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 Proxy server running at http://localhost:${PORT}`);
});
