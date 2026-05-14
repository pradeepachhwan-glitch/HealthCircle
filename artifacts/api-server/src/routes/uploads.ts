import express, { Router } from "express";
import { requireAuth } from "../lib/auth";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const router = Router();

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED_PREFIXES = ["image/", "application/pdf"];
const uploadJson = express.json({ limit: "8mb" });

interface UploadBody {
  dataUrl?: string;
  name?: string;
}

const UPLOADS_DIR = join(process.cwd(), "uploads");

router.post("/uploads/save", requireAuth, uploadJson, async (req, res) => {
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

  // Professionalization: Save to persistent disk
  const extension = mime.split("/")[1]?.split("+")[0] || "bin";
  const filename = `${randomUUID()}.${extension}`;
  const filePath = join(UPLOADS_DIR, filename);

  try {
    await writeFile(filePath, Buffer.from(b64, "base64"));
    res.json({
      url: `/uploads/${filename}`,
      type: mime,
      name: body.name ?? filename,
      sizeBytes,
    });
  } catch (error) {
    console.error("Upload failed:", error);
    res.status(500).json({ error: "Failed to save file" });
  }
});

// Legacy shim for existing clients (can be removed once frontend is updated)
router.post("/uploads/inline", requireAuth, uploadJson, async (req, res) => {
  const body = req.body as UploadBody;
  if (!body?.dataUrl) { res.status(400).json({ error: "dataUrl is required" }); return; }
  res.json({ url: body.dataUrl, type: "image/png", name: "inline", sizeBytes: 0 });
});

export default router;
