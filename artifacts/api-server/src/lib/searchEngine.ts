import { db } from "@workspace/db";
import { doctorsTable, hospitalsTable, searchLogsTable, communitiesTable, postsTable, usersTable } from "@workspace/db/schema";
import { ilike, or, eq, and, desc, sql } from "drizzle-orm";
import { aiChatJson } from "./aiClient";
import { detectEmergency } from "./emergencyDetect";

export type SearchIntent = "symptom" | "treatment" | "doctor" | "lab" | "general";

export interface SearchResult {
  intent: SearchIntent;
  summary: string;
  risk_level: "low" | "medium" | "high";
  recommendations: string[];
  providers: ProviderResult[];
  relatedCommunities: RelatedCommunity[];
  discussions: DiscussionResult[];
  mapQuery: string;
  ai_synthesized: boolean;
  /** The medical specialty inferred from the query, if any (e.g. "Pediatrician"). */
  detectedSpecialty: string | null;
  /** Reason providers list is empty (lets the UI show an honest message). */
  providerEmptyReason: "no_specialty_match" | "no_general_match" | null;
}

interface ProviderResult {
  id: number;
  type: "doctor" | "hospital";
  name: string;
  specialty?: string;
  location: string;
  rating: string;
  available?: boolean;
}

interface RelatedCommunity {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  iconEmoji: string | null;
}

interface DiscussionResult {
  id: number;
  title: string;
  excerpt: string;
  communitySlug: string;
  communityName: string;
  authorName: string | null;
  upvoteCount: number;
  commentCount: number;
  isExpertAnswered: boolean;
  createdAt: Date;
}

const SYMPTOM_KEYWORDS = ["pain", "ache", "fever", "cold", "cough", "headache", "dizzy", "nausea", "fatigue", "swelling", "rash", "bleed", "breathe", "chest", "stomach", "दर्द", "बुखार", "सिरदर्द", "खांसी"];
const TREATMENT_KEYWORDS = ["treat", "cure", "medicine", "drug", "therapy", "surgery", "vaccine", "dose", "dosage", "prescription", "इलाज", "दवा"];
const DOCTOR_KEYWORDS = ["doctor", "specialist", "physician", "surgeon", "cardiologist", "dermatologist", "orthopedic", "gynecologist", "डॉक्टर", "चिकित्सक"];
const LAB_KEYWORDS = ["test", "blood", "urine", "x-ray", "scan", "mri", "ct", "lab", "report", "sample", "टेस्ट", "जांच"];

// NOTE: communitySlug values MUST match the slugs seeded in the `communities` DB table.
// Mismatches silently fall through and cause irrelevant communities to surface in results.
const SPECIALTY_MAP: { keywords: string[]; specialty: string; communitySlug?: string }[] = [
  { keywords: ["heart", "cardiac", "cardiologist", "chest pain", "blood pressure", "hypertension", "bp"], specialty: "Cardiologist", communitySlug: "heart-health" },
  { keywords: ["diabetes", "sugar", "insulin", "glucose"], specialty: "Endocrinologist", communitySlug: "diabetes-care" },
  { keywords: ["thyroid", "hormone", "hormonal", "pcos", "pcod"], specialty: "Endocrinologist", communitySlug: "thyroid-hormonal" },
  { keywords: ["skin", "rash", "acne", "dermatologist", "eczema"], specialty: "Dermatologist" },
  { keywords: ["bone", "joint", "back pain", "knee", "orthopedic", "fracture", "arthritis"], specialty: "Orthopedic Surgeon", communitySlug: "bone-joint-health" },
  { keywords: ["pregnan", "gynec", "menstrual", "period", "ovary", "uterus", "मातृत्व"], specialty: "Gynecologist", communitySlug: "pregnancy-motherhood" },
  { keywords: ["fertility", "ivf", "conceive", "infertil"], specialty: "Gynecologist", communitySlug: "fertility-ivf" },
  { keywords: ["mental", "anxiety", "depression", "stress", "panic", "sleep", "mood"], specialty: "Psychiatrist", communitySlug: "mental-wellness" },
  { keywords: ["child", "kid", "pediatr", "paediatr", "baby", "infant", "toddler", "बच्चे", "बच्चा"], specialty: "Pediatrician", communitySlug: "child-health" },
  { keywords: ["elder", "senior", "geriatric", "old age"], specialty: "General Physician", communitySlug: "elder-care" },
  { keywords: ["lung", "breathing", "asthma", "cough", "respiratory"], specialty: "Pulmonologist", communitySlug: "respiratory-health" },
  { keywords: ["fitness", "weight", "obesity", "exercise"], specialty: "General Physician", communitySlug: "weight-loss-fitness" },
  { keywords: ["nutrition", "diet", "food", "meal"], specialty: "Dietitian", communitySlug: "nutrition-diet" },
  { keywords: ["work", "burnout", "workplace stress"], specialty: "Psychiatrist", communitySlug: "work-stress-burnout" },
  { keywords: ["cancer", "tumor", "tumour", "oncolog", "chemo"], specialty: "Oncologist", communitySlug: "cancer-support" },
  { keywords: ["brain", "neuro", "migraine", "headache", "seizure", "epilepsy"], specialty: "Neurologist", communitySlug: "neurology-brain" },
];

// Allow-list of community slugs that may appear in search results. Excludes
// admin/business communities (clinical-ops, rcm, isb-alumni) so health-seekers
// only see health-relevant peer groups.
const HEALTH_COMMUNITY_SLUGS = new Set([
  "heart-health", "mental-wellness", "diabetes-care", "thyroid-hormonal",
  "bone-joint-health", "pregnancy-motherhood", "pcos-womens-health",
  "fertility-ivf", "child-health", "elder-care", "weight-loss-fitness",
  "nutrition-diet", "sleep-recovery", "respiratory-health", "cancer-support",
  "infectious-diseases", "work-stress-burnout", "digital-health",
  "alternative-medicine", "neurology-brain",
]);

// Same forbidden-platforms list used by Yukti chat — keeps the search summary on-platform.
const FORBIDDEN_REFERRALS = [
  /\bpracto\b/gi, /\b1\s?mg\b/gi, /\bjustdial\b/gi, /\bapollo\s?24\b/gi,
  /\bpharmeasy\b/gi, /\btata\s?1mg\b/gi, /\blybrate\b/gi, /\bnetmeds\b/gi,
  /\bdr\.?\s?lal\s?path\s?labs?\b/gi, /\bnhp\.gov\b/gi,
  /\bgoogle\s+(search|it|maps?)\b/gi, /\bwebmd\b/gi, /\bzocdoc\b/gi,
  /\bministry of health\b/gi, /\bnational health portal\b/gi,
];
function sanitizeExternalRefs(text: string): string {
  let out = text;
  for (const re of FORBIDDEN_REFERRALS) out = out.replace(re, "HealthCircle");
  out = out.replace(/(use|check|search on|visit|go to)\s+HealthCircle/gi, "use HealthCircle");
  return out;
}

function classifyIntent(query: string): SearchIntent {
  const lower = query.toLowerCase();
  if (DOCTOR_KEYWORDS.some(k => lower.includes(k))) return "doctor";
  if (LAB_KEYWORDS.some(k => lower.includes(k))) return "lab";
  if (TREATMENT_KEYWORDS.some(k => lower.includes(k))) return "treatment";
  if (SYMPTOM_KEYWORDS.some(k => lower.includes(k))) return "symptom";
  return "general";
}

function assessRisk(query: string, intent: SearchIntent): "low" | "medium" | "high" {
  const lower = query.toLowerCase();
  const highRiskTerms = ["chest pain", "can't breathe", "unconscious", "stroke", "heart attack", "severe bleeding", "suicide"];
  const mediumRiskTerms = ["fever", "pain", "swelling", "infection", "बुखार"];
  if (highRiskTerms.some(t => lower.includes(t))) return "high";
  if (intent === "symptom" && mediumRiskTerms.some(t => lower.includes(t))) return "medium";
  return "low";
}

function getRecommendations(intent: SearchIntent, risk: "low" | "medium" | "high"): string[] {
  if (risk === "high") {
    return [
      "Call emergency services (112) immediately",
      "Do not drive yourself to the hospital",
      "Stay calm and keep the patient still",
      "Use HealthCircle's 'Find a Doctor' to alert a verified specialist",
    ];
  }
  switch (intent) {
    case "symptom":
      return [
        "Monitor symptoms for 24-48 hours",
        "Stay hydrated and rest",
        "Book an appointment with a HealthCircle verified doctor if symptoms worsen",
        "Avoid self-medication without professional advice",
      ];
    case "treatment":
      return [
        "Always follow prescribed dosage",
        "Complete the full course of medication",
        "Report side effects to your doctor on HealthCircle chat",
        "Do not share prescriptions with others",
      ];
    case "doctor":
      return [
        "Tap a doctor below to view their profile and book an appointment",
        "Prepare a list of your symptoms before the visit",
        "Bring all previous medical records and test reports",
        "Note any current medications you take",
      ];
    case "lab":
      return [
        "Fast for 8-12 hours if required",
        "Bring your doctor's referral slip",
        "Arrive 15 minutes early",
        "Results typically take 24-48 hours",
      ];
    default:
      return [
        "Browse our verified doctor directory below",
        "Join a HealthCircle community to ask peers",
        "Maintain a healthy lifestyle",
      ];
  }
}

function getMapQuery(intent: SearchIntent, query: string): string {
  switch (intent) {
    case "doctor": return `${query} doctor hospital near me`;
    case "lab": return `diagnostic lab pathology near me`;
    case "symptom": return `doctor clinic hospital near me`;
    case "treatment": return `hospital specialist clinic near me`;
    default: return `doctor hospital clinic near me`;
  }
}

function detectSpecialty(query: string): { specialty: string | null; communitySlug: string | null } {
  const lower = query.toLowerCase();
  for (const m of SPECIALTY_MAP) {
    if (m.keywords.some(k => lower.includes(k))) {
      return { specialty: m.specialty, communitySlug: m.communitySlug ?? null };
    }
  }
  return { specialty: null, communitySlug: null };
}

/**
 * Smart fallback summary — used when AI synthesis is unavailable. Interpolates
 * the actual data we found so the user always sees something specific and
 * useful, never a generic boilerplate.
 */
function templateSummary(
  intent: SearchIntent,
  query: string,
  providers: ProviderResult[],
  communities: RelatedCommunity[],
  discussions: DiscussionResult[],
  risk: "low" | "medium" | "high",
): string {
  const parts: string[] = [];

  if (risk === "high") {
    parts.push(`⚠️ Your query about "${query}" sounds urgent — if this is an emergency, call 108 immediately.`);
  } else {
    const lead: Record<SearchIntent, string> = {
      symptom: `For your concern about "${query}",`,
      treatment: `On treatment for "${query}",`,
      doctor: `Here's what HealthCircle has for "${query}":`,
      lab: `For "${query}" related tests,`,
      general: `On "${query}",`,
    };
    parts.push(lead[intent]);
  }

  const hits: string[] = [];
  if (providers.length) {
    const docs = providers.filter(p => p.type === "doctor");
    const top = docs[0] ?? providers[0];
    if (docs.length > 0 && top.specialty) {
      hits.push(`${docs.length} verified ${top.specialty}${docs.length === 1 ? "" : "s"} on HealthCircle (e.g. ${top.name} in ${top.location})`);
    } else if (top) {
      hits.push(`${providers.length} verified provider${providers.length === 1 ? "" : "s"} on HealthCircle`);
    }
  }
  if (communities.length) {
    const top = communities[0];
    hits.push(`an active "${top.name}" community where peers discuss this`);
  }
  if (discussions.length) {
    hits.push(`${discussions.length} member discussion${discussions.length === 1 ? "" : "s"} matching your query`);
  }

  if (hits.length) {
    parts.push(`we found ${hits.join(", ")}. Tap any item below to engage directly — everything happens here on HealthCircle.`);
  } else {
    parts.push(`browse our verified doctor directory below or join a HealthCircle community to ask peers — no need to leave the app.`);
  }
  return parts.join(" ");
}

/**
 * Synthesize a query-specific, on-platform summary using OpenAI grounded on the
 * actual data we found in our database (providers, communities, discussions).
 * If OpenAI fails or env vars are missing, fall back to the deterministic
 * template summary — no broken state for the user.
 */
async function synthesizeSummary(
  query: string,
  intent: SearchIntent,
  risk: "low" | "medium" | "high",
  providers: ProviderResult[],
  communities: RelatedCommunity[],
  discussions: DiscussionResult[],
): Promise<{ text: string; aiUsed: boolean }> {
  const fallback = templateSummary(intent, query, providers, communities, discussions, risk);

  const systemPrompt = `You are HealthCircle Search — India's self-contained health super app. Write a SHORT (2-3 sentence), warm, factual summary that directly addresses the user's query. STRICT RULES:
1. NEVER mention or recommend any external service (Practo, 1mg, Apollo 24/7, Tata 1mg, Justdial, PharmEasy, WebMD, Google, Lybrate, Netmeds, NHP, etc.). Everything must point inward to HealthCircle.
2. When relevant, weave in the actual platform results we found — say things like "you can consult Dr. X (cardiologist, Mumbai) below" or "the Heart Circle community has N active discussions on this".
3. Never diagnose, prescribe, or give dosages. Encourage booking a HealthCircle verified doctor for anything beyond general info.
4. If risk is "high", lead with the urgency and the 108 / emergency advice.
5. Respond ONLY with a JSON object of shape: {"summary": "..."}.`;

  const dataContext = {
    query,
    intent,
    risk_level: risk,
    providers_found: providers.slice(0, 5).map(p => ({ name: p.name, specialty: p.specialty, location: p.location, type: p.type })),
    communities_found: communities.slice(0, 3).map(c => ({ name: c.name, slug: c.slug })),
    discussions_found: discussions.slice(0, 3).map(d => ({ title: d.title, community: d.communityName, upvotes: d.upvoteCount, expertAnswered: d.isExpertAnswered })),
  };

  const parsed = await aiChatJson<{ summary?: string }>({
    systemPrompt,
    userPrompt: `User searched for: "${query}"\n\nWhat we found in HealthCircle's own database:\n${JSON.stringify(dataContext, null, 2)}\n\nWrite the summary now.`,
    timeoutMs: 6000,
    maxTokens: 220,
  });
  if (!parsed?.summary) return { text: fallback, aiUsed: false };
  const text = sanitizeExternalRefs(parsed.summary.trim());
  if (!text) return { text: fallback, aiUsed: false };
  return { text, aiUsed: true };
}

export async function runHealthSearch(query: string, userId?: number, language?: string): Promise<SearchResult> {
  const intent = classifyIntent(query);
  // Emergency hard-stop overrides any heuristic risk score — if the query
  // includes life-threatening triggers (chest pain, suicide, breathing
  // distress, etc. across English/Hinglish/Indic), bump risk to "high" so
  // the UI shows the urgent banner and the AI synthesis leads with 108.
  const emergency = detectEmergency(query);

  // Hard-stop: if a life-threatening trigger fires, return an immediate,
  // unmissable 108 response without spending DB queries or AI latency.
  // The user sees the urgent guidance instantly and we still log the search
  // so MedPro/admin dashboards can see the spike.
  if (emergency) {
    if (userId) {
      try {
        await db.insert(searchLogsTable).values({
          userId, query, intent, riskLevel: "high", language: language ?? "en",
        });
      } catch { /* logging is best-effort */ }
    }
    return {
      intent: "general",
      summary: "🚨 This sounds like a medical emergency. Call 108 (ambulance) immediately. If you can't call yourself, ask someone nearby. Do not wait. Inside HealthCircle, tap 'Get a Doctor's Opinion' to alert a verified medical professional in parallel.",
      risk_level: "high",
      recommendations: [
        "CALL 108 NOW — India's national ambulance service (free)",
        "If you cannot call, ask someone nearby to call for you",
        "Do not leave the person alone",
        "Tap 'Get a Doctor's Opinion' inside the chat to alert a HealthCircle verified doctor",
      ],
      providers: [],
      relatedCommunities: [],
      discussions: [],
      mapQuery: "",
      ai_synthesized: false,
      detectedSpecialty: null,
      providerEmptyReason: null,
    };
  }

  const risk = assessRisk(query, intent);
  const recommendations = getRecommendations(intent, risk);
  const mapQuery = getMapQuery(intent, query);
  const { specialty, communitySlug } = detectSpecialty(query);

  // ── Providers (doctors + hospitals) ──
  // If a specialty was detected but we have ZERO doctors of that specialty in
  // our verified network, we DO NOT silently backfill with random doctors —
  // that misleads users (e.g. searching "pediatrician" and getting a cardiologist
  // is a worse experience than an honest "no verified pediatricians yet").
  let providers: ProviderResult[] = [];
  let specialtyMatched = false;
  let providerEmptyReason: "no_specialty_match" | "no_general_match" | null = null;
  try {
    if (intent !== "lab") {
      let final: typeof doctorsTable.$inferSelect[] = [];

      if (specialty) {
        // Strict: only doctors actually matching the requested specialty.
        final = await db
          .select()
          .from(doctorsTable)
          .where(and(
            eq(doctorsTable.available, true),
            ilike(doctorsTable.specialty, `%${specialty}%`),
          ))
          .limit(5);
        specialtyMatched = final.length > 0;
        if (!specialtyMatched) providerEmptyReason = "no_specialty_match";
      } else {
        // No specialty intent: fuzzy match on name/specialty/location.
        const conditions = [
          ilike(doctorsTable.name, `%${query}%`),
          ilike(doctorsTable.specialty, `%${query}%`),
          ilike(doctorsTable.location, `%${query}%`),
        ];
        final = await db
          .select()
          .from(doctorsTable)
          .where(and(eq(doctorsTable.available, true), or(...conditions)))
          .limit(5);
        if (final.length === 0) providerEmptyReason = "no_general_match";
      }

      providers = providers.concat(
        final.map(d => ({
          id: d.id,
          type: "doctor" as const,
          name: d.name,
          specialty: d.specialty,
          location: d.location,
          rating: d.rating,
          available: d.available,
        })),
      );
    }

    const hospitals = await db
      .select()
      .from(hospitalsTable)
      .where(or(ilike(hospitalsTable.name, `%${query}%`), ilike(hospitalsTable.location, `%${query}%`)))
      .limit(3);

    providers = providers.concat(
      hospitals.map(h => ({ id: h.id, type: "hospital" as const, name: h.name, location: h.location, rating: h.rating })),
    );
  } catch {
    // graceful — empty is fine
  }

  // ── Communities ──
  // Only health communities ever surface here. Admin/business communities
  // (clinical-ops, rcm, isb-alumni) are excluded via HEALTH_COMMUNITY_SLUGS so
  // a health-seeker never sees "ISB Alumni Network" while searching for a
  // pediatrician.
  let relatedCommunities: RelatedCommunity[] = [];
  try {
    const allCommunities = await db
      .select({
        id: communitiesTable.id,
        slug: communitiesTable.slug,
        name: communitiesTable.name,
        description: communitiesTable.description,
        iconEmoji: communitiesTable.iconEmoji,
      })
      .from(communitiesTable)
      .where(eq(communitiesTable.isArchived, false));

    const healthOnly = allCommunities.filter(c => HEALTH_COMMUNITY_SLUGS.has(c.slug));

    // 1. Direct match for the detected specialty's community (highest signal).
    if (communitySlug) {
      const direct = healthOnly.find(c => c.slug === communitySlug);
      if (direct) relatedCommunities.push(direct);
    }

    // 2. Fuzzy text match against community name/description.
    const lowerQ = query.toLowerCase();
    const fuzzy = healthOnly
      .filter(c => !relatedCommunities.find(r => r.id === c.id))
      .filter(c =>
        c.name.toLowerCase().includes(lowerQ) ||
        (c.description ?? "").toLowerCase().includes(lowerQ)
      );
    relatedCommunities = relatedCommunities.concat(fuzzy.slice(0, 2));

    // 3. Backfill from a curated "popular" set, not alphabetical order.
    if (relatedCommunities.length < 3) {
      const POPULAR_FALLBACK = ["heart-health", "mental-wellness", "diabetes-care", "weight-loss-fitness", "child-health"];
      const popular = POPULAR_FALLBACK
        .map(slug => healthOnly.find(c => c.slug === slug))
        .filter((c): c is NonNullable<typeof c> => !!c)
        .filter(c => !relatedCommunities.find(r => r.id === c.id));
      relatedCommunities = relatedCommunities.concat(popular.slice(0, 3 - relatedCommunities.length));
    }
  } catch {
    // graceful
  }

  // ── Community discussions (posts) — NEW ──
  // Surface real conversations on the platform that match the user's query so
  // they have an immediate way to engage with peers and verified pros.
  let discussions: DiscussionResult[] = [];
  try {
    const pattern = `%${query}%`;
    const rows = await db
      .select({
        id: postsTable.id,
        title: postsTable.title,
        content: postsTable.content,
        upvoteCount: postsTable.upvoteCount,
        commentCount: postsTable.commentCount,
        isExpertAnswered: postsTable.isExpertAnswered,
        createdAt: postsTable.createdAt,
        communitySlug: communitiesTable.slug,
        communityName: communitiesTable.name,
        authorName: usersTable.displayName,
      })
      .from(postsTable)
      .leftJoin(communitiesTable, eq(postsTable.communityId, communitiesTable.id))
      .leftJoin(usersTable, eq(postsTable.authorId, usersTable.id))
      .where(or(ilike(postsTable.title, pattern), ilike(postsTable.content, pattern)))
      .orderBy(desc(postsTable.isExpertAnswered), desc(postsTable.upvoteCount), desc(postsTable.createdAt))
      .limit(5);

    discussions = rows
      // Health allow-list applies here too — a peer post in "Clinical Ops" or
      // "ISB Alumni" must never appear inside a health-search result.
      .filter(r => r.communitySlug && r.communityName && HEALTH_COMMUNITY_SLUGS.has(r.communitySlug))
      .map(r => ({
        id: r.id,
        title: r.title,
        excerpt: (r.content ?? "").replace(/\s+/g, " ").slice(0, 160) + ((r.content ?? "").length > 160 ? "…" : ""),
        communitySlug: r.communitySlug as string,
        communityName: r.communityName as string,
        authorName: r.authorName,
        upvoteCount: r.upvoteCount,
        commentCount: r.commentCount,
        isExpertAnswered: r.isExpertAnswered,
        createdAt: r.createdAt as Date,
      }));
  } catch {
    // graceful
  }

  // ── Search log ──
  if (userId) {
    try {
      await db.insert(searchLogsTable).values({ userId, query, intent, language: language ?? "en" });
    } catch {
      // graceful
    }
  }

  // ── AI synthesis grounded on the actual results above ──
  const { text: aiSummary, aiUsed } = await synthesizeSummary(query, intent, risk, providers, relatedCommunities, discussions);

  return {
    intent,
    summary: aiSummary,
    risk_level: risk,
    recommendations: recommendations.map(sanitizeExternalRefs),
    providers,
    relatedCommunities,
    discussions,
    mapQuery,
    ai_synthesized: aiUsed,
    detectedSpecialty: specialty,
    providerEmptyReason,
  };
}

// Suppress unused-import warnings for sql (kept for potential future use)
void sql;
