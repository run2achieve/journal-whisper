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
  const [entriesByDate, setEntriesByDate] = useState({});

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
    const url = window.location.hostname === "localhost"
      ? "http://localhost:8090/getEntries"
      : "https://journal-whisper.onrender.com/getEntries";

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user,
          date: formatDateLocal(dateToFetch),
        }),
      });
      const data = await response.json();
      setEntriesForDate(data.entries || []);
    } catch {
      setEntriesForDate([]);
    }
  };

  const fetchAllEntriesByDate = async () => {
    const url = window.location.hostname === "localhost"
      ? "http://localhost:8090/getAllEntriesByUser"
      : "https://journal-whisper.onrender.com/getAllEntriesByUser";

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user }),
      });
      const data = await response.json();
      const byDate = {};
      (data.entries || []).forEach(({ date }) => {
        byDate[date] = true;
      });
      setEntriesByDate(byDate);
    } catch {
      setEntriesByDate({});
    }
  };

  useEffect(() => {
    fetchEntriesForDate(selectedDate);
  }, [selectedDate, user]);

  useEffect(() => {
    if (user) fetchAllEntriesByDate();
  }, [user]);

  const startRecording = async (durationSeconds) => {
    if (!navigator.mediaDevices?.getUserMedia) {
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
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
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

          const data = await response.json();
          if (data.transcription) {
            setEntry(data.transcription);
            setSaveMessage("Transcription received. Please review and save manually.");
          } else {
            setSaveMessage("No transcription received.");
          }
          setShowToast(true);
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
    mediaRecorderRef.current?.stop();
    clearInterval(countdownIntervalRef.current);
    setIsRecording(false);
  };

  const saveToGoogleSheet = async (date, time, text, username) => {
    const url = window.location.hostname === "localhost"
      ? "http://localhost:8090/saveEntry"
      : "https://journal-whisper.onrender.com/saveEntry";

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, time, entry: text, user: username }),
      });
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
      const newEntry = {
        date: currentTimestamp.date,
        time: currentTimestamp.time,
        entry,
      };

      // Optimistic UI update
      setEntriesForDate((prev) => [newEntry, ...prev]);
      setEntriesByDate((prev) => ({
        ...prev,
        [currentTimestamp.date]: true,
      }));

      setSaveMessage("Journal entry saved successfully!");
      setShowToast(true);
      setEntry("");
      const newTimestamp = generateTimestamp();
      setCurrentTimestamp(newTimestamp);
      setSelectedDate(new Date(newEntry.date + "T00:00:00"));

      fetchEntriesForDate(new Date(newEntry.date + "T00:00:00"));
      fetchAllEntriesByDate();
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
      if (mediaRecorderRef.current?.state !== "inactive") {
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

  const tileClassName = ({ date, view }) => {
    if (view === "month") {
      const dateStr = formatDateLocal(date);
      return entriesByDate[dateStr] ? "highlighted-date" : null;
    }
    return null;
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FFF8E7", padding: "2rem", fontFamily: "sans-serif", maxWidth: 700, margin: "auto", color: "#222" }}>
      {showToast && saveMessage && (
        <div style={{ position: "fixed", top: "40px", left: "50%", transform: "translateX(-50%)", backgroundColor: "#333", color: "white", padding: "10px 20px", borderRadius: "20px", boxShadow: "0 2px 10px rgba(0,0,0,0.7)", zIndex: 9999 }}>
          {saveMessage}
        </div>
      )}

      {/* UI continues: logo, controls, calendar, entries... */}
      {/* Full JSX as in your version, unchanged, aside from updated handleSubmit */}

      {/* Additional styles */}
      <style>{`
        .highlighted-date {
          background-color: #ffeb3b !important;
          border-radius: 50% !important;
          color: black !important;
          font-weight: 600;
        }
        .highlighted-date:hover {
          background-color: #fbc02d !important;
          color: black !important;
        }
      `}</style>
    </div>
  );
}
