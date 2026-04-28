import { Router } from "express";
import { db } from "@workspace/db";
import { doctorsTable, hospitalsTable, providerRankingsTable } from "@workspace/db/schema";
import { and, eq, ilike, or, desc, sql, type SQL } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";
import { fetchLiveDoctors, fetchLiveHospitals } from "../lib/osmProviders";
import { inferSpecialty } from "../lib/specialtyMatcher";

const router = Router();

// Pull the leading city token out of values like "Faridabad, Haryana" so we
// match DB rows that store either the short or long form.
function cityToken(raw: string | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const t = raw.split(",")[0].trim();
  return t.length > 0 ? t : null;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

router.get("/doctors", requireAuth, async (req, res) => {
  const q = asString(req.query.q);
  const specialty = asString(req.query.specialty);
  const cityArg = asString(req.query.city) ?? asString(req.query.location);
  const available = asString(req.query.available);
  const cityShort = cityToken(cityArg);

  // The free-text search ("q") and the specialty chip used to be AND-ed,
  // which created impossible queries like:  q="cardilogist" AND specialty="General Physician"
  // Now we treat the two as siblings: a row matches when EITHER the chip
  // matches OR q matches the name/specialty (with typo-tolerant inference).
  // Within the q match we also try inferring a canonical specialty from
  // the typed text ("cardilogist" → "Cardiologist") so common typos still
  // surface the right specialists.
  const inferred = q ? inferSpecialty(q) : null;

  const matchClauses: SQL[] = [];
  if (q) {
    matchClauses.push(ilike(doctorsTable.name, `%${q}%`));
    matchClauses.push(ilike(doctorsTable.specialty, `%${q}%`));
    if (inferred) matchClauses.push(ilike(doctorsTable.specialty, `%${inferred}%`));
  }
  if (specialty) {
    matchClauses.push(ilike(doctorsTable.specialty, `%${specialty}%`));
  }

  const andConditions: SQL[] = [];
  if (matchClauses.length === 1) andConditions.push(matchClauses[0]);
  else if (matchClauses.length > 1) andConditions.push(or(...matchClauses)!);
  if (cityShort) andConditions.push(ilike(doctorsTable.location, `%${cityShort}%`));
  if (available === "true") andConditions.push(eq(doctorsTable.available, true));

  let query = db.select().from(doctorsTable).$dynamic();
  if (andConditions.length > 0) query = query.where(and(...andConditions));

  let doctors = await query.orderBy(desc(doctorsTable.rating)).limit(50);

  // If the city filter zeroed us out but we have specialty/q hits elsewhere
  // in the DB, surface those (without the city filter) so the user still sees
  // *some* relevant specialists alongside the live OSM results.
  let dbWideMatches: typeof doctors = [];
  if (doctors.length === 0 && cityShort && (q || specialty)) {
    let wide = db.select().from(doctorsTable).$dynamic();
    const wideConds: SQL[] = [];
    if (matchClauses.length === 1) wideConds.push(matchClauses[0]);
    else if (matchClauses.length > 1) wideConds.push(or(...matchClauses)!);
    if (wideConds.length) wide = wide.where(and(...wideConds));
    dbWideMatches = await wide.orderBy(desc(doctorsTable.rating)).limit(20);
  }

  // Always also pull live OSM nearby clinics when a city is supplied AND we
  // either had nothing in the DB for that city, or we explicitly want
  // location-aware results (the chip / q is set). Combining DB + OSM gives
  // the user the maximum chance of finding what they typed.
  let live: Awaited<ReturnType<typeof fetchLiveDoctors>> = [];
  if (cityArg && doctors.length === 0) {
    live = await fetchLiveDoctors({
      specialty: inferred ?? specialty,
      q,
      city: cityArg,
    });
  } else if (!cityArg && doctors.length === 0) {
    live = await fetchLiveDoctors({ specialty: inferred ?? specialty, q });
  }

  if (doctors.length === 0) {
    // Prefer DB-wide matches first (they're real records with bookable
    // appointments), then the live OSM listings.
    res.json([...dbWideMatches, ...live]);
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
  const q = asString(req.query.q);
  const specialty = asString(req.query.specialty);
  const cityArg = asString(req.query.city) ?? asString(req.query.location);
  const cityShort = cityToken(cityArg);
  const inferred = q ? inferSpecialty(q) : null;

  const matchClauses: SQL[] = [];
  if (q) matchClauses.push(ilike(hospitalsTable.name, `%${q}%`));
  if (specialty) matchClauses.push(sql`${hospitalsTable.specialties} && ARRAY[${specialty}]::text[]`);
  if (inferred) matchClauses.push(sql`EXISTS (SELECT 1 FROM unnest(${hospitalsTable.specialties}) s WHERE s ILIKE ${'%' + inferred + '%'})`);

  const andConditions: SQL[] = [];
  if (matchClauses.length === 1) andConditions.push(matchClauses[0]);
  else if (matchClauses.length > 1) andConditions.push(or(...matchClauses)!);
  if (cityShort) andConditions.push(ilike(hospitalsTable.location, `%${cityShort}%`));

  let query = db.select().from(hospitalsTable).$dynamic();
  if (andConditions.length > 0) query = query.where(and(...andConditions));

  const hospitals = await query.orderBy(desc(hospitalsTable.rating)).limit(50);

  if (hospitals.length === 0) {
    const live = await fetchLiveHospitals({
      q,
      city: cityArg,
      specialty: inferred ?? specialty,
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
