import { db } from "@workspace/db";
import { doctorsTable, hospitalsTable, searchLogsTable } from "@workspace/db/schema";
import { ilike, or, sql } from "drizzle-orm";

export type SearchIntent = "symptom" | "treatment" | "doctor" | "lab" | "general";

export interface SearchResult {
  intent: SearchIntent;
  summary: string;
  risk_level: "low" | "medium" | "high";
  recommendations: string[];
  providers: ProviderResult[];
  articles: ArticleResult[];
}

interface ProviderResult {
  id: number;
  type: "doctor" | "hospital";
  name: string;
  specialty?: string;
  location: string;
  rating: string;
  available?: boolean;
  boostScore: number;
}

interface ArticleResult {
  title: string;
  source: string;
  url: string;
}

const SYMPTOM_KEYWORDS = ["pain", "ache", "fever", "cold", "cough", "headache", "dizzy", "nausea", "fatigue", "swelling", "rash", "bleed", "breathe", "chest", "stomach", "दर्द", "बुखार", "सिरदर्द", "खांसी"];
const TREATMENT_KEYWORDS = ["treat", "cure", "medicine", "drug", "therapy", "surgery", "vaccine", "dose", "dosage", "prescription", "इलाज", "दवा"];
const DOCTOR_KEYWORDS = ["doctor", "specialist", "physician", "surgeon", "cardiologist", "dermatologist", "orthopedic", "gynecologist", "डॉक्टर", "चिकित्सक"];
const LAB_KEYWORDS = ["test", "blood", "urine", "x-ray", "scan", "mri", "ct", "lab", "report", "sample", "टेस्ट", "जांच"];

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
    return ["Call emergency services (112) immediately", "Do not drive yourself to the hospital", "Stay calm and keep the patient still", "Inform nearby people for assistance"];
  }
  switch (intent) {
    case "symptom":
      return ["Monitor symptoms for 24-48 hours", "Stay hydrated and rest", "Consult a doctor if symptoms worsen", "Avoid self-medication without professional advice"];
    case "treatment":
      return ["Always follow prescribed dosage", "Complete the full course of medication", "Report side effects to your doctor", "Do not share prescriptions with others"];
    case "doctor":
      return ["Book an appointment in advance", "Prepare a list of your symptoms", "Bring all previous medical records", "Note any current medications you take"];
    case "lab":
      return ["Fast for 8-12 hours if required", "Bring your doctor's referral slip", "Arrive 15 minutes early", "Results typically take 24-48 hours"];
    default:
      return ["Consult a healthcare professional for personalized advice", "Keep a record of your health history", "Maintain a healthy lifestyle"];
  }
}

function getArticles(intent: SearchIntent, query: string): ArticleResult[] {
  const baseArticles: Record<SearchIntent, ArticleResult[]> = {
    symptom: [
      { title: "When to See a Doctor for Common Symptoms", source: "Mayo Clinic", url: "https://www.mayoclinic.org" },
      { title: "Understanding Symptom Severity", source: "WebMD", url: "https://www.webmd.com" },
    ],
    treatment: [
      { title: "Evidence-Based Treatment Guidelines", source: "WHO", url: "https://www.who.int" },
      { title: "Safe Medication Practices", source: "NIH MedlinePlus", url: "https://medlineplus.gov" },
    ],
    doctor: [
      { title: "How to Choose the Right Specialist", source: "Healthline", url: "https://www.healthline.com" },
      { title: "What to Expect at Your First Appointment", source: "Mayo Clinic", url: "https://www.mayoclinic.org" },
    ],
    lab: [
      { title: "Complete Guide to Medical Tests", source: "NIH MedlinePlus", url: "https://medlineplus.gov/lab-tests/" },
      { title: "Understanding Your Lab Results", source: "Cleveland Clinic", url: "https://my.clevelandclinic.org" },
    ],
    general: [
      { title: "Preventive Healthcare Basics", source: "CDC", url: "https://www.cdc.gov" },
      { title: "Building Healthy Habits", source: "WHO", url: "https://www.who.int" },
    ],
  };
  return baseArticles[intent] ?? baseArticles.general;
}

export async function runHealthSearch(query: string, userId?: number, language?: string): Promise<SearchResult> {
  const intent = classifyIntent(query);
  const risk = assessRisk(query, intent);
  const recommendations = getRecommendations(intent, risk);
  const articles = getArticles(intent, query);

  const searchTerms = query.split(" ").filter(t => t.length > 2);
  const searchConditions = searchTerms.map(term => ilike(doctorsTable.specialty, `%${term}%`));

  let providers: ProviderResult[] = [];
  try {
    if (intent === "doctor" || intent === "symptom") {
      const doctors = await db
        .select()
        .from(doctorsTable)
        .where(
          or(
            ...searchConditions,
            ilike(doctorsTable.name, `%${query}%`),
            ilike(doctorsTable.location, `%${query}%`)
          )
        )
        .limit(5);

      providers = [
        ...providers,
        ...doctors.map(d => ({
          id: d.id,
          type: "doctor" as const,
          name: d.name,
          specialty: d.specialty,
          location: d.location,
          rating: d.rating,
          available: d.available,
          boostScore: 0,
        })),
      ];
    }

    const hospitals = await db
      .select()
      .from(hospitalsTable)
      .where(
        or(
          ilike(hospitalsTable.name, `%${query}%`),
          ilike(hospitalsTable.location, `%${query}%`),
          sql`${hospitalsTable.specialties} && ARRAY[${query}]::text[]`
        )
      )
      .limit(3);

    providers = [
      ...providers,
      ...hospitals.map(h => ({
        id: h.id,
        type: "hospital" as const,
        name: h.name,
        location: h.location,
        rating: h.rating,
        boostScore: 0,
      })),
    ];
  } catch {
    // Search providers gracefully fails
  }

  if (userId) {
    try {
      await db.insert(searchLogsTable).values({ userId, query, intent, language: language ?? "en" });
    } catch {
      // Log gracefully fails
    }
  }

  const summaries: Record<SearchIntent, string> = {
    symptom: `Based on your query about "${query}", here are relevant health insights and nearby providers who can help.`,
    treatment: `Here is evidence-based information about treatment options for "${query}".`,
    doctor: `Found specialist doctors matching "${query}" along with relevant health information.`,
    lab: `Here are details about the lab tests related to "${query}" and where you can get them done.`,
    general: `Here is general health information related to "${query}".`,
  };

  return {
    intent,
    summary: summaries[intent],
    risk_level: risk,
    recommendations,
    providers,
    articles,
  };
}
