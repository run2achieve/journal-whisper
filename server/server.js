const express = require("express");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const nodemailer = require("nodemailer"); // NEW: Added for email functionality
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const FormData = require("form-data");

// Load environment variables only in development
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config({ path: './apikey.env' }); // Updated to use your existing env file
}

const app = express();
const PORT = process.env.PORT || 8090;

// Constants
// EXISTING: Google Apps Script URL for JOURNAL ENTRIES (your original sheet)
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyu5woIzLeOyYlRAlaLl7ntxUDwfVtcbUq716Ywm5sFldapAY-JbXZMSdO_2OHdvq3a/exec";

// NEW: Google Apps Script URL for USER REGISTRATION (your new users sheet)
// TODO: Replace this with your NEW Google Apps Script URL for the users database
const USERS_GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzwTCyIVJDhg6Gu6UPxQ3AZqhRGzvwurbcZ9siRAlHLU_uoGVablBN2LN2FjPjRGDCB/exec";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Validate required environment variables
if (!OPENAI_API_KEY) {
  console.error("❌ Missing OPENAI_API_KEY! Please set it in your environment variables.");
  process.exit(1);
}

// NEW: Email configuration validation
if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
  console.log("📧 Email system configured with Gmail:", process.env.GMAIL_USER);
} else {
  console.log("⚠️ Email system not configured. Add GMAIL_USER and GMAIL_APP_PASSWORD to apikey.env");
}

// Configure CORS options
const corsOptions = {
  origin:
    process.env.NODE_ENV === "production"
      ? "https://journal-whisper.onrender.com" // <-- Update to your deployed frontend domain (no trailing slash)
      : "http://localhost:3000",               // React dev server default port
  optionsSuccessStatus: 200,  // For legacy browser support
};

app.use(cors(corsOptions));
app.use(express.json());

// Serve React build files
app.use(express.static(path.join(__dirname, "../build")));

// ========================================
// NEW: EMAIL SYSTEM FUNCTIONS
// ========================================

// Gmail transporter setup
const createGmailTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });
};

// Email templates
const getUsernameEmailHTML = (username) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { text-align: center; margin-bottom: 30px; }
    .title { color: #4CAF50; margin: 0; }
    .credential-box { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4CAF50; }
    .credential-label { font-weight: bold; color: #333; margin-bottom: 10px; }
    .credential-value { font-family: 'Courier New', monospace; font-size: 18px; color: #2c3e50; background-color: white; padding: 10px; border-radius: 4px; border: 1px solid #ddd; }
    .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">🔐 Welcome to Journal App!</h1>
    </div>
    
    <p>Your account has been created successfully. Here is your login username:</p>
    
    <div class="credential-box">
      <div class="credential-label">Your Username:</div>
      <div class="credential-value">${username}</div>
    </div>
    
    <div class="warning">
      <strong>⚠️ Important Security Notice:</strong><br>
      Your password will be sent in a separate email within the next minute for security reasons. Please check your inbox shortly.
    </div>
    
    <p>Keep this information safe and secure. You'll need both your username and password to access your journal.</p>
    
    <div class="footer">
      This is an automated message from Journal App. Please do not reply to this email.
    </div>
  </div>
</body>
</html>
`;

const getPasswordEmailHTML = (password) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { text-align: center; margin-bottom: 30px; }
    .title { color: #2196F3; margin: 0; }
    .credential-box { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196F3; }
    .credential-label { font-weight: bold; color: #333; margin-bottom: 10px; }
    .credential-value { font-family: 'Courier New', monospace; font-size: 18px; color: #2c3e50; background-color: white; padding: 10px; border-radius: 4px; border: 1px solid #ddd; }
    .security-note { background-color: #e3f2fd; border: 1px solid #bbdefb; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">🔑 Your Journal App Password</h1>
    </div>
    
    <p>Here is your password for accessing the Journal App:</p>
    
    <div class="credential-box">
      <div class="credential-label">Your Password:</div>
      <div class="credential-value">${password}</div>
    </div>
    
    <div class="security-note">
      <strong>🔒 Security Information:</strong><br>
      • This password was sent separately from your username for security<br>
      • Store this information securely<br>
      • Never share your credentials with anyone<br>
      • Consider saving this in a password manager
    </div>
    
    <p>You now have both your username and password. You can login to your journal at any time.</p>
    
    <div class="footer">
      This is an automated message from Journal App. Please do not reply to this email.
    </div>
  </div>
</body>
</html>
`;

// Email sending functions
const sendUsernameEmail = async (email, username) => {
  const transporter = createGmailTransporter();
  
  const mailOptions = {
    from: {
      name: 'Journal App',
      address: process.env.GMAIL_USER
    },
    to: email,
    subject: '🔐 Your Journal App Username',
    html: getUsernameEmailHTML(username)
  };

  try {
    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Username email sent successfully to:', email);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('❌ Failed to send username email:', error);
    throw error;
  }
};

const sendPasswordEmail = async (email, password) => {
  const transporter = createGmailTransporter();
  
  const mailOptions = {
    from: {
      name: 'Journal App',
      address: process.env.GMAIL_USER
    },
    to: email,
    subject: '🔑 Your Journal App Password',
    html: getPasswordEmailHTML(password)
  };

  try {
    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Password email sent successfully to:', email);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('❌ Failed to send password email:', error);
    throw error;
  }
};

// Health check endpoint
app.get("/health", (req, res) => {
  res.send(`✅ Proxy server running on port ${PORT}`);
});

// Multer setup for handling file uploads (in-memory)
const upload = multer({ storage: multer.memoryStorage() });

// Whisper API endpoint to transcribe audio
app.post("/transcribeAudio", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file uploaded" });
    }

    const formData = new FormData();
    formData.append("file", req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });
    formData.append("model", "whisper-1");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error: ${response.statusText} — ${errText}`);
    }

    const data = await response.json();
    res.json({ transcription: data.text });
  } catch (error) {
    console.error("Error in /transcribeAudio:", error);
    res.status(500).json({ error: error.message });
  }
});

// EXISTING: Endpoint to save journal entry to Google Sheets (JOURNAL ENTRIES SHEET)
app.post("/saveEntry", async (req, res) => {
  try {
    const { date, time, entry, user } = req.body;

    if (!date || !time || !entry || !user) {
      return res.status(400).json({ error: "Missing date, time, entry, or user in request body." });
    }

    console.log(`📝 Saving journal entry for user: ${user}`);

    // Send to JOURNAL ENTRIES Google Apps Script
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, time, entry, user }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google Sheets API error:", errorText);
      return res.status(500).json({ error: "Failed to save entry to Google Sheets." });
    }

    const resultText = await response.text();

    try {
      const resultJson = JSON.parse(resultText);
      res.json(resultJson);
    } catch {
      res.json({ message: resultText });
    }
  } catch (error) {
    console.error("Error in /saveEntry:", error);
    res.status(500).json({ error: error.message });
  }
});

// EXISTING: Endpoint to get entries from Google Sheets by user and date (JOURNAL ENTRIES SHEET)
app.post("/getEntries", async (req, res) => {
  try {
    const { user, date } = req.body;

    if (!user || !date) {
      return res.status(400).json({ error: "Missing user or date in request body." });
    }

    console.log(`📖 Getting entries for user: ${user}, date: ${date}`);

    // Send a request to the JOURNAL ENTRIES Google Script
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, date, action: "getEntries" }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google Sheets API error:", errorText);
      return res.status(500).json({ error: "Failed to fetch entries from Google Sheets." });
    }

    const data = await response.json();
    // Assuming Google Script returns entries array in 'entries' key
    res.json({ entries: data.entries || [] });
  } catch (error) {
    console.error("Error in /getEntries:", error);
    res.status(500).json({ error: error.message });
  }
});

// EXISTING: Endpoint to generate daily summary with ChatGPT (JOURNAL ENTRIES SHEET)
app.post("/generateSummary", async (req, res) => {
  try {
    const { user, date } = req.body;

    if (!user || !date) {
      return res.status(400).json({ error: "Missing user or date in request body." });
    }

    console.log(`📝 Generating summary for user: ${user}, date: ${date}`);

    // Step 1: Check if summary already exists in Daily Summaries sheet (JOURNAL ENTRIES SHEET)
    try {
      const existingSummaryResponse = await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, date, action: "getSummary" }),
      });

      if (existingSummaryResponse.ok) {
        const existingSummaryData = await existingSummaryResponse.json();
        if (existingSummaryData.summary) {
          console.log(`✅ Found existing summary for ${user} on ${date}`);
          return res.json({
            summary: existingSummaryData.summary,
            generatedAt: existingSummaryData.generatedAt,
            isExisting: true
          });
        }
      }
    } catch (error) {
      console.log("⚠️ No existing summary found or error checking, will generate new one");
    }

    // Step 2: Fetch all entries for the date (JOURNAL ENTRIES SHEET)
    const entriesResponse = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, date, action: "getEntries" }),
    });

    if (!entriesResponse.ok) {
      throw new Error("Failed to fetch entries from Google Sheets");
    }

    const entriesData = await entriesResponse.json();
    const entries = entriesData.entries || [];

    if (entries.length === 0) {
      return res.status(404).json({ error: "No journal entries found for this date" });
    }

    console.log(`📖 Found ${entries.length} entries for ${date}`);

    // Step 3: Prepare entries text for ChatGPT
    const entriesText = entries
      .map((entry, index) => `Entry ${index + 1} (${entry.time}):\n${entry.entry}`)
      .join("\n\n");

    // Step 4: Generate summary using ChatGPT
    const chatGPTPrompt = `Please analyze and summarize the following journal entries from ${date}. Provide a thoughtful summary that captures:

- Main themes and topics discussed
- Emotional tone and overall mood
- Key events, activities, or experiences
- Any insights, reflections, or personal growth moments
- Overall essence of the day

Please write the summary in 2-3 well-structured paragraphs that feel personal and meaningful.

Journal entries:
${entriesText}`;

    console.log("🤖 Sending request to ChatGPT...");

    const chatGPTResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a thoughtful journal assistant that creates meaningful, personal summaries of daily journal entries. Focus on capturing the essence and emotional journey of the day."
          },
          {
            role: "user",
            content: chatGPTPrompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!chatGPTResponse.ok) {
      const errorText = await chatGPTResponse.text();
      throw new Error(`ChatGPT API error: ${chatGPTResponse.statusText} — ${errorText}`);
    }

    const chatGPTData = await chatGPTResponse.json();
    const summary = chatGPTData.choices[0].message.content.trim();

    console.log("✅ Summary generated successfully");

    // Step 5: Save summary to Daily Summaries sheet (JOURNAL ENTRIES SHEET)
    const generatedAt = new Date().toISOString();
    
    try {
      const saveSummaryResponse = await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user,
          date,
          summary,
          generatedAt,
          action: "saveSummary"
        }),
      });

      if (!saveSummaryResponse.ok) {
        console.error("⚠️ Failed to save summary to Google Sheets, but returning summary anyway");
      } else {
        console.log("✅ Summary saved to Google Sheets");
      }
    } catch (saveError) {
      console.error("⚠️ Error saving summary to Google Sheets:", saveError);
      // Continue anyway, we'll still return the generated summary
    }

    // Step 6: Return the generated summary
    res.json({
      summary,
      generatedAt,
      isExisting: false,
      entriesCount: entries.length
    });

  } catch (error) {
    console.error("❌ Error in /generateSummary:", error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// USER REGISTRATION ENDPOINTS
// These endpoints work with the USERS DATABASE SHEET (separate from journal entries)
// ========================================

// Registration endpoint - saves to Google Sheets USERS DATABASE
app.post("/register", async (req, res) => {
  try {
    console.log("📝 User registration request received:", req.body.username);
    
    const { username, password, email, registrationDate } = req.body;
    
    // Validate required fields
    if (!username || !password || !email) {
      return res.status(400).json({ 
        error: "Username, password, and email are required" 
      });
    }

    // Check if users Google Apps Script URL is configured
    if (USERS_GOOGLE_SCRIPT_URL === "YOUR_NEW_GOOGLE_APPS_SCRIPT_URL_FOR_USERS_SHEET") {
      return res.status(500).json({
        error: "Users database not configured. Please set up the USERS_GOOGLE_SCRIPT_URL."
      });
    }
    
    // Prepare data for USERS Google Sheets
    const registrationData = {
      username,
      password, // This is the generated passcode
      email,
      registrationDate: registrationDate || new Date().toISOString()
    };

    console.log("📤 Sending registration data to USERS Google Sheet...");

    // Send to USERS DATABASE Google Apps Script (separate from journal entries)
    const response = await fetch(USERS_GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "register",
        data: registrationData
      }),
    });

    const responseText = await response.text();
    console.log("📥 Users Google Apps Script registration response:", responseText);

    if (!response.ok) {
      console.error("❌ Users Google Apps Script error:", response.status, responseText);
      throw new Error(`Users Google Apps Script error: ${response.status}`);
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error("❌ Failed to parse registration response:", parseError);
      throw new Error("Invalid response from registration service");
    }

    if (result.success) {
      console.log("✅ User registered successfully in USERS database:", username);
      
      res.json({
        success: true,
        message: "User registered successfully",
        username: username
      });
    } else {
      console.error("❌ Registration failed:", result.error);
      res.status(400).json({
        error: result.error || "Registration failed"
      });
    }

  } catch (error) {
    console.error("❌ Registration error:", error);
    res.status(500).json({
      error: "Registration failed: " + error.message
    });
  }
});

// User login check endpoint - checks Google Sheets USERS DATABASE
app.post("/checkUser", async (req, res) => {
  try {
    console.log("🔍 Checking user credentials for:", req.body.username);
    
    const { username, passcode } = req.body;
    
    if (!username || !passcode) {
      return res.status(400).json({ 
        success: false,
        error: "Username and passcode are required" 
      });
    }

    // Check if users Google Apps Script URL is configured
    if (USERS_GOOGLE_SCRIPT_URL === "YOUR_NEW_GOOGLE_APPS_SCRIPT_URL_FOR_USERS_SHEET") {
      return res.status(500).json({
        success: false,
        error: "Users database not configured. Please set up the USERS_GOOGLE_SCRIPT_URL."
      });
    }

    console.log("📤 Sending credential check to USERS Google Sheet...");

    // Call USERS DATABASE Google Apps Script to check user credentials
    const response = await fetch(USERS_GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "checkUser",
        username: username,
        passcode: passcode
      }),
    });

    const responseText = await response.text();
    console.log("📥 Users Google Apps Script user check response:", responseText);

    if (!response.ok) {
      console.error("❌ Users Google Apps Script error:", response.status, responseText);
      return res.status(500).json({
        success: false,
        error: "User verification service unavailable"
      });
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error("❌ Failed to parse user check response:", parseError);
      return res.status(500).json({
        success: false,
        error: "Invalid response from user verification service"
      });
    }

    if (result.success) {
      console.log("✅ User credentials verified in USERS database:", username);
      res.json({
        success: true,
        user: result.user
      });
    } else {
      console.log("❌ Invalid credentials for:", username);
      res.status(401).json({
        success: false,
        error: "Invalid credentials"
      });
    }

  } catch (error) {
    console.error("❌ User check error:", error);
    res.status(500).json({
      success: false,
      error: "User verification failed: " + error.message
    });
  }
});

// ========================================
// NEW: EMAIL ENDPOINTS
// ========================================

// API endpoint to send credentials
app.post('/send-credentials', async (req, res) => {
  const { email, username, password } = req.body;
  
  // Check if email system is configured
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return res.status(500).json({ 
      success: false, 
      error: 'Email system not configured. Please add GMAIL_USER and GMAIL_APP_PASSWORD to apikey.env' 
    });
  }
  
  // Validation
  if (!email || !username || !password) {
    return res.status(400).json({ 
      success: false, 
      error: 'Email, username, and password are required' 
    });
  }

  try {
    console.log(`📧 Sending credentials to: ${email}`);
    
    // Send username email first
    const usernameResult = await sendUsernameEmail(email, username);
    
    // Schedule password email to be sent after 30 seconds
    setTimeout(async () => {
      try {
        await sendPasswordEmail(email, password);
      } catch (error) {
        console.error('❌ Failed to send delayed password email:', error);
      }
    }, 30000); // 30 seconds delay
    
    res.json({ 
      success: true, 
      message: 'Username email sent successfully. Password email will be sent in 30 seconds.',
      usernameMessageId: usernameResult.messageId
    });
    
  } catch (error) {
    console.error('❌ Failed to send emails:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send username email: ' + error.message 
    });
  }
});

// API endpoint to send bulk credentials to all registered users
app.post('/send-bulk-credentials', async (req, res) => {
  const { users } = req.body; // Array of {email, username, password} objects
  
  // Check if email system is configured
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return res.status(500).json({ 
      success: false, 
      error: 'Email system not configured. Please add GMAIL_USER and GMAIL_APP_PASSWORD to apikey.env' 
    });
  }
  
  if (!users || !Array.isArray(users)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Users array is required' 
    });
  }

  const results = [];
  
  try {
    for (let i = 0; i < users.length; i++) {
      const { email, username, password } = users[i];
      
      try {
        console.log(`📧 Sending credentials ${i + 1}/${users.length} to: ${email}`);
        
        // Send username email
        await sendUsernameEmail(email, username);
        
        // Schedule password email
        setTimeout(async () => {
          try {
            await sendPasswordEmail(email, password);
          } catch (error) {
            console.error(`❌ Failed to send password email to ${email}:`, error);
          }
        }, 30000 + (i * 5000)); // Stagger password emails
        
        results.push({
          email,
          username,
          success: true
        });
        
        // Wait 10 seconds between users to avoid rate limiting
        if (i < users.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
        
      } catch (error) {
        console.error(`❌ Failed to send email to ${email}:`, error);
        results.push({
          email,
          username,
          success: false,
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      message: `Processed ${users.length} users`,
      results
    });
    
  } catch (error) {
    console.error('❌ Bulk email sending failed:', error);
    res.status(500).json({
      success: false,
      error: 'Bulk email sending failed: ' + error.message,
      results
    });
  }
});

// Test endpoint to verify email configuration
app.post('/test-email', async (req, res) => {
  // Check if email system is configured
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return res.status(500).json({ 
      success: false, 
      error: 'Email system not configured. Please add GMAIL_USER and GMAIL_APP_PASSWORD to apikey.env' 
    });
  }
  
  try {
    const transporter = createGmailTransporter();
    
    // Verify connection
    await transporter.verify();
    
    res.json({ 
      success: true, 
      message: 'Email configuration is working!' 
    });
    
  } catch (error) {
    console.error('❌ Email configuration test failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Email configuration failed: ' + error.message 
    });
  }
});

// Catch-all handler to serve React app for all other routes (supports React Router)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../build/index.html"));
});

// Start server and listen on specified port
app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT} (env: ${process.env.NODE_ENV})`);
  console.log(`📊 Journal entries: Using existing Google Sheet`);
  console.log(`👥 User registration: Using ${USERS_GOOGLE_SCRIPT_URL === "YOUR_NEW_GOOGLE_APPS_SCRIPT_URL_FOR_USERS_SHEET" ? "NOT CONFIGURED" : "configured"} Users Google Sheet`);
  console.log(`📧 Email system: ${process.env.GMAIL_USER ? `Configured with ${process.env.GMAIL_USER}` : "NOT CONFIGURED"}`);
}).on("error", (err) => {
  console.error("Failed to start server:", err);
});