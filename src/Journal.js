import React, { useState, useEffect, useRef } from "react";
import logo from "./assets/logo.png"; // Adjust path as needed

const PROXY_API_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:8090/saveEntry"
    : "https://journal-whisper.onrender.com/saveEntry";

export default function Journal({ user, onLogout }) {
  const [entry, setEntry] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [currentTimestamp, setCurrentTimestamp] = useState("");
  const [countdown, setCountdown] = useState(180); // 3 minutes countdown seconds

  const recognitionRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  const generateTimestamp = () => {
    const now = new Date();
    return `🕒 ${now.toLocaleString()}`;
  };

  useEffect(() => {
    setCurrentTimestamp(generateTimestamp());
  }, []);

  const saveToGoogleSheet = async (timestamp, text, username) => {
    try {
      const response = await fetch(PROXY_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timestamp, entry: text, user: username }),
      });
      if (!response.ok)
        throw new Error("Failed to save entry to Google Sheets");
      return await response.json();
    } catch (error) {
      setSaveMessage("Error saving to Google Sheets: " + error.message);
      return null;
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null; // disable auto restart before stopping
      recognitionRef.current.stop();
    }
    clearInterval(countdownIntervalRef.current);
    setCountdown(180);
    setIsRecording(false);
    setShowToast(false);
    setSaveMessage("Recording stopped");
  };

  const startRecognition = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSaveMessage("Voice recognition not supported in this browser.");
      setShowToast(true);
      return;
    }

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.continuous = true; // Keep listening until stopped
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsRecording(true);
        setShowToast(true);
        setSaveMessage("I am listening, please go ahead");
      };

      recognition.onresult = (event) => {
        const transcript = event.results[event.resultIndex][0].transcript;
        setEntry((prev) => (prev ? prev + "\n" : "") + transcript);
        setSaveMessage("I am listening, please go ahead");
      };

      recognition.onerror = (event) => {
        setSaveMessage("Recognition error: " + event.error);
        setShowToast(true);
      };

      recognition.onend = () => {
        // Restart recognition only if still recording and countdown not finished
        if (isRecording && countdown > 0) {
          setSaveMessage("waiting");
          try {
            recognition.start();
          } catch {
            // If restart throws due to state, ignore
          }
        }
      };

      recognitionRef.current = recognition;
    }

    recognitionRef.current.start();

    // Start countdown timer for 180 seconds
    setCountdown(180);
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          stopRecording();
          setSaveMessage("Recording finished");
          setShowToast(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleRedButtonClick = () => {
    if (!isRecording) {
      startRecognition();
    } else {
      stopRecording();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!entry.trim()) {
      setSaveMessage("Please enter something before saving.");
      setShowToast(true);
      return;
    }
    const result = await saveToGoogleSheet(currentTimestamp, entry, user);
    if (result) {
      setSaveMessage("Journal entry saved successfully!");
      setShowToast(true);
      setEntry("");
      setCurrentTimestamp(generateTimestamp());
    } else {
      setSaveMessage("Failed to save entry. Please try again.");
      setShowToast(true);
    }
  };

  const handleRefreshTime = () => {
    setCurrentTimestamp(generateTimestamp());
    setSaveMessage("");
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      clearInterval(countdownIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (saveMessage) {
      const timer = setTimeout(() => setSaveMessage(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [saveMessage]);

  // Simple fancy countdown progress bar
  const countdownPercent = ((180 - countdown) / 180) * 100;

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#FFF8E7",
        padding: "2rem",
        fontFamily: "sans-serif",
        maxWidth: 700,
        margin: "auto",
        color: "#222",
      }}
    >
      {/* Countdown Bar */}
      {isRecording && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "16px", // wider bar
            backgroundColor: "#d0f0d0",
            zIndex: 9999,
            boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
          }}
          aria-label="Recording countdown timer"
        >
          <div
            style={{
              width: `${countdownPercent}%`,
              height: "100%",
              background: "linear-gradient(90deg, #2ecc71, #27ae60)",
              transition: "width 1s linear",
            }}
          />
        </div>
      )}

      {/* Removed numeric countdown text */}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <img
          src={logo}
          alt="My Logo"
          style={{ maxWidth: "150px", height: "auto" }}
        />
        <div>
          <strong>User:</strong> {user}
          <button
            onClick={onLogout}
            style={{
              marginLeft: "1rem",
              padding: "0.3rem 0.75rem",
              fontSize: "1rem",
              cursor: "pointer",
              borderRadius: "6px",
              border: "1px solid #888",
              backgroundColor: "#f0f0f0",
              color: "#333",
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {showToast && (
        <div
          style={{
            position: "fixed",
            top: "40px",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#333",
            color: "white",
            padding: "10px 20px",
            borderRadius: "20px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.7)",
            zIndex: 9999,
            fontSize: "1rem",
            opacity: 0.9,
            userSelect: "none",
          }}
          aria-live="polite"
        >
          {saveMessage || "waiting"}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: "flex", gap: "1.5rem" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              flexShrink: 0,
              marginTop: "4rem",
            }}
          >
            <button
              type="button"
              onClick={handleRedButtonClick}
              style={{
                backgroundColor: "#e74c3c", // red color
                color: "white",
                fontSize: "1.5rem",
                width: "80px",
                height: "80px",
                border: "none",
                borderRadius: "50%",
                cursor: "pointer",
                boxShadow: "0 0 15px 5px rgba(231, 76, 60, 0.7)", // red glow
              }}
              title={isRecording ? "Stop recording" : "Start recording"}
            >
              {isRecording ? "Stop" : "Record"}
            </button>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "0.5rem",
              }}
            >
              <input
                type="text"
                readOnly
                value={currentTimestamp}
                style={{
                  flexGrow: 1,
                  fontWeight: "bold",
                  fontSize: "1.2rem",
                  borderRadius: "6px",
                  border: "1px solid #ccc",
                  padding: "0.3rem 0.6rem",
                  backgroundColor: "#f9f9f9",
                  color: "#333",
                }}
              />
              <button
                type="button"
                onClick={handleRefreshTime}
                style={{
                  padding: "0.3rem 0.75rem",
                  fontSize: "1rem",
                  cursor: "pointer",
                  borderRadius: "6px",
                  border: "1px solid #888",
                  backgroundColor: "#f0f0f0",
                  color: "#333",
                  fontWeight: "bold",
                }}
              >
                Refresh Time
              </button>
            </div>

            <textarea
              rows={12}
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              placeholder="Type or dictate your journal entry..."
              style={{
                width: "100%",
                padding: "0.5rem",
                fontSize: "1rem",
                borderRadius: "6px",
                border: "1px solid #ccc",
                backgroundColor: "#fff",
                color: "#222",
                whiteSpace: "pre-wrap",
              }}
            />
          </div>
        </div>

        <button
          type="submit"
          style={{
            marginTop: "1.5rem",
            display: "block",
            marginLeft: "auto",
            marginRight: "auto",
            padding: "0.75rem 2rem",
            fontSize: "1rem",
            borderRadius: "6px",
            border: "none",
            cursor: "pointer",
            backgroundColor: "#4CAF50",
            color: "white",
            boxShadow: "0 3px 6px rgba(0,0,0,0.2)",
          }}
        >
          Save Entry
        </button>
      </form>
    </div>
  );
}
