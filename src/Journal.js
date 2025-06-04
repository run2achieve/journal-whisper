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
  const [localEntries, setLocalEntries] = useState({});
  const [entriesCache, setEntriesCache] = useState({}); // Cache for fetched entries
  const [cacheTimestamps, setCacheTimestamps] = useState({}); // Track when data was cached
  const [saveAnimating, setSaveAnimating] = useState(false);
  const [saveClickAnimating, setSaveClickAnimating] = useState(false);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [isRefreshingEntries, setIsRefreshingEntries] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  
  // New states for modal functionality
  const [showModal, setShowModal] = useState(false);
  const [modalEntries, setModalEntries] = useState([]);
  const [modalDate, setModalDate] = useState("");
  const [isLoadingModal, setIsLoadingModal] = useState(false);
  const [isRefreshingModal, setIsRefreshingModal] = useState(false);
  const [modalError, setModalError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const countdownIntervalRef = useRef(null);

  // Cache expiry time (5 minutes)
  const CACHE_EXPIRY_MS = 5 * 60 * 1000;

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

  const isCacheValid = (dateKey) => {
    const timestamp = cacheTimestamps[dateKey];
    if (!timestamp) return false;
    return Date.now() - timestamp < CACHE_EXPIRY_MS;
  };

  const fetchEntriesForDate = async (dateToFetch, forceRefresh = false) => {
    const dateKey = formatDateLocal(dateToFetch);
    
    // Show cached data immediately if available and valid (unless force refresh)
    const hasCachedData = entriesCache[dateKey];
    const cacheIsValid = isCacheValid(dateKey);
    
    if (!forceRefresh && hasCachedData && cacheIsValid) {
      setEntriesForDate(entriesCache[dateKey]);
      setFetchError(null);
      return;
    }

    // If we have cached data but it's stale, show it while loading fresh data
    if (hasCachedData && !forceRefresh) {
      setEntriesForDate(entriesCache[dateKey]);
      setIsRefreshingEntries(true);
      setFetchError(null);
    } else {
      setIsLoadingEntries(true);
      setFetchError(null);
    }

    const FETCH_API_URL =
      window.location.hostname === "localhost"
        ? "http://localhost:8090/getEntries"
        : "https://journal-whisper.onrender.com/getEntries";

    try {
      const response = await fetch(FETCH_API_URL, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        },
        body: JSON.stringify({
          user,
          date: dateKey,
          timestamp: Date.now() // Cache-busting timestamp
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch entries: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Sort entries by time in descending order (most recent first)
      const sortedEntries = (data.entries || []).sort((a, b) => {
        // Convert time strings to comparable format
        const timeA = new Date(`1970-01-01 ${a.time}`);
        const timeB = new Date(`1970-01-01 ${b.time}`);
        return timeB - timeA; // Descending order
      });
      
      // Update cache with timestamp
      setEntriesCache(prev => ({
        ...prev,
        [dateKey]: sortedEntries
      }));
      setCacheTimestamps(prev => ({
        ...prev,
        [dateKey]: Date.now()
      }));
      
      setEntriesForDate(sortedEntries);
      setFetchError(null);
      
    } catch (err) {
      console.error("Error fetching entries:", err);
      
      // If we have cached data, keep showing it with error message
      if (!hasCachedData) {
        setEntriesForDate([]);
        // Cache empty result to avoid repeated failed requests
        setEntriesCache(prev => ({
          ...prev,
          [dateKey]: []
        }));
        setCacheTimestamps(prev => ({
          ...prev,
          [dateKey]: Date.now()
        }));
      }
      
      setFetchError(err.message);
      
    } finally {
      setIsLoadingEntries(false);
      setIsRefreshingEntries(false);
    }
  };

  // Enhanced function to handle date clicks and show modal
  const handleDateClick = async (clickedDate) => {
    const dateKey = formatDateLocal(clickedDate);
    setModalDate(dateKey);
    setShowModal(true);
    setModalError(null);

    // Check cache first and show if valid
    const hasCachedData = entriesCache[dateKey];
    const cacheIsValid = isCacheValid(dateKey);
    
    if (hasCachedData && cacheIsValid) {
      setModalEntries(entriesCache[dateKey]);
      setIsLoadingModal(false);
      return;
    }

    // If we have cached data but it's stale, show it while loading fresh data
    if (hasCachedData) {
      setModalEntries(entriesCache[dateKey]);
      setIsRefreshingModal(true);
    } else {
      setIsLoadingModal(true);
    }

    const FETCH_API_URL =
      window.location.hostname === "localhost"
        ? "http://localhost:8090/getEntries"
        : "https://journal-whisper.onrender.com/getEntries";

    try {
      const response = await fetch(FETCH_API_URL, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        },
        body: JSON.stringify({
          user,
          date: dateKey,
          timestamp: Date.now() // Cache-busting timestamp
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch entries: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Sort entries by time in descending order (most recent first)
      const sortedEntries = (data.entries || []).sort((a, b) => {
        const timeA = new Date(`1970-01-01 ${a.time}`);
        const timeB = new Date(`1970-01-01 ${b.time}`);
        return timeB - timeA;
      });
      
      // Update cache with timestamp
      setEntriesCache(prev => ({
        ...prev,
        [dateKey]: sortedEntries
      }));
      setCacheTimestamps(prev => ({
        ...prev,
        [dateKey]: Date.now()
      }));
      
      setModalEntries(sortedEntries);
      setModalError(null);
      
    } catch (err) {
      console.error("Error fetching modal entries:", err);
      
      if (!hasCachedData) {
        setModalEntries([]);
        setEntriesCache(prev => ({
          ...prev,
          [dateKey]: []
        }));
        setCacheTimestamps(prev => ({
          ...prev,
          [dateKey]: Date.now()
        }));
      }
      
      setModalError(err.message);
      
    } finally {
      setIsLoadingModal(false);
      setIsRefreshingModal(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setModalEntries([]);
    setModalDate("");
    setModalError(null);
  };

  const handleRefreshEntries = () => {
    fetchEntriesForDate(selectedDate, true);
  };

  useEffect(() => {
    fetchEntriesForDate(selectedDate);
    setEntry("");
    setShowToast(false);
    setSaveMessage("");
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

    // Animate click: scale down quickly then back up
    setSaveClickAnimating(true);
    setTimeout(() => setSaveClickAnimating(false), 150);

    const result = await saveToGoogleSheet(
      currentTimestamp.date,
      currentTimestamp.time,
      entry,
      user
    );
    if (result) {
      setSaveAnimating(true);
      setTimeout(() => setSaveAnimating(false), 500);
      setSaveMessage("Journal entry saved successfully!");
      setShowToast(true);

      // Add the new entry to the current entries list at the top (most recent first)
      const newEntry = {
        time: currentTimestamp.time,
        entry: entry,
      };
      
      const savedDate = new Date(currentTimestamp.date + "T00:00:00");
      const currentDateKey = formatDateLocal(savedDate);
      
      // Update cache timestamp since we're adding new data
      setCacheTimestamps(prev => ({
        ...prev,
        [currentDateKey]: Date.now()
      }));
      
      // Only update entries if we're viewing the same date as we're saving to
      const selectedDateKey = formatDateLocal(selectedDate);
      if (currentDateKey === selectedDateKey) {
        // Update both the displayed entries and the cache
        setEntriesForDate(prevEntries => [newEntry, ...prevEntries]);
        setEntriesCache(prev => ({
          ...prev,
          [currentDateKey]: [newEntry, ...(prev[currentDateKey] || [])]
        }));
      } else {
        // If saving to a different date, just update the cache and switch to that date
        setEntriesCache(prev => ({
          ...prev,
          [currentDateKey]: [newEntry, ...(prev[currentDateKey] || [])]
        }));
        setSelectedDate(savedDate);
      }

      setEntry("");
      setCurrentTimestamp(generateTimestamp());

      setLocalEntries((prev) => ({
        ...prev,
        [currentDateKey]: entry,
      }));
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

      {/* Modal for showing entries when date is clicked */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 10000,
            padding: "2rem",
          }}
          onClick={closeModal}
        >
          <div
            style={{
              backgroundColor: "#FFF8E7",
              borderRadius: "12px",
              padding: "2rem",
              maxWidth: "600px",
              maxHeight: "80vh",
              overflowY: "auto",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={closeModal}
              style={{
                position: "absolute",
                top: "1rem",
                right: "1rem",
                background: "none",
                border: "none",
                fontSize: "1.5rem",
                cursor: "pointer",
                color: "#666",
                padding: "0.5rem",
                borderRadius: "50%",
                width: "40px",
                height: "40px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="Close"
            >
              ×
            </button>

            <h2 style={{ marginTop: 0, marginBottom: "1.5rem", color: "#333" }}>
              📅 Entries for {modalDate}
              {isRefreshingModal && (
                <span style={{ fontSize: "0.8rem", color: "#666", marginLeft: "1rem" }}>
                  🔄 Refreshing...
                </span>
              )}
            </h2>

            {modalError && (
              <div
                style={{
                  backgroundColor: "#fee",
                  color: "#c33",
                  padding: "0.75rem",
                  borderRadius: "6px",
                  marginBottom: "1rem",
                  fontSize: "0.9rem",
                  border: "1px solid #fcc",
                }}
              >
                ⚠️ Error loading entries: {modalError}
                {modalEntries.length > 0 && (
                  <div style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>
                    Showing cached data below.
                  </div>
                )}
              </div>
            )}

            {isLoadingModal ? (
              <div
                style={{
                  textAlign: "center",
                  color: "#666",
                  fontStyle: "italic",
                  padding: "2rem",
                }}
              >
                Loading entries...
              </div>
            ) : modalEntries.length > 0 ? (
              <>
                <div
                  style={{
                    fontSize: "0.9rem",
                    color: "#666",
                    marginBottom: "1rem",
                    fontStyle: "italic",
                  }}
                >
                  {modalEntries.length} {modalEntries.length === 1 ? "entry" : "entries"} found
                  {!isCacheValid(modalDate) && modalEntries.length > 0 && (
                    <span style={{ color: "#f39c12", marginLeft: "0.5rem" }}>
                      (cached data)
                    </span>
                  )}
                </div>
                <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                  {modalEntries.map(({ time, entry }, index) => (
                    <div
                      key={`${time}-${index}`}
                      style={{
                        marginBottom: "1.5rem",
                        padding: "1rem",
                        backgroundColor: "#f9f9f9",
                        borderRadius: "8px",
                        border: "1px solid #ddd",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: "bold",
                          fontSize: "0.9rem",
                          marginBottom: "0.5rem",
                          color: "#555",
                          borderBottom: "1px solid #eee",
                          paddingBottom: "0.25rem",
                        }}
                      >
                        🕒 {time}
                      </div>
                      <div
                        style={{
                          whiteSpace: "pre-wrap",
                          paddingTop: "0.5rem",
                          lineHeight: "1.5",
                        }}
                      >
                        {entry}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div
                style={{
                  textAlign: "center",
                  color: "#666",
                  fontStyle: "italic",
                  padding: "2rem",
                }}
              >
                No entries found for this date.
              </div>
            )}
          </div>
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
        <div style={{ textAlign: "right" }}>
          <button
            type="submit"
            disabled={isRecording}
            style={{
              padding: "0.6rem 1.5rem",
              fontSize: "1rem",
              backgroundColor: saveAnimating ? "#2ecc71" : "#27ae60",
              transform: saveAnimating
                ? "scale(1.05)"
                : saveClickAnimating
                ? "scale(0.95)"
                : "scale(1)",
              transition: "transform 0.15s ease",
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
      
      <div style={{ 
        textAlign: "center", 
        marginBottom: "1rem", 
        fontSize: "0.9rem", 
        color: "#666",
        fontStyle: "italic" 
      }}>
        💡 Click on any date to view all entries for that day
      </div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <Calendar
          onChange={(date) => {
            setSelectedDate(date);
            setShowToast(false);
            setSaveMessage("");
          }}
          onClickDay={handleDateClick}
          value={selectedDate}
          locale="en-US"
        />
      </div>

      {/* Entries section with enhanced error handling and refresh */}
      <div
        style={{
          marginTop: "1rem",
          padding: "1rem",
          backgroundColor: "#f9f9f9",
          borderRadius: "8px",
          border: "1px solid #ccc",
        }}
      >
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          marginBottom: "1rem" 
        }}>
          <h3 style={{ margin: 0 }}>
            Entries for {formatDateLocal(selectedDate)}
            {isRefreshingEntries && (
              <span style={{ fontSize: "0.8rem", color: "#666", marginLeft: "1rem" }}>
                🔄 Refreshing...
              </span>
            )}
          </h3>
          <button
            onClick={handleRefreshEntries}
            disabled={isLoadingEntries || isRefreshingEntries}
            style={{
              padding: "0.4rem 0.8rem",
              fontSize: "0.8rem",
              cursor: isLoadingEntries || isRefreshingEntries ? "not-allowed" : "pointer",
              borderRadius: "6px",
              border: "1px solid #888",
              backgroundColor: "#f0f0f0",
              color: "#333",
            }}
            title="Refresh entries"
          >
            🔄 Refresh
          </button>
        </div>

        {fetchError && (
          <div
            style={{
              backgroundColor: "#fee",
              color: "#c33",
              padding: "0.75rem",
              borderRadius: "6px",
              marginBottom: "1rem",
              fontSize: "0.9rem",
              border: "1px solid #fcc",
            }}
          >
            ⚠️ Error loading entries: {fetchError}
            {entriesForDate.length > 0 && (
              <div style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>
                Showing cached data below.
              </div>
            )}
          </div>
        )}
        
        {isLoadingEntries ? (
          <div style={{ 
            textAlign: "center", 
            color: "#666", 
            fontStyle: "italic",
            padding: "1rem" 
          }}>
            Loading entries...
          </div>
        ) : entriesForDate.length > 0 ? (
          <>
            <div style={{ 
              fontSize: "0.9rem", 
              color: "#666", 
              marginBottom: "1rem",
              fontStyle: "italic" 
            }}>
              ({entriesForDate.length} {entriesForDate.length === 1 ? 'entry' : 'entries'} found - Most Recent First)
              {!isCacheValid(formatDateLocal(selectedDate)) && entriesForDate.length > 0 && (
                <span style={{ color: "#f39c12", marginLeft: "0.5rem" }}>
                  (cached data)
                </span>
              )}
            </div>
            {entriesForDate.map(({ time, entry }, index) => (
              <div
                key={`${time}-${index}`}
                style={{
                  marginBottom: "1rem",
                  borderBottom: index < entriesForDate.length - 1 ? "1px solid #ddd" : "none",
                  paddingBottom: "0.5rem",
                }}
              >
                <div
                  style={{
                    fontWeight: "bold",
                    fontSize: "0.9rem",
                    marginBottom: "0.5rem",
                    color: "#555",
                    borderBottom: "1px solid #eee",
                    paddingBottom: "0.25rem",
                  }}
                >
                  {time}
                </div>
                <div style={{ 
                  whiteSpace: "pre-wrap",
                  paddingTop: "0.25rem",
                  lineHeight: "1.4"
                }}>
                  {entry}
                </div>
              </div>
            ))}
          </>
        ) : (
          <div style={{ 
            textAlign: "center", 
            color: "#666", 
            fontStyle: "italic",
            padding: "1rem" 
          }}>
            No entries found for this date.
          </div>
        )}
      </div>
    </div>
  );
}