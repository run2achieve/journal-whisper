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
  
  // CSV Download states
  const [showDownloadSection, setShowDownloadSection] = useState(false);
  const [downloadFromDate, setDownloadFromDate] = useState("");
  const [downloadToDate, setDownloadToDate] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(null);

  // Summary states
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState(null);

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

  // Summary functionality
  const generateSummary = async () => {
    const dateKey = formatDateLocal(selectedDate);
    
    if (entriesForDate.length === 0) {
      setSummaryError("No entries found for this date to summarize.");
      setShowSummaryModal(true);
      return;
    }

    setIsGeneratingSummary(true);
    setSummaryError(null);

    const SUMMARY_API_URL =
      window.location.hostname === "localhost"
        ? "http://localhost:8090/generateSummary"
        : "https://journal-whisper.onrender.com/generateSummary";

    try {
      console.log(`🤖 Generating summary for ${user} on ${dateKey}`);
      
      const response = await fetch(SUMMARY_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: user,
          date: dateKey
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to generate summary: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log("✅ Summary generated:", data);
      
      setSummaryData({
        summary: data.summary,
        generatedAt: data.generatedAt,
        isExisting: data.isExisting || false,
        entriesCount: data.entriesCount || entriesForDate.length,
        date: dateKey
      });
      
      setShowSummaryModal(true);
      
      // Show success message
      setSaveMessage(data.isExisting ? "Existing summary loaded!" : "New summary generated!");
      setShowToast(true);
      
    } catch (error) {
      console.error("❌ Error generating summary:", error);
      setSummaryError(error.message);
      setShowSummaryModal(true);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const SummaryModal = () => {
    if (!showSummaryModal) return null;

    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 10000,
          padding: "2rem",
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowSummaryModal(false);
            setSummaryData(null);
            setSummaryError(null);
          }
        }}
      >
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "12px",
            padding: "2rem",
            maxWidth: "600px",
            width: "100%",
            maxHeight: "80vh",
            overflow: "auto",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
            position: "relative",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={() => {
              setShowSummaryModal(false);
              setSummaryData(null);
              setSummaryError(null);
            }}
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
            ✕
          </button>

          {/* Modal content */}
          <div style={{ marginRight: "2rem" }}>
            <h2 style={{ 
              margin: "0 0 1rem 0", 
              color: "#333",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem"
            }}>
              <span>📝</span>
              Daily Summary - {summaryData?.date || formatDateLocal(selectedDate)}
            </h2>

            {summaryError ? (
              <div style={{
                backgroundColor: "#fee",
                color: "#c33",
                padding: "1rem",
                borderRadius: "8px",
                border: "1px solid #fcc",
                textAlign: "center"
              }}>
                <div style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>⚠️</div>
                <div style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>
                  Unable to Generate Summary
                </div>
                <div style={{ fontSize: "0.9rem" }}>
                  {summaryError}
                </div>
              </div>
            ) : summaryData ? (
              <>
                {/* Summary metadata */}
                <div style={{
                  backgroundColor: "#f8f9fa",
                  padding: "0.75rem",
                  borderRadius: "6px",
                  marginBottom: "1.5rem",
                  fontSize: "0.9rem",
                  color: "#666"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
                    <span>
                      📊 Based on <strong>{summaryData.entriesCount}</strong> {summaryData.entriesCount === 1 ? 'entry' : 'entries'}
                    </span>
                    <span>
                      {summaryData.isExisting ? "📚 Previously generated" : "✨ Newly generated"}
                    </span>
                  </div>
                  {summaryData.generatedAt && (
                    <div style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>
                      Generated: {new Date(summaryData.generatedAt).toLocaleString()}
                    </div>
                  )}
                </div>

                {/* Summary content */}
                <div style={{
                  backgroundColor: "#fff",
                  padding: "1.5rem",
                  borderRadius: "8px",
                  border: "2px solid #e3f2fd",
                  lineHeight: "1.6",
                  fontSize: "1rem"
                }}>
                  <div style={{ 
                    whiteSpace: "pre-wrap",
                    color: "#333"
                  }}>
                    {summaryData.summary}
                  </div>
                </div>

                {/* Actions */}
                <div style={{
                  marginTop: "1.5rem",
                  textAlign: "center"
                }}>
                  <button
                    onClick={() => {
                      setShowSummaryModal(false);
                      setSummaryData(null);
                      setSummaryError(null);
                    }}
                    style={{
                      padding: "0.75rem 2rem",
                      fontSize: "1rem",
                      backgroundColor: "#2196f3",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontWeight: "600",
                    }}
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "2rem" }}>
                <div style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>🤖</div>
                <div>Loading summary...</div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // CSV Download functionality
  const downloadEntriesAsCSV = async () => {
    if (!downloadFromDate || !downloadToDate) {
      setDownloadError("Please select both from and to dates");
      return;
    }

    if (new Date(downloadFromDate) > new Date(downloadToDate)) {
      setDownloadError("From date must be before or equal to To date");
      return;
    }

    setIsDownloading(true);
    setDownloadError(null);

    try {
      console.log("📥 Starting CSV download for date range:", downloadFromDate, "to", downloadToDate);

      // Get all entries for the date range
      const allEntries = [];
      const startDate = new Date(downloadFromDate);
      const endDate = new Date(downloadToDate);
      
      // Loop through each date in the range
      for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        const dateKey = formatDateLocal(date);
        console.log("Fetching entries for date:", dateKey);

        const FETCH_API_URL =
          window.location.hostname === "localhost"
            ? "http://localhost:8090/getEntries"
            : "https://journal-whisper.onrender.com/getEntries";

        try {
          const response = await fetch(FETCH_API_URL, {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Cache-Control": "no-cache, no-store, must-revalidate"
            },
            body: JSON.stringify({
              user: user,
              date: dateKey,
              timestamp: Date.now()
            }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.entries && data.entries.length > 0) {
              // Add date to each entry and collect them
              const entriesWithDate = data.entries.map(entry => ({
                date: dateKey,
                time: entry.time,
                entry: entry.entry,
                user: entry.user
              }));
              allEntries.push(...entriesWithDate);
              console.log(`Found ${data.entries.length} entries for ${dateKey}`);
            }
          }
        } catch (error) {
          console.error(`Error fetching entries for ${dateKey}:`, error);
        }
      }

      console.log("Total entries collected:", allEntries.length);

      if (allEntries.length === 0) {
        setDownloadError("No entries found for the selected date range");
        return;
      }

      // Sort entries by date and time
      allEntries.sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.time.localeCompare(b.time);
      });

      // Create CSV content
      const csvHeaders = "Date,Time,Entry,User\n";
      const csvRows = allEntries.map(entry => {
        // Escape quotes and wrap fields with quotes if they contain commas or quotes
        const escapeCSV = (field) => {
          const str = String(field || "");
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };

        return `${escapeCSV(entry.date)},${escapeCSV(entry.time)},${escapeCSV(entry.entry)},${escapeCSV(entry.user)}`;
      }).join("\n");

      const csvContent = csvHeaders + csvRows;

      // Create and download the file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        
        // Create filename with date range and user
        const fromDateFormatted = downloadFromDate.replace(/-/g, "");
        const toDateFormatted = downloadToDate.replace(/-/g, "");
        const filename = `journal-entries-${user}-${fromDateFormatted}-to-${toDateFormatted}.csv`;
        
        link.setAttribute("download", filename);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        console.log("✅ CSV file downloaded successfully:", filename);
        setSaveMessage(`Downloaded ${allEntries.length} entries as CSV file!`);
        setShowToast(true);
      }

    } catch (error) {
      console.error("❌ Error downloading CSV:", error);
      setDownloadError("Failed to download CSV: " + error.message);
    } finally {
      setIsDownloading(false);
    }
  };

  // Get date range options (last 6 months to future 1 month)
  const getDateOptions = () => {
    const options = [];
    const today = new Date();
    
    // Go back 6 months
    const startDate = new Date(today);
    startDate.setMonth(startDate.getMonth() - 6);
    
    // Go forward 1 month
    const endDate = new Date(today);
    endDate.setMonth(endDate.getMonth() + 1);
    
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dateKey = formatDateLocal(date);
      const displayDate = date.toLocaleDateString("en-US", { 
        weekday: "short", 
        year: "numeric", 
        month: "short", 
        day: "numeric" 
      });
      options.push({ value: dateKey, label: displayDate });
    }
    
    return options;
  };

  // Initialize download dates to current month
  useEffect(() => {
    if (!downloadFromDate || !downloadToDate) {
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      
      setDownloadFromDate(formatDateLocal(firstDayOfMonth));
      setDownloadToDate(formatDateLocal(lastDayOfMonth));
    }
  }, [downloadFromDate, downloadToDate]);

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

      {/* CSV Download Section */}
      <div style={{ marginTop: "2rem", marginBottom: "2rem" }}>
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          marginBottom: "1rem" 
        }}>
          <h3 style={{ margin: 0, color: "#333" }}>📥 Download Entries as CSV</h3>
          <button
            onClick={() => setShowDownloadSection(!showDownloadSection)}
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.9rem",
              cursor: "pointer",
              borderRadius: "6px",
              border: "1px solid #888",
              backgroundColor: showDownloadSection ? "#e0e0e0" : "#2196f3",
              color: showDownloadSection ? "#333" : "white",
              fontWeight: "600"
            }}
          >
            {showDownloadSection ? "Hide Options" : "Show Download Options"}
          </button>
        </div>

        {showDownloadSection && (
          <div style={{ 
            padding: "1.5rem", 
            backgroundColor: "#f0f8ff", 
            borderRadius: "8px", 
            border: "2px solid #2196f3" 
          }}>
            <p style={{ 
              margin: "0 0 1rem 0", 
              fontSize: "0.9rem", 
              color: "#666",
              fontStyle: "italic" 
            }}>
              📋 Download your journal entries as a CSV file for the selected date range
            </p>

            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "1fr 1fr", 
              gap: "1rem", 
              marginBottom: "1rem" 
            }}>
              <div>
                <label style={{ 
                  display: "block", 
                  marginBottom: "0.5rem", 
                  fontWeight: "bold", 
                  fontSize: "0.9rem" 
                }}>
                  📅 From Date:
                </label>
                <input
                  type="date"
                  value={downloadFromDate}
                  onChange={(e) => setDownloadFromDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    borderRadius: "4px",
                    border: "1px solid #ccc",
                    fontSize: "0.9rem"
                  }}
                />
              </div>
              
              <div>
                <label style={{ 
                  display: "block", 
                  marginBottom: "0.5rem", 
                  fontWeight: "bold", 
                  fontSize: "0.9rem" 
                }}>
                  📅 To Date:
                </label>
                <input
                  type="date"
                  value={downloadToDate}
                  onChange={(e) => setDownloadToDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    borderRadius: "4px",
                    border: "1px solid #ccc",
                    fontSize: "0.9rem"
                  }}
                />
              </div>
            </div>

            {downloadError && (
              <div style={{
                backgroundColor: "#fee",
                color: "#c33",
                padding: "0.75rem",
                borderRadius: "6px",
                marginBottom: "1rem",
                fontSize: "0.9rem",
                border: "1px solid #fcc",
              }}>
                ⚠️ {downloadError}
              </div>
            )}

            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center",
              flexWrap: "wrap",
              gap: "1rem"
            }}>
              <div style={{ fontSize: "0.8rem", color: "#666" }}>
                👤 User: <strong>{user}</strong><br/>
                📊 Range: <strong>{downloadFromDate}</strong> to <strong>{downloadToDate}</strong>
              </div>
              
              <button
                onClick={downloadEntriesAsCSV}
                disabled={isDownloading || !downloadFromDate || !downloadToDate}
                style={{
                  padding: "0.8rem 2rem",
                  fontSize: "1.1rem",
                  backgroundColor: isDownloading ? "#cccccc" : "#2196f3",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: isDownloading ? "not-allowed" : "pointer",
                  fontWeight: "700",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  boxShadow: isDownloading ? "none" : "0 2px 4px rgba(33, 150, 243, 0.3)"
                }}
              >
                {isDownloading ? (
                  <>
                    <span>⏳</span>
                    Downloading...
                  </>
                ) : (
                  <>
                    <span>📥</span>
                    Download CSV
                  </>
                )}
              </button>
            </div>

            <div style={{ 
              marginTop: "1rem", 
              fontSize: "0.8rem", 
              color: "#555",
              backgroundColor: "#fff",
              padding: "0.5rem",
              borderRadius: "4px",
              border: "1px solid #ddd"
            }}>
              💡 <strong>CSV Format:</strong> Date, Time, Entry, User | 
              <strong>Filename:</strong> journal-entries-{user}-[daterange].csv
            </div>
          </div>
        )}
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
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {entriesForDate.length > 0 && (
              <button
                onClick={generateSummary}
                disabled={isGeneratingSummary || isLoadingEntries}
                style={{
                  padding: "0.4rem 0.8rem",
                  fontSize: "0.8rem",
                  cursor: isGeneratingSummary || isLoadingEntries ? "not-allowed" : "pointer",
                  borderRadius: "6px",
                  border: "1px solid #2196f3",
                  backgroundColor: isGeneratingSummary ? "#e3f2fd" : "#2196f3",
                  color: isGeneratingSummary ? "#666" : "white",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem"
                }}
                title="Generate AI summary of this day's entries"
              >
                {isGeneratingSummary ? (
                  <>
                    <span>🤖</span>
                    Generating...
                  </>
                ) : (
                  <>
                    <span>📝</span>
                    Summarize
                  </>
                )}
              </button>
            )}
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

      <SummaryModal />
      <DebugSection />
    </div>
  );
}