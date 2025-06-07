// test-email.js - Run this to test your Gmail setup
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'apikey.env') });
const nodemailer = require('nodemailer');

const testEmailSetup = async () => {
  console.log('🧪 Testing Gmail configuration...');
  console.log('📧 Gmail User:', process.env.GMAIL_USER);
  console.log('🔑 App Password:', process.env.GMAIL_APP_PASSWORD ? '✅ Found' : '❌ Missing');

  // Create transporter (fixed function name)
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });

  try {
    // Test connection
    console.log('🔗 Testing connection...');
    await transporter.verify();
    console.log('✅ Connection successful!');

    // Send test email to yourself
    console.log('📤 Sending test email...');
    const testEmail = {
      from: {
        name: 'Journal App Test',
        address: process.env.GMAIL_USER
      },
      to: process.env.GMAIL_USER, // Send to yourself
      subject: '🧪 Test Email from Journal App',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #4CAF50;">✅ Email Configuration Test Successful!</h2>
          <p>If you're reading this, your Gmail app password is working correctly.</p>
          <div style="background-color: #f0f0f0; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <strong>Test Details:</strong><br>
            Gmail User: ${process.env.GMAIL_USER}<br>
            Timestamp: ${new Date().toISOString()}<br>
            Status: ✅ Working
          </div>
          <p>You can now proceed with setting up the full email system for your Journal App!</p>
        </div>
      `
    };

    const result = await transporter.sendMail(testEmail);
    console.log('✅ Test email sent successfully!');
    console.log('📧 Message ID:', result.messageId);
    console.log('🎉 Your Gmail setup is working perfectly!');
    
    return true;

  } catch (error) {
    console.error('❌ Email test failed:', error.message);
    
    // Provide specific error help
    if (error.message.includes('Invalid login')) {
      console.log('💡 Fix: Check your Gmail user and app password in .env file');
    } else if (error.message.includes('Less secure app')) {
      console.log('💡 Fix: Make sure you\'re using an App Password, not your regular Gmail password');
    } else if (error.message.includes('Authentication failed')) {
      console.log('💡 Fix: Generate a new App Password and update your .env file');
    }
    
    return false;
  }
};

// Run the test
testEmailSetup()
  .then((success) => {
    if (success) {
      console.log('\n🚀 Ready to proceed with full email setup!');
    } else {
      console.log('\n🔧 Please fix the issues above before proceeding.');
    }
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });