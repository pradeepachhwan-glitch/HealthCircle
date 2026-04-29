import { Router } from "express";
import { db } from "@workspace/db";
import { doctorsTable, hospitalsTable, providerRankingsTable } from "@workspace/db/schema";
import { and, eq, ilike, or, desc, sql, type SQL } from "drizzle-orm";
import { requireAuth, requireAdmin , pstr } from "../lib/auth";
import { fetchLiveDoctors, fetchLiveHospitals } from "../lib/osmProviders";
import { inferSpecialty } from "../lib/specialtyMatcher";
import { mergeAndRankDoctors, mergeAndRankHospitals } from "../lib/providerRanker";

const router = Router();

// Pull the leading city token out of values like "Faridabad, Haryana".
function cityToken(raw: string | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const t = raw.split(",")[0].trim();
  return t.length > 0 ? t : null;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

// ---- GET /doctors ----------------------------------------------------------
// Hybrid retrieval: DB and OSM are always queried in parallel.
// Results are merged, scored, de-duplicated, and ranked before returning.
// DB results carry higher trust weight (+100 base) vs OSM (+20 base).

router.get("/doctors", requireAuth, async (req, res) => {
  const q        = asString(req.query.q);
  const specialty = asString(req.query.specialty);
  const cityArg  = asString(req.query.city) ?? asString(req.query.location);
  const available = asString(req.query.available);
  const cityShort = cityToken(cityArg);
  const inferred  = q ? inferSpecialty(q) : null;

  // Build DB match clauses (OR between q-variants and the specialty chip)
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

  // Fire DB (city-scoped) and OSM (city-scoped) in parallel — always.
  const [dbDoctors, liveDoctors] = await Promise.all([
    (() => {
      let query = db.select().from(doctorsTable).$dynamic();
      if (andConditions.length > 0) query = query.where(and(...andConditions));
      return query.orderBy(desc(doctorsTable.rating)).limit(50);
    })(),
    fetchLiveDoctors({ specialty: inferred ?? specialty, q, city: cityArg }).catch(() => []),
  ]);

  const rankOpts = { q, inferred, chip: specialty, cityShort };
  let ranked = mergeAndRankDoctors(dbDoctors, liveDoctors, rankOpts);

  // Coverage fill-in: when both parallel queries return few results and the
  // user supplied a city filter, run a second DB query without the city
  // constraint so we surface relevant specialists from other cities.
  // These score lower (no city-match bonus) so they naturally sit at the
  // bottom of the ranked list, acting as a "nearby / best match" supplement.
  if (ranked.length < 5 && cityShort && (q || specialty)) {
    const wideConds: SQL[] = [];
    if (matchClauses.length === 1) wideConds.push(matchClauses[0]);
    else if (matchClauses.length > 1) wideConds.push(or(...matchClauses)!);
    if (available === "true") wideConds.push(eq(doctorsTable.available, true));
    let wide = db.select().from(doctorsTable).$dynamic();
    if (wideConds.length) wide = wide.where(and(...wideConds));
    const wideDb = await wide.orderBy(desc(doctorsTable.rating)).limit(20);
    ranked = mergeAndRankDoctors(
      [...dbDoctors, ...wideDb],
      liveDoctors,
      rankOpts,
    );
  }

  res.json(ranked);
});

// ---- GET /doctors/:doctorId ------------------------------------------------

router.get("/doctors/:doctorId", requireAuth, async (req, res) => {
  const [doctor] = await db
    .select()
    .from(doctorsTable)
    .where(eq(doctorsTable.id, parseInt(pstr(req.params.doctorId), 10)));

  if (!doctor) { res.status(404).json({ error: "Doctor not found" }); return; }
  res.json(doctor);
});

// ---- POST /doctors (admin) -------------------------------------------------

router.post("/doctors", requireAdmin, async (req, res) => {
  const { name, specialty, experienceYears, consultationFee, rating, location, bio, languages, available, imageUrl } = req.body;
  const [doctor] = await db
    .insert(doctorsTable)
    .values({ name, specialty, experienceYears, consultationFee, rating, location, bio, languages, available, imageUrl })
    .returning();
  res.status(201).json(doctor);
});

// ---- PATCH /doctors/:doctorId (admin) --------------------------------------

router.patch("/doctors/:doctorId", requireAdmin, async (req, res) => {
  const { name, specialty, experienceYears, consultationFee, rating, location, bio, available } = req.body;
  const [updated] = await db
    .update(doctorsTable)
    .set({ name, specialty, experienceYears, consultationFee, rating, location, bio, available })
    .where(eq(doctorsTable.id, parseInt(pstr(req.params.doctorId), 10)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

// ---- GET /hospitals --------------------------------------------------------
// Same hybrid approach: DB + OSM in parallel, merged and ranked.

router.get("/hospitals", requireAuth, async (req, res) => {
  const q        = asString(req.query.q);
  const specialty = asString(req.query.specialty);
  const cityArg  = asString(req.query.city) ?? asString(req.query.location);
  const cityShort = cityToken(cityArg);
  const inferred  = q ? inferSpecialty(q) : null;

  const matchClauses: SQL[] = [];
  if (q) matchClauses.push(ilike(hospitalsTable.name, `%${q}%`));
  if (specialty) matchClauses.push(sql`${hospitalsTable.specialties} && ARRAY[${specialty}]::text[]`);
  if (inferred) matchClauses.push(
    sql`EXISTS (SELECT 1 FROM unnest(${hospitalsTable.specialties}) s WHERE s ILIKE ${"%" + inferred + "%"})`,
  );

  const andConditions: SQL[] = [];
  if (matchClauses.length === 1) andConditions.push(matchClauses[0]);
  else if (matchClauses.length > 1) andConditions.push(or(...matchClauses)!);
  if (cityShort) andConditions.push(ilike(hospitalsTable.location, `%${cityShort}%`));

  // Fire DB and OSM in parallel — always.
  const [dbHospitals, liveHospitals] = await Promise.all([
    (() => {
      let query = db.select().from(hospitalsTable).$dynamic();
      if (andConditions.length > 0) query = query.where(and(...andConditions));
      return query.orderBy(desc(hospitalsTable.rating)).limit(50);
    })(),
    fetchLiveHospitals({ q, city: cityArg, specialty: inferred ?? specialty }).catch(() => []),
  ]);

  const rankOpts = { q, inferred, chip: specialty, cityShort };
  const ranked = mergeAndRankHospitals(dbHospitals, liveHospitals, rankOpts);
  res.json(ranked);
});

// ---- POST /hospitals (admin) -----------------------------------------------

router.post("/hospitals", requireAdmin, async (req, res) => {
  const { name, location, specialties, rating, phone, email, website, imageUrl } = req.body;
  const [hospital] = await db
    .insert(hospitalsTable)
    .values({ name, location, specialties, rating, phone, email, website, imageUrl })
    .returning();
  res.status(201).json(hospital);
});

// ---- Admin rankings --------------------------------------------------------

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
