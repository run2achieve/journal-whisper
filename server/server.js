const express = require("express");
const cors = require("cors");
const path = require("path");

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(cors());
app.use(express.json());

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/your-script-url/exec";

const PORT = process.env.PORT || 10000;

// Health check
app.get("/", (req, res) => {
  res.send(`✅ Proxy server is running on port ${PORT}`);
});

// Serve React static files from the build folder
app.use(express.static(path.join(__dirname, "../build")));

// Proxy endpoint for saving entry
app.post("/saveEntry", async (req, res) => {
  // your existing saveEntry code...
});

// This *must* come after all other routes — serve React's index.html for any unmatched routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../build/index.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 Proxy server running at http://localhost:${PORT}`);
});
