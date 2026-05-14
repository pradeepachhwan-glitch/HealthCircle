
const keys = [
  "DATABASE_URL",
  "SESSION_SECRET",
  "ADMIN_TOKEN",
  "RESEND_API_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "AI_INTEGRATIONS_OPENAI_BASE_URL",
  "AI_INTEGRATIONS_OPENAI_API_KEY",
  "VITE_APP_URL",
  "NODE_ENV"
];

console.log("--- Runtime Secret Audit ---");
keys.forEach(key => {
  const value = process.env[key];
  if (value) {
    if (key.includes("SECRET") || key.includes("KEY") || key.includes("URL") || key.includes("TOKEN")) {
      console.log(`${key}: [PRESENT] (length: ${value.length})`);
    } else {
      console.log(`${key}: ${value}`);
    }
  } else {
    console.log(`${key}: [MISSING]`);
  }
});
console.log("----------------------------");
