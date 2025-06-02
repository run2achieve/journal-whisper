import React, { useState, useEffect, useRef } from "react";
import Calendar from "react-calendar";
import 'react-calendar/dist/Calendar.css';
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
  const [currentTimestamp, setCurrentTimestamp] = useState({ date: "", time: "" });
  const [countdown, setCountdown] = useState(0);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [entriesForDate, setEntriesForDate] = useState([]);
  const [localEntries, setLocalEntries] = useState({});

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

  const fetchEntriesForDate = async (dateToFetch) => {
    const FETCH_API_URL =
      window.location.hostname === "localhost"
        ? "http://localhost:8090/getEntries"
        : "https://journal-whisper.onrender.com/getEntries";

    try {
      const response = await fetch(FETCH_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, date: formatDateLocal(dateToFetch) }),
      });
      if (!response.ok) throw new Error("Failed to fetch entries");
      const data = await response.json();
      setEntriesForDate(data.entries || []);
    } catch (err) {
      setEntriesForDate([]);
    }
  };

  useEffect(() => {
    fetchEntriesForDate(selectedDate);
  }, [selectedDate, user]);

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

        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
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
            setSaveMessage("Transcription received. Please review and save manually.");
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
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
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
      if (!response.ok) throw new Error("Failed to save entry to Google Sheets");
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
      setSaveMessage("Journal entry saved!");
      setShowToast(true);
      setEntry("");
      setCurrentTimestamp(generateTimestamp());

      const savedDate = new Date(currentTimestamp.date + "T00:00:00");
      setSelectedDate(savedDate);
      fetchEntriesForDate(savedDate);

      setLocalEntries((prev) => {
        const dateKey = formatDateLocal(savedDate);
        const existing = prev[dateKey] || [];
        return {
          ...prev,
          [dateKey]: [entry, ...existing],
        };
      });
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
    <div style={{ minHeight: "100vh", backgroundColor: "#FFF8E7", padding: "2rem", fontFamily: "sans-serif", maxWidth: 700, margin: "auto", color: "#222" }}>
      {showToast && saveMessage && (
        <div style={{ position: "fixed", top: "40px", left: "50%", transform: "translateX(-50%)", backgroundColor: "#333", color: "white", padding: "10px 20px", borderRadius: "20px", boxShadow: "0 2px 10px rgba(0,0,0,0.7)", zIndex: 9999, fontSize: "1rem", opacity: 0.9, userSelect: "none" }} aria-live="polite">
          {saveMessage}
        </div>
      )}

      {localEntries[formatDateLocal(selectedDate)]?.length > 0 && (
        <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#e0ffe0", borderRadius: "8px", border: "1px solid #27ae60" }}>
          <h3>Journal entry saved!</h3>
          <ul style={{ paddingLeft: "1.2rem" }}>
            {localEntries[formatDateLocal(selectedDate)].map((text, idx) => (
              <li key={idx} style={{ marginBottom: "0.5rem", whiteSpace: "pre-wrap" }}>{text}</li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
}
