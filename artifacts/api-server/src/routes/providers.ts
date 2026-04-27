import { Router } from "express";
import { db } from "@workspace/db";
import { doctorsTable, hospitalsTable, providerRankingsTable } from "@workspace/db/schema";
import { and, eq, ilike, or, desc, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";
import { fetchLiveDoctors, fetchLiveHospitals } from "../lib/osmProviders";

const router = Router();

// Pull the leading city token out of values like "Faridabad, Haryana" so we
// match DB rows that store either the short or long form.
function cityToken(raw: string | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const t = raw.split(",")[0].trim();
  return t.length > 0 ? t : null;
}

router.get("/doctors", requireAuth, async (req, res) => {
  const { specialty, location, available, q, city } = req.query;

  const cityArg = typeof city === "string" ? city : (typeof location === "string" ? location : undefined);
  const cityShort = cityToken(cityArg);

  // AND-combined conditions so city actually narrows the result set instead
  // of OR-ing it with q/specialty (which would surface big-city dummy rows
  // for any user typing a known specialty).
  const andConditions = [];
  if (q) andConditions.push(or(ilike(doctorsTable.name, `%${q}%`), ilike(doctorsTable.specialty, `%${q}%`)));
  if (specialty) andConditions.push(ilike(doctorsTable.specialty, `%${specialty}%`));
  if (cityShort) andConditions.push(ilike(doctorsTable.location, `%${cityShort}%`));
  if (available === "true") andConditions.push(eq(doctorsTable.available, true));

  let query = db.select().from(doctorsTable).$dynamic();
  if (andConditions.length > 0) query = query.where(and(...andConditions));

  const doctors = await query.orderBy(desc(doctorsTable.rating)).limit(50);

  // Fall back to live OpenStreetMap whenever we have no city-relevant DB
  // matches. The fallback always runs when a city is supplied, even if the
  // DB returned a few stale national rows that don't correspond to that
  // city (the city-AND filter above guarantees those rows already match the
  // city, so no need for additional checks).
  if (doctors.length === 0 && cityArg) {
    const live = await fetchLiveDoctors({
      specialty: typeof specialty === "string" ? specialty : undefined,
      q: typeof q === "string" ? q : undefined,
      city: cityArg,
    });
    res.json(live);
    return;
  }

  // No city supplied and DB empty: still try OSM with a default
  if (doctors.length === 0) {
    const live = await fetchLiveDoctors({
      specialty: typeof specialty === "string" ? specialty : undefined,
      q: typeof q === "string" ? q : undefined,
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

  const cityArg = typeof city === "string" ? city : (typeof location === "string" ? location : undefined);
  const cityShort = cityToken(cityArg);

  const andConditions = [];
  if (q) andConditions.push(ilike(hospitalsTable.name, `%${q}%`));
  if (cityShort) andConditions.push(ilike(hospitalsTable.location, `%${cityShort}%`));
  if (specialty) {
    andConditions.push(sql`${hospitalsTable.specialties} && ARRAY[${specialty}]::text[]`);
  }

  let query = db.select().from(hospitalsTable).$dynamic();
  if (andConditions.length > 0) query = query.where(and(...andConditions));

  const hospitals = await query.orderBy(desc(hospitalsTable.rating)).limit(50);

  if (hospitals.length === 0 && cityArg) {
    const live = await fetchLiveHospitals({
      q: typeof q === "string" ? q : undefined,
      city: cityArg,
      specialty: typeof specialty === "string" ? specialty : undefined,
    });
    res.json(live);
    return;
  }

  if (hospitals.length === 0) {
    const live = await fetchLiveHospitals({
      q: typeof q === "string" ? q : undefined,
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
