import React, { useState, useEffect, useRef } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import logo from "./assets/logo.png";

const PROXY_API_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:8090/transcribeAudio"
    : "https://journal-whisper.onrender.com/transcribeAudio";

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
  const [currentTimestamp, setCurrentTimestamp] = useState({
    date: "",
    time: "",
  });
  const [countdown, setCountdown] = useState(0);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [entriesForDate, setEntriesForDate] = useState([]);
  const [entriesByDate, setEntriesByDate] = useState({}); // For calendar highlights

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

  // Fetch entries for a specific date
  const fetchEntriesForDate = async (dateToFetch) => {
    const FETCH_API_URL =
      window.location.hostname === "localhost"
        ? "http://localhost:8090/getEntries"
        : "https://journal-whisper.onrender.com/getEntries";

    try {
      const response = await fetch(FETCH_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user,
          date: formatDateLocal(dateToFetch),
        }),
      });
      if (!response.ok) throw new Error("Failed to fetch entries");
      const data = await response.json();
      setEntriesForDate(data.entries || []);
    } catch (err) {
      setEntriesForDate([]);
    }
  };

  // Fetch all entries for user (for calendar highlights)
  const fetchAllEntriesByDate = async () => {
    const FETCH_API_URL =
      window.location.hostname === "localhost"
        ? "http://localhost:8090/getAllEntriesByUser"
        : "https://journal-whisper.onrender.com/getAllEntriesByUser";

    try {
      const response = await fetch(FETCH_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user }),
      });
      if (!response.ok) throw new Error("Failed to fetch all entries");
      const data = await response.json();

      const byDate = {};
      (data.entries || []).forEach(({ date }) => {
        if (!byDate[date]) byDate[date] = true; // existence flag for highlights
      });
      setEntriesByDate(byDate);
    } catch (err) {
      setEntriesByDate({});
    }
  };

  useEffect(() => {
    fetchEntriesForDate(selectedDate);
  }, [selectedDate, user]);

  useEffect(() => {
    if (user) {
      fetchAllEntriesByDate();
    }
  }, [user]);

  // Recording logic
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
      setCurrentTimestamp(generateTimestamp());
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

          if (!response.ok)
            throw new Error(`Transcription failed: ${response.statusText}`);

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
    const result = await saveToGoogleSheet(
      currentTimestamp.date,
      currentTimestamp.time,
      entry,
      user
    );
    if (result) {
      setSaveMessage("Journal entry saved successfully!");
      setShowToast(true);
      setEntry("");
      setCurrentTimestamp(generateTimestamp());

      const savedDate = new Date(currentTimestamp.date + "T00:00:00");
      setSelectedDate(savedDate);
      fetchEntriesForDate(savedDate);
      fetchAllEntriesByDate(); // refresh calendar highlights
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

  // Custom calendar tile class for highlighting dates with entries
  const tileClassName = ({ date, view }) => {
    if (view === "month") {
      const dateStr = formatDateLocal(date);
      if (entriesByDate[dateStr]) {
        return "highlighted-date"; // class to add styling
      }
    }
    return null;
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

      {/* Recording buttons */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          marginBottom: "1rem",
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
              onClick={() => {
                if (isActive) {
                  stopRecording();
                } else if (!isRecording) {
                  startRecording(duration);
                }
              }}
              disabled={isRecording && recordingDuration !== duration}
              style={{
                position: "relative",
                height: "60px",
                width: "60px",
                borderRadius: isActive ? "8px" : "50%",
                border: "none",
                backgroundColor: isActive ? "#FF0000" : "#FFD700",
                color: "#000",
                fontSize: "0.9rem",
                fontWeight: "bold",
                boxShadow: isActive ? "0 0 10px #ff4444" : "none",
                cursor:
                  isRecording && recordingDuration !== duration
                    ? "not-allowed"
                    : "pointer",
                transition: "all 0.3s ease",
                userSelect: "none",
              }}
              title={label}
            >
              {!isActive && label}
              {isActive && (
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    height: "8px",
                    background: "#27ae60",
                    width: getButtonProgress(),
                    transition: "width 0.3s ease",
                    borderRadius: "0 0 8px 8px",
                  }}
                />
              )}
            </button>
          );
        })}
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
        <button
          type="submit"
          style={{
            width: "100%",
            padding: "0.75rem",
            backgroundColor: "#4CAF50",
            color: "white",
            fontSize: "1.1rem",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            userSelect: "none",
          }}
          disabled={isRecording}
        >
          Save Entry
        </button>
      </form>

      <h3 style={{ marginTop: "2rem" }}>
        Journal Entries for {formatDateLocal(selectedDate)}
      </h3>

      <ul
        style={{
          listStyleType: "none",
          paddingLeft: 0,
          maxHeight: "200px",
          overflowY: "auto",
          border: "1px solid #ccc",
          borderRadius: "8px",
          backgroundColor: "#f9f9f9",
        }}
      >
        {entriesForDate.length === 0 && (
          <li style={{ padding: "0.5rem", color: "#666" }}>
            No entries for this date.
          </li>
        )}
        {entriesForDate.map(({ time, entry }, index) => (
          <li
            key={index}
            style={{
              padding: "0.5rem",
              borderBottom: "1px solid #ddd",
              whiteSpace: "pre-wrap",
              fontSize: "0.9rem",
              color: "#333",
            }}
          >
            <strong>{time}:</strong> {entry}
          </li>
        ))}
      </ul>

      <h3 style={{ marginTop: "2rem" }}>Select Date</h3>

      <Calendar
        value={selectedDate}
        onChange={setSelectedDate}
        tileClassName={tileClassName}
        calendarType="US"
        next2Label={null}
        prev2Label={null}
      />

      <style>{`
        .highlighted-date {
          background: #FFD700 !important;
          color: black !important;
          border-radius: 50%;
        }
        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
