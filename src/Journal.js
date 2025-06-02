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
  // Remove entriesByDate & related fetchAllEntriesByDate since we're not fetching now

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

  // Clear displayed entries when selectedDate changes
  useEffect(() => {
    setEntriesForDate([]);
  }, [selectedDate]);

  // -- Recording logic unchanged, keep your existing startRecording, stopRecording here --

  // Save entry locally without fetching or posting
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

    // Add entry to local state
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

  // Remove tileClassName logic for calendar highlights for now or keep if you want (no fetch)
  const tileClassName = () => null;

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

      {/* Recording buttons unchanged */}
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
          tileClassName={tileClassName}
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
