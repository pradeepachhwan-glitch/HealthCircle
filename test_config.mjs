import fetch from "node-fetch";

async function testConfig() {
  try {
    const res = await fetch("http://localhost:3001/api/auth/config");
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Data:", JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Failed to fetch config. Is the server running on 3001?", e.message);
  }
}

testConfig();
