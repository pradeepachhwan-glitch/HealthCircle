import { Router } from "express";
import { db } from "@workspace/db";
import { doctorsTable, hospitalsTable, providerRankingsTable } from "@workspace/db/schema";
import { eq, ilike, or, desc, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";
import { fetchLiveDoctors, fetchLiveHospitals } from "../lib/osmProviders";

const router = Router();

router.get("/doctors", requireAuth, async (req, res) => {
  const { specialty, location, available, q, city } = req.query;

  let query = db.select().from(doctorsTable).$dynamic();

  const conditions = [];
  if (q) conditions.push(or(ilike(doctorsTable.name, `%${q}%`), ilike(doctorsTable.specialty, `%${q}%`)));
  if (specialty) conditions.push(ilike(doctorsTable.specialty, `%${specialty}%`));
  if (location) conditions.push(ilike(doctorsTable.location, `%${location}%`));
  if (available === "true") conditions.push(eq(doctorsTable.available, true));

  if (conditions.length > 0) {
    query = query.where(or(...conditions));
  }

  const doctors = await query.orderBy(desc(doctorsTable.rating)).limit(50);

  if (doctors.length === 0) {
    const live = await fetchLiveDoctors({
      specialty: typeof specialty === "string" ? specialty : undefined,
      q: typeof q === "string" ? q : undefined,
      city: typeof city === "string" ? city : (typeof location === "string" ? location : undefined),
    });
    res.json(live);
    return;
  }
  res.json(doctors);
});

router.get("/doctors/:doctorId", requireAuth, async (req, res) => {
  const [doctor] = await db
    .select()
    .from(doctorsTable)
    .where(eq(doctorsTable.id, parseInt(req.params.doctorId)));

  if (!doctor) { res.status(404).json({ error: "Doctor not found" }); return; }
  res.json(doctor);
});

router.post("/doctors", requireAdmin, async (req, res) => {
  const { name, specialty, experienceYears, consultationFee, rating, location, bio, languages, available, imageUrl } = req.body;
  const [doctor] = await db
    .insert(doctorsTable)
    .values({ name, specialty, experienceYears, consultationFee, rating, location, bio, languages, available, imageUrl })
    .returning();
  res.status(201).json(doctor);
});

router.patch("/doctors/:doctorId", requireAdmin, async (req, res) => {
  const { name, specialty, experienceYears, consultationFee, rating, location, bio, available } = req.body;
  const [updated] = await db
    .update(doctorsTable)
    .set({ name, specialty, experienceYears, consultationFee, rating, location, bio, available })
    .where(eq(doctorsTable.id, parseInt(req.params.doctorId)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.get("/hospitals", requireAuth, async (req, res) => {
  const { location, specialty, q, city } = req.query;
  let query = db.select().from(hospitalsTable).$dynamic();

  const conditions = [];
  if (q) conditions.push(ilike(hospitalsTable.name, `%${q}%`));
  if (location) conditions.push(ilike(hospitalsTable.location, `%${location}%`));
  if (specialty) {
    conditions.push(sql`${hospitalsTable.specialties} && ARRAY[${specialty}]::text[]`);
  }

  if (conditions.length > 0) {
    query = query.where(or(...conditions));
  }

  const hospitals = await query.orderBy(desc(hospitalsTable.rating)).limit(50);

  if (hospitals.length === 0) {
    const live = await fetchLiveHospitals({
      q: typeof q === "string" ? q : undefined,
      city: typeof city === "string" ? city : (typeof location === "string" ? location : undefined),
      specialty: typeof specialty === "string" ? specialty : undefined,
    });
    res.json(live);
    return;
  }
  res.json(hospitals);
});

router.post("/hospitals", requireAdmin, async (req, res) => {
  const { name, location, specialties, rating, phone, email, website, imageUrl } = req.body;
  const [hospital] = await db
    .insert(hospitalsTable)
    .values({ name, location, specialties, rating, phone, email, website, imageUrl })
    .returning();
  res.status(201).json(hospital);
});

router.get("/admin/rankings", requireAdmin, async (req, res) => {
  const rankings = await db.select().from(providerRankingsTable).orderBy(desc(providerRankingsTable.boostScore));
  res.json(rankings);
});

router.post("/admin/rankings", requireAdmin, async (req, res) => {
  const { providerId, providerType, boostScore } = req.body;
  const [ranking] = await db
    .insert(providerRankingsTable)
    .values({ providerId, providerType, boostScore })
    .returning();
  res.json(ranking);
});

export default router;
