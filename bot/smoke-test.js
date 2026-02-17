const axios = require("axios");

const PORT = process.env.PORT || 3000;
const URL = `http://localhost:${PORT}/health`;
const TIMEOUT_MS = 30000;
const INTERVAL_MS = 1000;

console.log(`Starting smoke test against ${URL}...`);

const startTime = Date.now();

const checkHealth = async () => {
  try {
    const response = await axios.get(URL);
    if (response.status === 200 && response.data.status === "ok") {
      console.log("✅ Smoke test passed: Health endpoint is OK.");
      process.exit(0);
    } else {
      console.log(`⚠️  Health check returned ${response.status}:`, response.data);
    }
  } catch (error) {
    if (error.response) {
       console.log(`⚠️  Health check returned ${error.response.status}:`, error.response.data);
    } else {
       console.log(`⚠️  Connection failed: ${error.message}`);
    }
  }

  if (Date.now() - startTime > TIMEOUT_MS) {
    console.error("❌ Smoke test timed out.");
    process.exit(1);
  }

  setTimeout(checkHealth, INTERVAL_MS);
};

checkHealth();
