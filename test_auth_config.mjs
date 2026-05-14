import app from "./artifacts/api-server/src/app";
import request from "supertest";

async function testConfig() {
  process.env.GOOGLE_CLIENT_ID = "test-google-id";
  process.env.EMAIL_AUTH_ENABLED = "true";
  
  const res = await request(app).get("/api/auth/config");
  console.log("Config (enabled):", res.body);

  process.env.EMAIL_AUTH_ENABLED = "false";
  const res2 = await request(app).get("/api/auth/config");
  console.log("Config (disabled):", res2.body);

  delete process.env.EMAIL_AUTH_ENABLED;
  const res3 = await request(app).get("/api/auth/config");
  console.log("Config (missing env - should default to true):", res3.body);
}

testConfig().catch(console.error);
