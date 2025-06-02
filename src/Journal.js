import React, { useState, useEffect, useRef } from "react";
import Calendar from "react-calendar";
import 'react-calendar/dist/Calendar.css';
import logo from "./assets/logo.png";

const formatDateLocal = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function Journal({ user, onLogout }) {
  const [entry, setEntry] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [currentTimestamp, setCurrentTimestamp] = useState({ date: "", time: "" });
  const [countdown, setCountdown] = useState(0);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [entriesForDate, setEntriesForDate] = useState([]);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const countdownIntervalRef = useRef(null);

  const generateTimestamp = () => {
    const now = new Date();
    return {
      date: formatDateLocal(now),
      time: now.toLocaleTimeString(),
    };
  };

  useEffect(() => {
    setCurrentTimestamp(generateTimestamp());
  }, []);

  useEffect(() => {
    setEntriesForDate([]);
  }, [selectedDate]);

  // --- Recording logic ---

  const startRecording = (durationSeconds = 20) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setSaveMessage("Audio recording not supported on this browser.");
      setShowToast(true);
      return;
    }

    setIsRecording(true);
    setRecordingDuration(durationSeconds);
    setCountdown(durationSeconds);
    audioChunksRef.current = [];

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.start();

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          const reader = new FileReader();
          reader.onload = () => {
            const base64data = reader.result.split(',')[1];
            // Append audio base64 string to the journal entry text area
            setEntry((prev) => prev + `\n[audio_base64:${base64data}]`);
            setIsRecording(false);
            setCountdown(0);
            setRecordingDuration(0);
          };
          reader.readAsDataURL(audioBlob);
          stream.getTracks().forEach(track => track.stop());
        };

        // Countdown timer
        countdownIntervalRef.current = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              clearInterval(countdownIntervalRef.current);
              mediaRecorder.stop();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      })
      .catch((err) => {
        setSaveMessage("Microphone permission denied or error.");
        setShowToast(true);
        setIsRecording(false);
        setCountdown(0);
        setRecordingDuration(0);
      });
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    clearInterval(countdownIntervalRef.current);
    setIsRecording(false);
    setCountdown(0);
    setRecordingDuration(0);
  };

  // Save entry locally
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!entry.trim()) {
      setSaveMessage("Please enter something before saving.");
      setShowToast(true);
      return;
    }

    const newEntry = {
      date: currentTimestamp.date,
      time: currentTimestamp.time,
      entry,
      user,
    };

    setEntriesForDate((prev) => [...prev, newEntry]);
    setSaveMessage("Journal entry saved locally!");
    setShowToast(true);
    setEntry("");
    setCurrentTimestamp(generateTimestamp());
  };

  const handleRefreshTime = () => {
    setCurrentTimestamp(generateTimestamp());
    setSaveMessage("");
  };

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
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
              border: "1px solid #888",
              backgroundColor: "#f0f0f0",
              color: "#333",
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Recording Buttons */}
      <div
        style={{
          marginBottom: "1rem",
          display: "flex",
          gap: "0.75rem",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {/* 5-second recording button */}
        <button
          onClick={() => startRecording(5)}
          disabled={isRecording}
          style={{
            flex: 1,
            padding: "0.7rem 0",
            fontSize: "1rem",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: isRecording ? "not-allowed" : "pointer",
            userSelect: "none",
            fontWeight: "600",
            position: "relative",
          }}
          aria-label="Record 5 seconds"
        >
          {isRecording && recordingDuration === 5 ? (
            <span
              style={{
                position: "absolute",
                left: 0,
                bottom: 0,
                height: "3px",
                backgroundColor: "yellow",
                width: getButtonProgress(),
                borderRadius: "0 0 8px 8px",
                transition: "width 1s linear",
              }}
            />
          ) : null}
          Record 5s
        </button>

        {/* 10-second recording button */}
        <button
          onClick={() => startRecording(10)}
          disabled={isRecording}
          style={{
            flex: 1,
            padding: "0.7rem 0",
            fontSize: "1rem",
            backgroundColor: "#28a745",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: isRecording ? "not-allowed" : "pointer",
            userSelect: "none",
            fontWeight: "600",
            position: "relative",
          }}
          aria-label="Record 10 seconds"
        >
          {isRecording && recordingDuration === 10 ? (
            <span
              style={{
                position: "absolute",
                left: 0,
                bottom: 0,
                height: "3px",
                backgroundColor: "yellow",
                width: getButtonProgress(),
                borderRadius: "0 0 8px 8px",
                transition: "width 1s linear",
              }}
            />
          ) : null}
          Record 10s
        </button>

        {/* Stop recording button */}
        <button
          onClick={stopRecording}
          disabled={!isRecording}
          style={{
            flex: 1,
            padding: "0.7rem 0",
            fontSize: "1rem",
            backgroundColor: "#dc3545",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: isRecording ? "pointer" : "not-allowed",
            userSelect: "none",
            fontWeight: "600",
          }}
          aria-label="Stop recording"
        >
          Stop
        </button>
      </div>

      {/* Timestamp */}
      <div
        style={{
          textAlign: "center",
          marginBottom: "1rem",
          fontSize: "1.1rem",
        }}
      >
        <span>
          📅 {currentTimestamp.date} 🕒 {currentTimestamp.time}
        </span>
        <button
          onClick={handleRefreshTime}
          style={{
            marginLeft: "1rem",
            padding: "0.3rem 0.75rem",
            fontSize: "0.9rem",
            cursor: "pointer",
            borderRadius: "6px",
            border: "1px solid #888",
            backgroundColor: "#f0f0f0",
            color: "#333",
          }}
          title="Refresh timestamp"
        >
          Refresh Time
        </button>
      </div>

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

      <hr style={{ margin: "2rem 0", borderColor: "#ccc" }} />
      <h2 style={{ textAlign: "center", marginBottom: "1rem" }}>
        📅 Journal Calendar
      </h2>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <Calendar
          onChange={setSelectedDate}
          value={selectedDate}
          locale="en-US"
        />
      </div>

      {entriesForDate.length > 0 ? (
        <div style={{ marginTop: "1rem" }}>
          <h3>Entries on {formatDateLocal(selectedDate)}:</h3>
          <ul style={{ listStyle: "none", paddingLeft: 0 }}>
            {entriesForDate.map((e, idx) => (
              <li
                key={idx}
                style={{
                  backgroundColor: "#fff",
                  borderRadius: "8px",
                  padding: "0.75rem 1rem",
                  marginBottom: "0.75rem",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                  whiteSpace: "pre-wrap",
                }}
              >
                <div
                  style={{
                    fontWeight: "bold",
                    fontSize: "0.95rem",
                    marginBottom: "0.25rem",
                    color: "#555",
                  }}
                >
                  {e.date} {e.time}
                </div>
                <div style={{ fontSize: "1rem", color: "#222" }}>{e.entry}</div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p style={{ textAlign: "center", marginTop: "1rem", color: "#777" }}>
          No entries for this date.
        </p>
      )}

      <footer style={{ marginTop: "3rem", textAlign: "center", color: "#aaa" }}>
        © 2025 My Journal App
      </footer>
    </div>
  );
}
