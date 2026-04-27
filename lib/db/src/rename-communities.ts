import { db } from ".";
import { communitiesTable } from "./schema";
import { eq } from "drizzle-orm";

const renames: { slug: string; name: string; description: string }[] = [
  { slug: "heart-health", name: "Heart Circle", description: "Care for your heart, every day. Hypertension, chest pain, heart disease prevention and lifestyle support." },
  { slug: "mental-wellness", name: "Mind Space", description: "Talk it out. Feel lighter. A safe space for stress, anxiety, depression, and burnout support." },
  { slug: "diabetes-care", name: "Sugar Care", description: "Control your sugar, control your life. Managing Type 1, Type 2, and prediabetes together." },
  { slug: "thyroid-hormonal", name: "Hormone Hub", description: "Balance from within. Thyroid disorders, PCOS, and hormonal health discussions." },
  { slug: "bone-joint-health", name: "Move Easy", description: "Live pain-free, move freely. Arthritis, back pain, physiotherapy, and joint health." },
  { slug: "pregnancy-motherhood", name: "Mom Journey", description: "From bump to baby and beyond. Pregnancy, postpartum care, and early motherhood support." },
  { slug: "pcos-womens-health", name: "Cycle Sync", description: "Understand your body better. PCOS, irregular cycles, fertility, and women's hormonal health." },
  { slug: "fertility-ivf", name: "Hope & Fertility", description: "You're not alone in this journey. IVF support, fertility guidance, and community for couples." },
  { slug: "child-health", name: "Little Care", description: "Because every child matters. Infant and child health, nutrition, growth milestones for parents." },
  { slug: "elder-care", name: "Elder Care Circle", description: "Caring for those who cared for us. Chronic disease, mobility, and home care for aging parents." },
  { slug: "weight-loss-fitness", name: "Fit Life", description: "Your fitness, your pace. Weight loss journeys, workout plans, and motivation for all ages." },
  { slug: "nutrition-diet", name: "Eat Right", description: "Simple food, better health. Healthy eating, meal plans, and nutritional guidance." },
  { slug: "sleep-recovery", name: "Sleep Better", description: "Rest. Recover. Reset. Insomnia, sleep disorders, and recovery strategies." },
  { slug: "respiratory-health", name: "Breathe Easy", description: "Better breathing, better living. Asthma, allergies, and respiratory health support." },
  { slug: "cancer-support", name: "Cancer Support Circle", description: "Strength together. A moderated, compassionate space for oncology journeys and caregivers." },
  { slug: "infectious-diseases", name: "Infection Care", description: "Stay informed, stay safe. Viral infections, seasonal diseases, and outbreak awareness." },
  { slug: "work-stress-burnout", name: "Work Reset", description: "Beat burnout, regain balance. Corporate stress, work-life balance, and mental recovery." },
  { slug: "digital-health", name: "Screen Health", description: "Protect your eyes and mind. Eye strain, posture problems, and screen fatigue solutions." },
  { slug: "alternative-medicine", name: "Natural Healing", description: "Traditional wisdom, modern life. Ayurveda, Yoga, and natural healing practices." },
  { slug: "neurology-brain", name: "Brain Matters", description: "Because your mind matters. Migraine, epilepsy, memory issues, and neurological health." },
];

async function renameCommunities() {
  console.log("Renaming communities to friendly names...");
  for (const r of renames) {
    await db.update(communitiesTable)
      .set({ name: r.name, description: r.description })
      .where(eq(communitiesTable.slug, r.slug));
    console.log(`  ✓ ${r.slug} → ${r.name}`);
  }
  console.log("Done.");
}

renameCommunities().catch(console.error).finally(() => process.exit(0));
