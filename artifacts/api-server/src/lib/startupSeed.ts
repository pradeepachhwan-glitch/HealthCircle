import { db, communitiesTable } from "@workspace/db";
import { logger } from "./logger";

const HEALTH_COMMUNITIES = [
  { name: "Heart Circle",          slug: "heart-health",          description: "Care for your heart, every day. Hypertension, chest pain, heart disease prevention and lifestyle support.",                          iconEmoji: "🫀", coverColor: "#ef4444" },
  { name: "Mind Space",            slug: "mental-wellness",       description: "Talk it out. Feel lighter. A safe space for stress, anxiety, depression, and burnout support.",                                     iconEmoji: "🧠", coverColor: "#8b5cf6" },
  { name: "Sugar Care",            slug: "diabetes-care",         description: "Control your sugar, control your life. Managing Type 1, Type 2, and prediabetes together.",                                          iconEmoji: "🩺", coverColor: "#f59e0b" },
  { name: "Hormone Hub",           slug: "thyroid-hormonal",      description: "Balance from within. Thyroid disorders, PCOS, and hormonal health discussions.",                                                     iconEmoji: "🧬", coverColor: "#06b6d4" },
  { name: "Move Easy",             slug: "bone-joint-health",     description: "Live pain-free, move freely. Arthritis, back pain, physiotherapy, and joint health.",                                               iconEmoji: "🦴", coverColor: "#64748b" },
  { name: "Mom Journey",           slug: "pregnancy-motherhood",  description: "From bump to baby and beyond. Pregnancy, postpartum care, and early motherhood support.",                                            iconEmoji: "🤰", coverColor: "#ec4899" },
  { name: "Cycle Sync",            slug: "pcos-womens-health",    description: "Understand your body better. PCOS, irregular cycles, fertility, and women's hormonal health.",                                      iconEmoji: "🌸", coverColor: "#f43f5e" },
  { name: "Hope & Fertility",      slug: "fertility-ivf",         description: "You're not alone in this journey. IVF support, fertility guidance, and community for couples.",                                     iconEmoji: "🧫", coverColor: "#a855f7" },
  { name: "Little Care",           slug: "child-health",          description: "Because every child matters. Infant and child health, nutrition, growth milestones for parents.",                                   iconEmoji: "👶", coverColor: "#22c55e" },
  { name: "Elder Care Circle",     slug: "elder-care",            description: "Caring for those who cared for us. Chronic disease, mobility, and home care for aging parents.",                                    iconEmoji: "👴", coverColor: "#78716c" },
  { name: "Fit Life",              slug: "weight-loss-fitness",   description: "Your fitness, your pace. Weight loss journeys, workout plans, and motivation for all ages.",                                        iconEmoji: "⚖️", coverColor: "#10b981" },
  { name: "Eat Right",             slug: "nutrition-diet",        description: "Simple food, better health. Healthy eating, meal plans, and nutritional guidance.",                                                 iconEmoji: "🥗", coverColor: "#84cc16" },
  { name: "Sleep Better",          slug: "sleep-recovery",        description: "Rest. Recover. Reset. Insomnia, sleep disorders, and recovery strategies.",                                                          iconEmoji: "😴", coverColor: "#6366f1" },
  { name: "Breathe Easy",          slug: "respiratory-health",    description: "Better breathing, better living. Asthma, allergies, and respiratory health support.",                                                iconEmoji: "🫁", coverColor: "#0ea5e9" },
  { name: "Cancer Support Circle", slug: "cancer-support",        description: "Strength together. A moderated, compassionate space for oncology journeys and caregivers.",                                         iconEmoji: "🧪", coverColor: "#dc2626" },
  { name: "Infection Care",        slug: "infectious-diseases",   description: "Stay informed, stay safe. Viral infections, seasonal diseases, and outbreak awareness.",                                            iconEmoji: "🦠", coverColor: "#16a34a" },
  { name: "Work Reset",            slug: "work-stress-burnout",   description: "Beat burnout, regain balance. Corporate stress, work-life balance, and mental recovery.",                                            iconEmoji: "💻", coverColor: "#f97316" },
  { name: "Screen Health",         slug: "digital-health",        description: "Protect your eyes and mind. Eye strain, posture problems, and screen fatigue solutions.",                                           iconEmoji: "📱", coverColor: "#3b82f6" },
  { name: "Natural Healing",       slug: "alternative-medicine",  description: "Traditional wisdom, modern life. Ayurveda, Yoga, and natural healing practices.",                                                    iconEmoji: "🧘", coverColor: "#f59e0b" },
  { name: "Brain Matters",         slug: "neurology-brain",       description: "Because your mind matters. Migraine, epilepsy, memory issues, and neurological health.",                                            iconEmoji: "🧠", coverColor: "#7c3aed" },
];

/**
 * Idempotently ensure the standard set of health communities exists.
 * Runs at server startup so production databases self-heal after deploy.
 * Uses ON CONFLICT DO NOTHING — never overwrites an admin's customisation.
 */
export async function ensureHealthCommunities(): Promise<void> {
  try {
    let inserted = 0;
    for (const c of HEALTH_COMMUNITIES) {
      const result = await db
        .insert(communitiesTable)
        .values(c)
        .onConflictDoNothing({ target: communitiesTable.slug })
        .returning({ id: communitiesTable.id });
      if (result.length) inserted += 1;
    }
    if (inserted > 0) {
      logger.info({ inserted }, "startupSeed: inserted missing health communities");
    } else {
      logger.info("startupSeed: all health communities already present");
    }
  } catch (err) {
    logger.warn({ err }, "startupSeed: ensureHealthCommunities failed (non-fatal)");
  }
}
