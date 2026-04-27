import { Router } from "express";
import { requireAuth } from "../lib/auth";

const router = Router();

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED_PREFIXES = ["image/", "application/pdf"];

interface UploadBody {
  dataUrl?: string;
  name?: string;
}

router.post("/uploads/inline", requireAuth, async (req, res) => {
  const body = req.body as UploadBody;
  if (!body?.dataUrl) {
    res.status(400).json({ error: "dataUrl is required" });
    return;
  }

  const match = body.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    res.status(400).json({ error: "Invalid data URL" });
    return;
  }
  const [, mime, b64] = match;
  if (!ALLOWED_PREFIXES.some((p) => mime.startsWith(p))) {
    res.status(400).json({ error: "Only images and PDFs are allowed" });
    return;
  }
  const sizeBytes = Math.ceil((b64.length * 3) / 4);
  if (sizeBytes > MAX_BYTES) {
    res.status(413).json({ error: "File too large. Maximum 4 MB." });
    return;
  }

  // Returning the same data URL — the client already has it; this endpoint validates.
  res.json({
    url: body.dataUrl,
    type: mime,
    name: body.name ?? "attachment",
    sizeBytes,
  });
});

export default router;
