import React, { useState, useEffect } from "react";

const USERS = {
  user1: "7hdxq2ma",
  user2: "n9q1zw2s",
  user3: "fmp38tkv",
  user4: "8y2aclm4",
  user5: "jd2k09qh",
  user6: "v1mw8xg0",
  user7: "43sn9vmc",
  user8: "e71r2wpq",
  user9: "wvjxy1zn",
  user10: "zhc28qrx",
  user11: "9kafj4mc",
  user12: "u8cx92rw",
  user13: "rm1txe57",
  user14: "b5gwzm41",
  user15: "70qnayhc",
  user16: "hxv9e30b",
  user17: "1vfx8qrk",
  user18: "dz48mwy1",
  user19: "4seu7bxp",
  user20: "tcgw9e3m",
};

// Function to generate random 8-character passcode
const generateRandomPasscode = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export default function Login({ onLogin }) {
  const [mode, setMode] = useState("login"); // "login" or "register"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // Registration states
  const [email, setEmail] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [generatedPasscode, setGeneratedPasscode] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  
  // Dynamic users (backup localStorage)
  const [dynamicUsers, setDynamicUsers] = useState({});
  const [googleSheetsStatus, setGoogleSheetsStatus] = useState("unknown"); // "working", "failed", "unknown"

  // Load registered users from localStorage on component mount (backup)
  useEffect(() => {
    const stored = localStorage.getItem('registeredUsers');
    if (stored) {
      try {
        const users = JSON.parse(stored);
        console.log("🔍 Loaded users from localStorage:", users);
        setDynamicUsers(users);
      } catch (e) {
        console.error("Error loading registered users:", e);
      }
    }
  }, []);

  // Save registered users to localStorage (backup)
  const saveRegisteredUsers = (users) => {
    localStorage.setItem('registeredUsers', JSON.stringify(users));
    setDynamicUsers(users);
    console.log("💾 Saved users to localStorage:", users);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    
    console.log("🔍 Attempting login with username:", username);
    
    // Step 1: Check hard-coded users first (fastest)
    if (USERS[username] && USERS[username] === password) {
      console.log("✅ Login successful with hard-coded user");
      setError("");
      onLogin(username);
      return;
    }
    
    // Step 2: Check localStorage registered users (fast backup)
    if (dynamicUsers[username] && dynamicUsers[username].passcode === password) {
      console.log("✅ Login successful with localStorage user");
      setError("");
      onLogin(username);
      return;
    }
    
    // Step 3: Check Google Sheets for registered users (if backend configured)
    try {
      console.log("🔍 Checking Google Sheets for user credentials...");
      
      const LOGIN_CHECK_URL =
        window.location.hostname === "localhost"
          ? "http://localhost:8090/checkUser"
          : "https://journal-whisper.onrender.com/checkUser";

      const response = await fetch(LOGIN_CHECK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username,
          passcode: password
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          console.log("✅ Login successful with Google Sheets user");
          setGoogleSheetsStatus("working");
          setError("");
          onLogin(username);
          return;
        } else {
          console.log("❌ Invalid credentials in Google Sheets");
          setGoogleSheetsStatus("working");
        }
      } else {
        console.log("⚠️ Google Sheets backend error:", response.status);
        setGoogleSheetsStatus("failed");
      }
      
    } catch (error) {
      console.log("⚠️ Backend login check failed:", error.message);
      setGoogleSheetsStatus("failed");
    }
    
    setError("Invalid username or password");
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Basic validation
    if (!email) {
      setError("Email is required");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    // Check if email already exists in localStorage users
    const existingUser = Object.keys(dynamicUsers).find(user => 
      dynamicUsers[user].email === email
    );
    if (existingUser) {
      setError("Email already registered in local storage");
      return;
    }

    setIsRegistering(true);

    try {
      // Generate random username and passcode
      const timestamp = Date.now().toString().slice(-4);
      const randomPrefix = Math.random().toString(36).substring(2, 6);
      const newUsername = `user_${randomPrefix}${timestamp}`;
      const newPasscode = generateRandomPasscode();

      console.log("🎯 Generated credentials:", { username: newUsername, passcode: newPasscode });

      // Try to save to Google Sheets backend first (primary storage)
      let backendSuccess = false;
      let backendError = null;
      
      try {
        const REGISTER_API_URL =
          window.location.hostname === "localhost"
            ? "http://localhost:8090/register"
            : "https://journal-whisper.onrender.com/register";

        console.log("📤 Sending registration to Google Sheets...");

        const response = await fetch(REGISTER_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: newUsername,
            password: newPasscode,
            email: email,
            fullName: email,
            registrationDate: new Date().toISOString(),
          }),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            console.log("✅ User saved to Google Sheets successfully");
            setGoogleSheetsStatus("working");
            backendSuccess = true;
          } else {
            console.log("❌ Google Sheets registration failed:", result.error);
            backendError = result.error;
            setGoogleSheetsStatus("working");
            
            // Check for duplicate errors from backend
            if (result.error.includes("already exists") || result.error.includes("already registered")) {
              setError(result.error);
              return;
            }
          }
        } else {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          console.log("❌ Backend registration failed with status:", response.status);
          backendError = errorData.error || `Server error: ${response.status}`;
          setGoogleSheetsStatus("failed");
        }
      } catch (backendError) {
        console.log("⚠️ Backend not available for registration:", backendError.message);
        setGoogleSheetsStatus("failed");
        backendError = "Backend service unavailable";
      }

      // Always save to localStorage as backup (even if backend succeeded)
      const updatedUsers = {
        ...dynamicUsers,
        [newUsername]: {
          passcode: newPasscode,
          email: email,
          registrationDate: new Date().toISOString()
        }
      };
      
      saveRegisteredUsers(updatedUsers);

      // Update state for display
      setGeneratedPasscode(newPasscode);
      setUsername(newUsername);
      setShowPasscode(true);
      
      // Show appropriate success message
      let storageMethod;
      if (backendSuccess) {
        storageMethod = "Google Sheets and localStorage backup";
      } else {
        storageMethod = `localStorage only (${backendError || "backend unavailable"})`;
      }
      
      setSuccess(`Registration successful! Saved to ${storageMethod}.`);
      setEmail("");

      console.log("✅ Registration completed successfully");

    } catch (error) {
      console.error("Registration error:", error);
      setError("Registration failed: " + error.message);
    } finally {
      setIsRegistering(false);
    }
  };

  const switchMode = () => {
    setMode(mode === "login" ? "register" : "login");
    setError("");
    setSuccess("");
    setUsername("");
    setPassword("");
    setEmail("");
    setGeneratedPasscode("");
    setShowPasscode(false);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert("Copied to clipboard!");
    }).catch(() => {
      alert("Please manually copy the text");
    });
  };

  // Get status indicator for Google Sheets
  const getBackendStatusIndicator = () => {
    switch(googleSheetsStatus) {
      case "working":
        return "🟢 Google Sheets Connected";
      case "failed":
        return "🟡 Using Local Storage Only";
      default:
        return "⚪ Backend Status Unknown";
    }
  };

  return (
    <div
      style={{
        maxWidth: 420,
        margin: "3rem auto",
        padding: "2rem",
        fontFamily: "sans-serif",
        backgroundColor: "#fff",
        borderRadius: "12px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
      }}
    >
      <h2 style={{ textAlign: "center", marginBottom: "2rem", color: "#333" }}>
        {mode === "login" ? "🔐 Journal Login" : "📝 Create New Account"}
      </h2>

      {/* Backend Status Indicator */}
      {googleSheetsStatus !== "unknown" && (
        <div style={{
          textAlign: "center",
          fontSize: "0.8rem",
          marginBottom: "1rem",
          padding: "0.5rem",
          backgroundColor: googleSheetsStatus === "working" ? "#e8f5e8" : "#fff3cd",
          borderRadius: "4px",
          border: `1px solid ${googleSheetsStatus === "working" ? "#c8e6c9" : "#ffeaa7"}`
        }}>
          {getBackendStatusIndicator()}
        </div>
      )}

      {mode === "login" ? (
        // LOGIN FORM
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>
              Username:
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "6px",
                border: "1px solid #ddd",
                fontSize: "1rem",
                boxSizing: "border-box",
              }}
              placeholder="Enter your username"
            />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>
              Password/Passcode:
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "6px",
                border: "1px solid #ddd",
                fontSize: "1rem",
                boxSizing: "border-box",
              }}
              placeholder="Enter your password/passcode"
            />
          </div>

          <button
            type="submit"
            style={{
              width: "100%",
              padding: "0.75rem",
              backgroundColor: "#4CAF50",
              color: "white",
              border: "none",
              fontSize: "1rem",
              cursor: "pointer",
              borderRadius: "6px",
              fontWeight: "bold",
              marginBottom: "1rem",
            }}
          >
            Login
          </button>
        </form>
      ) : (
        // REGISTRATION FORM
        <form onSubmit={handleRegister}>
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>
              Email Address:
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "6px",
                border: "1px solid #ddd",
                fontSize: "1rem",
                boxSizing: "border-box",
              }}
              placeholder="Enter your email address"
            />
            <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.3rem" }}>
              We'll generate a username and passcode for you
            </div>
          </div>

          <button
            type="submit"
            disabled={isRegistering}
            style={{
              width: "100%",
              padding: "0.75rem",
              backgroundColor: isRegistering ? "#cccccc" : "#2196f3",
              color: "white",
              border: "none",
              fontSize: "1rem",
              cursor: isRegistering ? "not-allowed" : "pointer",
              borderRadius: "6px",
              fontWeight: "bold",
              marginBottom: "1rem",
            }}
          >
            {isRegistering ? "Creating Account..." : "Create Account"}
          </button>
        </form>
      )}

      {/* Generated Credentials Display */}
      {showPasscode && generatedPasscode && (
        <div style={{
          backgroundColor: "#e8f5e8",
          border: "2px solid #4CAF50",
          borderRadius: "8px",
          padding: "1.5rem",
          marginBottom: "1rem",
        }}>
          <h3 style={{ margin: "0 0 1rem 0", color: "#2e7d32", textAlign: "center" }}>
            🎉 Account Created Successfully!
          </h3>
          
          <div style={{ marginBottom: "1rem" }}>
            <strong>Username:</strong>
            <div style={{ 
              backgroundColor: "white", 
              padding: "0.5rem", 
              borderRadius: "4px", 
              fontFamily: "monospace",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "0.3rem"
            }}>
              <span>{username}</span>
              <button 
                onClick={() => copyToClipboard(username)}
                style={{
                  background: "none",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  padding: "0.2rem 0.5rem",
                  cursor: "pointer",
                  fontSize: "0.8rem"
                }}
              >
                Copy
              </button>
            </div>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <strong>Passcode:</strong>
            <div style={{ 
              backgroundColor: "white", 
              padding: "0.5rem", 
              borderRadius: "4px", 
              fontFamily: "monospace",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "0.3rem"
            }}>
              <span style={{ fontSize: "1.1rem", fontWeight: "bold" }}>{generatedPasscode}</span>
              <button 
                onClick={() => copyToClipboard(generatedPasscode)}
                style={{
                  background: "none",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  padding: "0.2rem 0.5rem",
                  cursor: "pointer",
                  fontSize: "0.8rem"
                }}
              >
                Copy
              </button>
            </div>
          </div>

          <div style={{ 
            fontSize: "0.85rem", 
            color: "#d32f2f", 
            backgroundColor: "#ffebee",
            padding: "0.75rem",
            borderRadius: "4px",
            border: "1px solid #ffcdd2",
            textAlign: "center"
          }}>
            ⚠️ <strong>IMPORTANT:</strong> Save your username and passcode now! 
            <br/>You'll need them to login to your journal.
          </div>

          <button
            onClick={() => {
              setMode("login");
              setShowPasscode(false);
              setPassword("");
            }}
            style={{
              width: "100%",
              padding: "0.75rem",
              backgroundColor: "#4CAF50",
              color: "white",
              border: "none",
              fontSize: "1rem",
              cursor: "pointer",
              borderRadius: "6px",
              fontWeight: "bold",
              marginTop: "1rem",
            }}
          >
            Continue to Login
          </button>
        </div>
      )}

      {/* Error and Success Messages */}
      {error && (
        <div style={{ 
          color: "#d32f2f", 
          marginBottom: "1rem", 
          textAlign: "center",
          backgroundColor: "#ffebee",
          padding: "0.75rem",
          borderRadius: "6px",
          border: "1px solid #ffcdd2"
        }}>
          ⚠️ {error}
        </div>
      )}

      {success && !showPasscode && (
        <div style={{ 
          color: "#2e7d32", 
          marginBottom: "1rem", 
          textAlign: "center",
          backgroundColor: "#e8f5e8",
          padding: "0.75rem",
          borderRadius: "6px",
          border: "1px solid #c8e6c9"
        }}>
          ✅ {success}
        </div>
      )}

      {/* Mode Switch Button */}
      {!showPasscode && (
        <div style={{ textAlign: "center", marginTop: "1rem" }}>
          <button
            onClick={switchMode}
            style={{
              background: "none",
              border: "none",
              color: "#2196f3",
              cursor: "pointer",
              textDecoration: "underline",
              fontSize: "0.9rem",
            }}
          >
            {mode === "login" 
              ? "New user? Create account with email" 
              : "Have an account? Login here"}
          </button>
        </div>
      )}

      {/* Enhanced Debug Info */}
      <div style={{
        marginTop: "2rem",
        padding: "1rem",
        backgroundColor: "#f0f0f0",
        borderRadius: "6px",
        fontSize: "0.8rem",
        color: "#666"
      }}>
        <div style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>
          🔍 System Status:
        </div>
        <div>
          Hard-coded users: {Object.keys(USERS).length}<br/>
          Local registered users: {Object.keys(dynamicUsers).length}<br/>
          Backend status: {getBackendStatusIndicator()}<br/>
          {Object.keys(dynamicUsers).length > 0 && (
            <div>Last registered: {Object.keys(dynamicUsers)[Object.keys(dynamicUsers).length - 1]}</div>
          )}
        </div>
      </div>

      {/* Login Method Info */}
      <div style={{
        marginTop: "1rem",
        padding: "1rem",
        backgroundColor: "#f5f5f5",
        borderRadius: "6px",
        fontSize: "0.85rem",
        color: "#666"
      }}>
        <div style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>
          🔐 Login Methods:
        </div>
        <div>
          1. <strong>Hard-coded users</strong> (user1-user20)<br/>
          2. <strong>Local registered users</strong> (this browser only)<br/>
          3. <strong>Google Sheets users</strong> (accessible anywhere)
          {googleSheetsStatus === "failed" && (
            <div style={{ color: "#d32f2f", marginTop: "0.5rem" }}>
              ⚠️ Google Sheets backend not available - using local storage only
            </div>
          )}
        </div>
      </div>
    </div>
  );
}