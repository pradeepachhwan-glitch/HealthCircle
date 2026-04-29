import express, { Router } from "express";
import { requireAuth } from "../lib/auth";

const router = Router();

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED_PREFIXES = ["image/", "application/pdf"];
// 4 MB raw bytes ≈ 5.4 MB base64 + JSON overhead. The global parser is the
// Express default (~100 KB) which would reject any real image before the
// validation below runs, so override it for this single route.
const uploadJson = express.json({ limit: "8mb" });

interface UploadBody {
  dataUrl?: string;
  name?: string;
}

// Order matters: requireAuth runs BEFORE the 8 MB JSON parser so an
// unauthenticated client can never force the server to parse a multi-MB body
// just to be rejected with 401 afterwards. requireAuth only inspects cookies
// and a small JSON body is not required to make the auth decision.
router.post("/uploads/inline", requireAuth, uploadJson, async (req, res) => {
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
