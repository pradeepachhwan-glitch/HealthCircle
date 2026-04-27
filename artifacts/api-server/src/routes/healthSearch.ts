import { Router } from "express";
import { requireAuth, getOrCreateUser } from "../lib/auth";
import { runHealthSearch } from "../lib/searchEngine";
import { logger } from "../lib/logger";

const router = Router();

router.get("/health-search", requireAuth, async (req, res) => {
  const { q, language } = req.query;
  if (!q || typeof q !== "string") {
    res.status(400).json({ error: "Query parameter q is required" }); return;
  }

  try {
    const user = await getOrCreateUser(req);
    const result = await runHealthSearch(q, user?.id, typeof language === "string" ? language : "en");
    res.json(result);
  } catch (err) {
    logger.error({ err }, "Health search error");
    res.status(500).json({ error: "Search service unavailable" });
  }
});

export default router;
