import { Router } from "express";
import { getAuth } from "../lib/auth";
import { requireAuth, getOrCreateUser } from "../lib/auth";
import { runHealthSearch } from "../lib/searchEngine";
import { logger } from "../lib/logger";

const router = Router();

router.get("/health-search", async (req, res) => {
  const { q, language, city, lat, lng } = req.query;
  if (!q || typeof q !== "string" || !q.trim()) {
    res.status(400).json({ error: "Query parameter q is required" }); return;
  }

  // Optional location signals — when present, the search engine will filter
  // DB providers by city and fall back to live OpenStreetMap nearby results
  // when our verified network has nothing in that city. This mirrors the
  // /providers page behavior so users never see unrelated dummy national rows.
  const latNum = typeof lat === "string" ? parseFloat(lat) : undefined;
  const lngNum = typeof lng === "string" ? parseFloat(lng) : undefined;
  const validCoords = Number.isFinite(latNum) && Number.isFinite(lngNum)
    ? { lat: latNum as number, lng: lngNum as number }
    : undefined;

  try {
    const { userId: clerkId } = getAuth(req);
    const user = clerkId ? await getOrCreateUser(clerkId) : null;
    const result = await runHealthSearch(q.trim(), user?.id, typeof language === "string" ? language : "en", {
      city: typeof city === "string" ? city : undefined,
      coords: validCoords,
    });
    res.json(result);
  } catch (err) {
    logger.error({ err }, "Health search error");
    res.status(500).json({ error: "Search service unavailable" });
  }
});

export default router;
