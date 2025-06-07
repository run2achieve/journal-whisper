// debug-env.js - Debug environment variable loading
const fs = require('fs');
const path = require('path');

console.log('🔍 Debugging environment variable loading...\n');

// Check current directory
console.log('📁 Current directory:', __dirname);
console.log('📂 Files in directory:');
const files = fs.readdirSync(__dirname);
files.forEach(file => {
  if (file.includes('env')) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   📄 ${file}`);
  }
});

// Check if apienv.env exists
const envPath = path.join(__dirname, 'apienv.env');
console.log('\n🔍 Checking apienv.env file...');
console.log('📍 Looking for file at:', envPath);

if (fs.existsSync(envPath)) {
  console.log('✅ apienv.env file found!');
  
  // Read file content
  const content = fs.readFileSync(envPath, 'utf8');
  console.log('\n📄 File content:');
  console.log('---START---');
  console.log(content);
  console.log('---END---');
  
  // Check for Gmail variables in file
  const hasGmailUser = content.includes('GMAIL_USER');
  const hasGmailPass = content.includes('GMAIL_APP_PASSWORD');
  
  console.log('\n🔍 Gmail variables in file:');
  console.log('   GMAIL_USER found:', hasGmailUser);
  console.log('   GMAIL_APP_PASSWORD found:', hasGmailPass);
  
} else {
  console.log('❌ apienv.env file NOT found!');
  console.log('💡 Please create apienv.env file in the server directory');
}

// Try loading with dotenv
console.log('\n🔄 Loading environment variables...');
try {
  require('dotenv').config({ path: envPath });
  
  console.log('✅ Dotenv loaded successfully');
  console.log('📧 GMAIL_USER:', process.env.GMAIL_USER || 'undefined');
  console.log('🔑 GMAIL_APP_PASSWORD:', process.env.GMAIL_APP_PASSWORD ? '✅ Found (hidden)' : '❌ Missing');
  
  // Show all environment variables that contain 'GMAIL'
  const gmailEnvVars = Object.keys(process.env).filter(key => key.includes('GMAIL'));
  console.log('🔍 All GMAIL environment variables:', gmailEnvVars);
  
} catch (error) {
  console.log('❌ Error loading dotenv:', error.message);
}

console.log('\n✨ Debug complete!');