const express = require("express");
const cors = require("cors");
const path = require("path");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec";

// ✅ HEALTH CHECK (not using root path)
app.get("/health", (req, res) => {
  res.send(`✅ Proxy server is running on port ${PORT}`);
});

// 🧠 API ROUTE
app.post("/saveEntry", async (req, res) => {
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const text = await response.text();
    if (!response.ok) return res.status(500).json({ error: "Google Script request failed" });

    try {
      const data = JSON.parse(text);
      res.json(data);
    } catch {
      res.json({ message: text });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to save entry via proxy" });
  }
});

// ✅ React build folder serving
app.use(express.static(path.join(__dirname, "../build")));

// ✅ Catch-all for React routing
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../build/index.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
