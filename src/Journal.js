import React, { useState, useEffect, useRef } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import logo from "./assets/logo.png";

const PROXY_API_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:8090/transcribeAudio"
    : "https://journal-whisper.onrender.com/transcribeAudio";

const formatDateLocal = (date) => {
  const dateObj = date instanceof Date ? date : new Date(date);
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
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
  const [entriesCache, setEntriesCache] = useState({});
  const [cacheTimestamps, setCacheTimestamps] = useState({});
  const [saveAnimating, setSaveAnimating] = useState(false);
  const [saveClickAnimating, setSaveClickAnimating] = useState(false);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [isRefreshingEntries, setIsRefreshingEntries] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const countdownIntervalRef = useRef(null);

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
    
    const cachedData = entriesCache[dateKey];
    const isEmptyResult = Array.isArray(cachedData) && cachedData.length === 0;
    const expiryTime = isEmptyResult ? 60 * 1000 : CACHE_EXPIRY_MS;
    
    return Date.now() - timestamp < expiryTime;
  };

  const fetchEntriesForDate = async (dateToFetch, forceRefresh = false) => {
    const dateKey = formatDateLocal(dateToFetch);
    
    console.group(`🔍 FETCH DEBUG - Date: ${dateKey}`);
    console.log("1. Input date object:", dateToFetch);
    console.log("2. Formatted date key:", dateKey);
    console.log("3. Current user:", user);
    console.log("4. Force refresh:", forceRefresh);
    
    const hasCachedData = entriesCache[dateKey];
    const cacheIsValid = isCacheValid(dateKey);
    
    console.log("5. Has cached data:", hasCachedData);
    console.log("6. Cache is valid:", cacheIsValid);
    
    if (!forceRefresh && hasCachedData && cacheIsValid) {
      console.log("✅ Using valid cache data");
      console.groupEnd();
      setEntriesForDate(entriesCache[dateKey]);
      setFetchError(null);
      return;
    }

    if (hasCachedData && !forceRefresh) {
      console.log("⚠️ Using stale cache while refreshing");
      setEntriesForDate(entriesCache[dateKey]);
      setIsRefreshingEntries(true);
      setFetchError(null);
    } else {
      console.log("🔄 Loading fresh data");
      setIsLoadingEntries(true);
      setFetchError(null);
    }

    const FETCH_API_URL =
      window.location.hostname === "localhost"
        ? "http://localhost:8090/getEntries"
        : "https://journal-whisper.onrender.com/getEntries";

    try {
      const requestBody = {
        user: user,
        date: dateKey,
        timestamp: Date.now()
      };
      
      console.log("7. Request body:", JSON.stringify(requestBody, null, 2));
      console.log("8. 🚀 Sending fetch request...");
      
      const response = await fetch(FETCH_API_URL, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        },
        body: JSON.stringify(requestBody),
      });
      
      console.log("9. Response status:", response.status);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch entries: ${response.status} ${response.statusText}`);
      }
      
      const responseText = await response.text();
      console.log("10. Raw response text:", responseText);
      
      let data;
      try {
        data = JSON.parse(responseText);
        console.log("11. Parsed JSON data:", data);
      } catch (parseError) {
        console.error("❌ JSON parse error:", parseError);
        throw new Error("Invalid JSON response from server");
      }
      
      const sortedEntries = (data.entries || []).sort((a, b) => {
        const timeA = new Date(`1970-01-01 ${a.time}`);
        const timeB = new Date(`1970-01-01 ${b.time}`);
        return timeB - timeA;
      });
      
      console.log("12. Final sorted entries:", sortedEntries);
      
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
      
      console.log("✅ SUCCESS: Entries fetched and set");
      
    } catch (err) {
      console.error("❌ ERROR in fetchEntriesForDate:", err);
      
      if (!hasCachedData) {
        setEntriesForDate([]);
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
      console.log("13. 🏁 Fetch operation complete");
      console.groupEnd();
      setIsLoadingEntries(false);
      setIsRefreshingEntries(false);
    }
  };

  const handleRefreshEntries = () => {
    fetchEntriesForDate(selectedDate, true);
  };

  const DebugSection = () => {
    const testAPICall = async () => {
      console.group("🧪 MANUAL API TEST");
      
      const testDate = "2025-06-03";
      const FETCH_API_URL =
        window.location.hostname === "localhost"
          ? "http://localhost:8090/getEntries"
          : "https://journal-whisper.onrender.com/getEntries";

      try {
        console.log("Testing with date:", testDate);
        console.log("Testing with user:", user);
        
        const response = await fetch(FETCH_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user: user,
            date: testDate,
            timestamp: Date.now()
          }),
        });
        
        console.log("Test response status:", response.status);
        const responseText = await response.text();
        console.log("Test response text:", responseText);
        
        if (response.ok) {
          const data = JSON.parse(responseText);
          console.log("Test response data:", data);
        }
        
      } catch (error) {
        console.error("Test API call failed:", error);
      }
      
      console.groupEnd();
    };

    return (
      <div style={{ 
        marginTop: "2rem", 
        padding: "1rem", 
        backgroundColor: "#f0f0f0", 
        borderRadius: "8px",
        border: "2px solid #orange"
      }}>
        <h4>🐛 Debug Tools</h4>
        <p style={{ fontSize: "0.9rem", color: "#666" }}>
          Current user: <strong>{user}</strong><br/>
          Current cache: {Object.keys(entriesCache).length} dates cached<br/>
          Selected date: <strong>{formatDateLocal(selectedDate)}</strong>
        </p>
        <button 
          onClick={testAPICall}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#ff9800",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          🧪 Test API Call
        </button>
        <button 
          onClick={() => {
            console.log("Current state:");
            console.log("- user:", user);
            console.log("- selectedDate:", selectedDate);
            console.log("- entriesCache:", entriesCache);
            console.log("- cacheTimestamps:", cacheTimestamps);
            console.log("- entriesForDate:", entriesForDate);
          }}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#2196f3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            marginLeft: "0.5rem"
          }}
        >
          📊 Log Current State
        </button>
        <button 
          onClick={() => {
            setEntriesCache({});
            setCacheTimestamps({});
            setEntriesForDate([]);
            console.log("🗑️ Cache cleared!");
            setSaveMessage("Cache cleared - try clicking a date again");
            setShowToast(true);
          }}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#f44336",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            marginLeft: "0.5rem"
          }}
        >
          🗑️ Clear Cache
        </button>
      </div>
    );
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
      console.log("Saving to Google Sheet:", { date, time, entry: text, user: username });
      
      const response = await fetch(SAVE_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, time, entry: text, user: username }),
      });
      if (!response.ok)
        throw new Error("Failed to save entry to Google Sheets");
      
      const result = await response.json();
      console.log("Save result:", result);
      return result;
    } catch (error) {
      console.error("Save error:", error);
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

    setSaveClickAnimating(true);
    setTimeout(() => setSaveClickAnimating(false), 150);

    const saveDate = formatDateLocal(new Date());
    const saveTime = new Date().toLocaleTimeString();
    
    console.log("Saving entry with date:", saveDate, "time:", saveTime, "user:", user);

    const result = await saveToGoogleSheet(
      saveDate,
      saveTime,
      entry,
      user
    );
    
    if (result) {
      setSaveAnimating(true);
      setTimeout(() => setSaveAnimating(false), 500);
      setSaveMessage("Journal entry saved successfully!");
      setShowToast(true);

      const newEntry = {
        time: saveTime,
        entry: entry,
      };
      
      setCacheTimestamps(prev => ({
        ...prev,
        [saveDate]: Date.now()
      }));
      
      const selectedDateKey = formatDateLocal(selectedDate);
      if (saveDate === selectedDateKey) {
        setEntriesForDate(prevEntries => [newEntry, ...prevEntries]);
        setEntriesCache(prev => ({
          ...prev,
          [saveDate]: [newEntry, ...(prev[saveDate] || [])]
        }));
      } else {
        setEntriesCache(prev => ({
          ...prev,
          [saveDate]: [newEntry, ...(prev[saveDate] || [])]
        }));
        setSelectedDate(new Date(saveDate + "T00:00:00"));
      }

      setEntry("");
      setCurrentTimestamp(generateTimestamp());

      setLocalEntries((prev) => ({
        ...prev,
        [saveDate]: entry,
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
        💡 Click on any date to view entries below
      </div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <Calendar
          onChange={(date) => {
            console.log("Calendar date changed to:", date, "formatted as:", formatDateLocal(date));
            setSelectedDate(date);
            setShowToast(false);
            setSaveMessage("");
          }}
          value={selectedDate}
          locale="en-US"
        />
      </div>

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

      <DebugSection />
    </div>
  );
}