import { db } from ".";
import { communitiesTable } from "./schema";

const communities = [
  // Core Health
  { name: "Heart Health", slug: "heart-health", description: "Hypertension, chest pain, and heart disease prevention. Connect with others managing cardiac conditions and lifestyle changes.", iconEmoji: "🫀", coverColor: "#ef4444", category: "core" },
  { name: "Mental Wellness", slug: "mental-wellness", description: "Stress, anxiety, depression, and burnout. A safe space for coping strategies, therapy experiences, and emotional well-being.", iconEmoji: "🧠", coverColor: "#8b5cf6", category: "core" },
  { name: "Diabetes Care", slug: "diabetes-care", description: "Managing Type 1, Type 2, and prediabetes. Discuss diet, sugar control, medications, and lifestyle adaptations.", iconEmoji: "🩺", coverColor: "#f59e0b", category: "core" },
  { name: "Thyroid & Hormonal Health", slug: "thyroid-hormonal", description: "Thyroid disorders, PCOS, and hormonal imbalance. Support for weight, cycle irregularities, and hormone management.", iconEmoji: "🧬", coverColor: "#06b6d4", category: "core" },
  { name: "Bone & Joint Health", slug: "bone-joint-health", description: "Arthritis, back pain, and sports injuries. Discussions on pain relief, physiotherapy, and mobility improvements.", iconEmoji: "🦴", coverColor: "#64748b", category: "core" },
  // Women-Centric
  { name: "Pregnancy & Motherhood", slug: "pregnancy-motherhood", description: "Pregnancy journey, postpartum care, and baby health. A supportive community for expecting and new mothers.", iconEmoji: "🤰", coverColor: "#ec4899", category: "women" },
  { name: "PCOS & Women's Health", slug: "pcos-womens-health", description: "PCOS, irregular cycles, fertility, and emotional health. Lifestyle and treatment guidance for women aged 18–40.", iconEmoji: "🌸", coverColor: "#f43f5e", category: "women" },
  { name: "Fertility & IVF Support", slug: "fertility-ivf", description: "Trying to conceive and IVF journeys. Emotional support, clinic reviews, and success stories for couples facing fertility challenges.", iconEmoji: "🧫", coverColor: "#a855f7", category: "women" },
  // Family & Life Stage
  { name: "Child Health", slug: "child-health", description: "Infant and child care for parents. Fever management, nutrition, growth milestones, and pediatric health questions.", iconEmoji: "👶", coverColor: "#22c55e", category: "family" },
  { name: "Elder Care", slug: "elder-care", description: "Caring for aging parents and managing chronic diseases. Medication, mobility, and home care guidance for families.", iconEmoji: "👴", coverColor: "#78716c", category: "family" },
  // Lifestyle & Preventive
  { name: "Weight Loss & Fitness", slug: "weight-loss-fitness", description: "Tackling obesity and fitness journeys together. Diet plans, workout routines, and motivation for all age groups.", iconEmoji: "⚖️", coverColor: "#10b981", category: "lifestyle" },
  { name: "Nutrition & Diet", slug: "nutrition-diet", description: "Healthy eating, special diets, and nutritional deficiencies. Meal plans and food science for health-conscious members.", iconEmoji: "🥗", coverColor: "#84cc16", category: "lifestyle" },
  { name: "Sleep & Recovery", slug: "sleep-recovery", description: "Insomnia, sleep disorders, and recovery strategies. Sleep hygiene tips and treatment discussions for better rest.", iconEmoji: "😴", coverColor: "#6366f1", category: "lifestyle" },
  // Condition-Specific
  { name: "Respiratory Health", slug: "respiratory-health", description: "Asthma, allergies, and breathing issues. Expert discussions and peer support for respiratory conditions.", iconEmoji: "🫁", coverColor: "#0ea5e9", category: "condition" },
  { name: "Cancer Support", slug: "cancer-support", description: "Oncology journeys and caregiver support. A highly moderated, sensitive space for those navigating cancer.", iconEmoji: "🧪", coverColor: "#dc2626", category: "condition" },
  { name: "Infectious Diseases", slug: "infectious-diseases", description: "Viral infections, seasonal diseases, and outbreak awareness. High-traffic community during disease seasons.", iconEmoji: "🦠", coverColor: "#16a34a", category: "condition" },
  // Modern Problems
  { name: "Work Stress & Burnout", slug: "work-stress-burnout", description: "Corporate stress and work-life balance. Highly relatable discussions on managing burnout and mental fatigue.", iconEmoji: "💻", coverColor: "#f97316", category: "modern" },
  { name: "Digital Health & Screen Impact", slug: "digital-health", description: "Eye strain, posture problems, and mental fatigue from screens. Modern health challenges for digital natives.", iconEmoji: "📱", coverColor: "#3b82f6", category: "modern" },
  // Special Interest
  { name: "Alternative Medicine", slug: "alternative-medicine", description: "Ayurveda, Yoga, and traditional healing practices. Important for the Indian wellness market.", iconEmoji: "🧘", coverColor: "#f59e0b", category: "special" },
  { name: "Neurology & Brain Health", slug: "neurology-brain", description: "Migraine, epilepsy, memory issues, and cognitive health. Peer support and clinical discussions on neurological conditions.", iconEmoji: "🧠", coverColor: "#7c3aed", category: "special" },
];

async function seedCommunities() {
  console.log("Seeding 20 health communities...");
  for (const c of communities) {
    const { category: _cat, ...vals } = c;
    await db.insert(communitiesTable).values(vals).onConflictDoNothing();
  }
  console.log(`Inserted ${communities.length} communities.`);
}

seedCommunities().catch(console.error).finally(() => process.exit(0));
