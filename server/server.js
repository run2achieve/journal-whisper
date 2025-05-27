const express = require("express");
const cors = require("cors");
const path = require("path");

// Use node-fetch in Node.js (v18+ compatible)
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(cors()); // Allow requests from any origin
app.use(express.json()); // Automatically parse JSON bodies

const GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyu5woIzLeOyYlRAlaLl7ntxUDwfVtcbUq716Ywm5sFldapAY-JbXZMSdO_2OHdvq3a/exec";

const PORT = process.env.PORT || 8090;

// Health check endpoint
app.get("/", (req, res) => {
  res.send(`✅ Proxy server is running on port ${PORT}`);
});

// Serve React static files from the build folder
app.use(express.static(path.join(__dirname, "../build")));

// Save entry route
app.post("/saveEntry", async (req, res) => {
  console.log("📩 Received entry:", req.body);

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
      res.json(data);
    } catch {
      res.json({ message: text });
    }
  } catch (error) {
    console.error("🚨 Proxy error:", error);
    res.status(500).json({ error: "Failed to save entry via proxy" });
  }
});

// For any other GET request, serve React's index.html (for client-side routing)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../build/index.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 Proxy server running at http://localhost:${PORT}`);
});
