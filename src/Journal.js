import React, { useState, useEffect, useRef } from "react";
import logo from "./assets/logo.png"; // Adjust path as needed

const PROXY_API_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:8090/transcribeAudio"
    : "https://journal-whisper.onrender.com/transcribeAudio";

export default function Journal({ user, onLogout }) {
  const [entry, setEntry] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [{ date, time, display }, setDateTime] = useState({
    date: "",
    time: "",
    display: "",
  });
  const [countdown, setCountdown] = useState(0);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const countdownIntervalRef = useRef(null);

  // Generate separate date, time, and display timestamp
  const generateDateTime = () => {
    const now = new Date();
    const date = now.toISOString().split("T")[0]; // e.g. "2025-05-16"
    const time = now.toTimeString().split(" ")[0]; // e.g. "21:06:20"
    const display = `🕒 ${now.toLocaleString()}`; // for user display
    return { date, time, display };
  };

  useEffect(() => {
    setDateTime(generateDateTime());
  }, []);

  const startRecording = async (durationSeconds) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setSaveMessage("Audio recording not supported in this browser.");
      setShowToast(true);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      setRecordingDuration(durationSeconds);
      setDateTime(generateDateTime());
      setCountdown(durationSeconds);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstart = () => {
        setIsRecording(true);
        setShowToast(true);
        setSaveMessage("Recording in progress...");
        countdownIntervalRef.current = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              stopRecording();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      };

      mediaRecorder.onstop = async () => {
        clearInterval(countdownIntervalRef.current);
        setCountdown(0);
        setIsRecording(false);
        setRecordingDuration(0);
        setSaveMessage("");

        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        try {
          const formData = new FormData();
          formData.append("file", audioBlob, "recording.webm");
          formData.append("user", user);

          const response = await fetch(PROXY_API_URL, {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`Transcription failed: ${response.statusText}`);
          }

          const data = await response.json();

          if (data.transcription) {
            setEntry(data.transcription);
            setSaveMessage(
              "Transcription received. Please review and save manually."
            );
            setShowToast(true);
          } else {
            setSaveMessage("No transcription received.");
            setShowToast(true);
          }
        } catch (error) {
          setSaveMessage("Error during transcription: " + error.message);
          setShowToast(true);
        }
      };

      mediaRecorder.start();
    } catch (err) {
      setSaveMessage("Could not start recording: " + err.message);
      setShowToast(true);
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    clearInterval(countdownIntervalRef.current);
    setIsRecording(false);
  };

  // Save to Google Sheet now accepts separate date and time fields
  const saveToGoogleSheet = async (date, time, text, username) => {
    const SAVE_API_URL =
      window.location.hostname === "localhost"
        ? "http://localhost:8090/saveEntry"
        : "https://journal-whisper.onrender.com/saveEntry";

    try {
      const response = await fetch(SAVE_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, time, entry: text, user: username }),
      });
      if (!response.ok)
        throw new Error("Failed to save entry to Google Sheets");
      return await response.json();
    } catch (error) {
      setSaveMessage("Error saving to Google Sheets: " + error.message);
      setShowToast(true);
      return null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!entry.trim()) {
      setSaveMessage("Please enter something before saving.");
      setShowToast(true);
      return;
    }
    const result = await saveToGoogleSheet(date, time, entry, user);
    if (result) {
      setSaveMessage("Journal entry saved successfully!");
      setShowToast(true);
      setEntry("");
      setDateTime(generateDateTime());
    } else {
      setSaveMessage("Failed to save entry. Please try again.");
      setShowToast(true);
    }
  };

  const handleRefreshTime = () => {
    setDateTime(generateDateTime());
    setSaveMessage("");
  };

  useEffect(() => {
    return () => {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
      clearInterval(countdownIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (saveMessage) {
      const timer = setTimeout(() => setSaveMessage(""), 6000);
      return () => clearTimeout(timer);
    }
  }, [saveMessage]);

  const getButtonProgress = () => {
    if (recordingDuration === 0) return "0%";
    const percent = ((recordingDuration - countdown) / recordingDuration) * 100;
    return `${percent}%`;
  };

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
      <style>
        {`
          @keyframes pulse {
            0% {
              box-shadow: 0 0 0 0 rgba(255, 59, 48, 0.7);
            }
            70% {
              box-shadow: 0 0 0 10px rgba(255, 59, 48, 0);
            }
            100% {
              box-shadow: 0 0 0 0 rgba(255, 59, 48, 0);
            }
          }
          .pulse {
            animation: pulse 1.5s infinite;
          }
        `}
      </style>

      {showToast && saveMessage && (
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
          {saveMessage}
        </div>
      )}

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
              border: "1px solid #ccc",
              backgroundColor: "#f2f2f2",
              color: "#333",
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Recording buttons */}
      <div
        style={{
          display: "flex",
          gap: "1.5rem",
          marginBottom: "2rem",
          justifyContent: "center",
        }}
      >
        {[
          { label: "30s", duration: 30 },
          { label: "60s", duration: 60 },
          { label: "180s", duration: 180 },
        ].map(({ label, duration }) => {
          const isActive = isRecording && recordingDuration === duration;
          return (
            <button
              key={label}
              className={isActive ? "pulse" : ""}
              onClick={() => {
                if (isActive) {
                  stopRecording();
                } else if (!isRecording) {
                  startRecording(duration);
                }
              }}
              disabled={isRecording && !isActive}
              style={{
                position: "relative",
                height: "70px",
                width: "70px",
                borderRadius: isActive ? "10%" : "50%",
                border: "4px solid #444",
                backgroundColor: isActive ? "#FF3B30" : "#FFD700",
                color: "#000",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: isRecording && !isActive ? "not-allowed" : "pointer",
                boxShadow: isActive
                  ? "0 0 12px #FF3B30"
                  : "0 2px 6px rgba(0,0,0,0.2)",
                transition: "all 0.3s ease",
              }}
              title={`Record for ${label}`}
            >
              <span
                style={{
                  position: "absolute",
                  bottom: "-1.5rem",
                  fontSize: "0.9rem",
                  fontWeight: "bold",
                  color: "#333",
                }}
              >
                {label}
              </span>
              {isActive && (
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    height: "6px",
                    background: "#27ae60",
                    width: getButtonProgress(),
                    transition: "width 1s linear",
                    borderBottomLeftRadius: "8px",
                    borderBottomRightRadius: "8px",
                  }}
                />
              )}
              <div
                style={{
                  width: isActive ? "20px" : "14px",
                  height: isActive ? "20px" : "14px",
                  backgroundColor: "#fff",
                  borderRadius: isActive ? "4px" : "50%",
                  transition: "all 0.2s ease-in-out",
                }}
              />
            </button>
          );
        })}
      </div>

      {/* Current timestamp display */}
      <div
        style={{
          textAlign: "center",
          marginBottom: "1rem",
          fontSize: "1.1rem",
        }}
      >
        <span>{display}</span>{" "}
        <button
          onClick={handleRefreshTime}
          style={{
            marginLeft: "1rem",
            padding: "0.3rem 0.75rem",
            fontSize: "0.9rem",
            cursor: "pointer",
            borderRadius: "6px",
            border: "1px solid #ccc",
            backgroundColor: "#f2f2f2",
            color: "#333",
          }}
          title="Refresh timestamp"
        >
          Refresh Time
        </button>
      </div>

      {/* Manual entry box */}
      <form onSubmit={handleSubmit}>
        <textarea
          placeholder="Write your journal entry here..."
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          style={{
            width: "100%",
            height: "150px",
            fontSize: "1rem",
            padding: "0.75rem",
            borderRadius: 8,
            border: "1px solid #ccc",
            resize: "vertical",
            marginBottom: "1rem",
            fontFamily: "inherit",
          }}
          disabled={isRecording}
        />

        <div style={{ textAlign: "right" }}>
          <button
            type="submit"
            disabled={isRecording}
            style={{
              padding: "0.6rem 1.5rem",
              fontSize: "1rem",
              backgroundColor: "#27ae60",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: isRecording ? "not-allowed" : "pointer",
              userSelect: "none",
              fontWeight: "600",
            }}
          >
            Save Entry
          </button>
        </div>
      </form>
    </div>
  );
}
