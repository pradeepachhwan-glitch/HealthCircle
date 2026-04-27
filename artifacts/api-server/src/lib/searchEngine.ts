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
  mapQuery: string;
  googleSearchUrl: string;
  trustedLinks: TrustedLink[];
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

interface TrustedLink {
  title: string;
  source: string;
  url: string;
  icon: string;
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

function getMapQuery(intent: SearchIntent, query: string): string {
  switch (intent) {
    case "doctor": return `${query} doctor hospital near me`;
    case "lab": return `diagnostic lab pathology near me`;
    case "symptom": return `doctor clinic hospital near me`;
    case "treatment": return `hospital specialist clinic near me`;
    default: return `doctor hospital clinic near me`;
  }
}

function getTrustedLinks(intent: SearchIntent, query: string): TrustedLink[] {
  const encoded = encodeURIComponent(query);
  const links: TrustedLink[] = [
    {
      title: `Search "${query}" on 1mg`,
      source: "1mg",
      url: `https://www.1mg.com/search/all?name=${encoded}`,
      icon: "💊",
    },
    {
      title: `Find doctors for "${query}" on Practo`,
      source: "Practo",
      url: `https://www.practo.com/search/doctors?results_type=doctor&q=${encoded}`,
      icon: "🩺",
    },
  ];

  if (intent === "symptom" || intent === "general") {
    links.push({
      title: `${query} — National Health Portal India`,
      source: "NHP India",
      url: `https://www.nhp.gov.in/search?q=${encoded}`,
      icon: "🏥",
    });
  }
  if (intent === "lab") {
    links.push({
      title: `Book "${query}" lab test — Dr Lal PathLabs`,
      source: "Dr Lal PathLabs",
      url: `https://www.lalpathlabs.com/search?q=${encoded}`,
      icon: "🔬",
    });
  }
  links.push({
    title: `Search "${query}" health articles`,
    source: "Google Health",
    url: `https://www.google.com/search?q=${encoded}+health+india+treatment`,
    icon: "🔍",
  });
  return links;
}

export async function runHealthSearch(query: string, userId?: number, language?: string): Promise<SearchResult> {
  const intent = classifyIntent(query);
  const risk = assessRisk(query, intent);
  const recommendations = getRecommendations(intent, risk);
  const mapQuery = getMapQuery(intent, query);
  const trustedLinks = getTrustedLinks(intent, query);
  const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(query + " health india")}`;

  const searchTerms = query.split(" ").filter(t => t.length > 2);
  const searchConditions = searchTerms.map(term => ilike(doctorsTable.specialty, `%${term}%`));

  let providers: ProviderResult[] = [];
  try {
    if ((intent === "doctor" || intent === "symptom") && searchConditions.length > 0) {
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
          ilike(hospitalsTable.location, `%${query}%`)
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
    // Provider search gracefully fails
  }

  if (userId) {
    try {
      await db.insert(searchLogsTable).values({ userId, query, intent, language: language ?? "en" });
    } catch {
      // Log gracefully fails
    }
  }

  const summaries: Record<SearchIntent, string> = {
    symptom: `Based on your query about "${query}", here are AI health insights and nearby care options to help you.`,
    treatment: `Here is evidence-based information about treatment options for "${query}".`,
    doctor: `Here are specialist doctors and hospitals for "${query}" along with nearby care options.`,
    lab: `Here are details about the lab tests related to "${query}" and where you can get them done nearby.`,
    general: `Here is health information related to "${query}" along with nearby care options.`,
  };

  return {
    intent,
    summary: summaries[intent],
    risk_level: risk,
    recommendations,
    providers,
    mapQuery,
    googleSearchUrl,
    trustedLinks,
  };
}
