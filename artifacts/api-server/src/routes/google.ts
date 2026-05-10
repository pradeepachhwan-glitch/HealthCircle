import { Router } from "express";
import { handleAuthCallback } from "../lib/googleCalendar";
import { logger } from "../lib/logger";

const router = Router();

router.get("/auth/callback/google", async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state) {
    res.status(400).send("Missing code or state");
    return;
  }

  try {
    const { userId } = JSON.parse(state as string);
    await handleAuthCallback(userId, code as string);
    
    // Redirect back to the app (doctor dashboard or profile)
    res.redirect("/profile?google=connected");
  } catch (err) {
    logger.error({ err }, "Google Auth Callback failed");
    res.status(500).send("Authentication failed. Please try again.");
  }
});

export default router;
