import { db } from ".";
import { doctorsTable, hospitalsTable } from "./schema";

const doctors = [
  { name: "Dr. Priya Sharma", specialty: "Cardiologist", experienceYears: 14, consultationFee: "1200", rating: "4.9", location: "Mumbai, Maharashtra", bio: "Senior interventional cardiologist with expertise in minimally invasive procedures.", languages: ["en", "hi"], available: true },
  { name: "Dr. Rahul Mehta", specialty: "Orthopedic Surgeon", experienceYears: 10, consultationFee: "900", rating: "4.7", location: "Delhi, NCR", bio: "Specializes in joint replacement and sports injuries.", languages: ["en", "hi"], available: true },
  { name: "Dr. Ananya Krishnan", specialty: "Dermatologist", experienceYears: 8, consultationFee: "800", rating: "4.8", location: "Bengaluru, Karnataka", bio: "Cosmetic and clinical dermatology, hair loss treatments.", languages: ["en"], available: true },
  { name: "Dr. Mohammed Farooq", specialty: "General Physician", experienceYears: 18, consultationFee: "500", rating: "4.6", location: "Hyderabad, Telangana", bio: "Primary care physician, chronic disease management.", languages: ["en", "hi"], available: true },
  { name: "Dr. Sunita Patel", specialty: "Gynecologist", experienceYears: 12, consultationFee: "1000", rating: "4.9", location: "Ahmedabad, Gujarat", bio: "High-risk pregnancy, laparoscopic surgeries, women's health.", languages: ["en", "hi", "gu"], available: true },
  { name: "Dr. Kiran Rao", specialty: "Neurologist", experienceYears: 16, consultationFee: "1500", rating: "4.8", location: "Chennai, Tamil Nadu", bio: "Epilepsy, stroke, movement disorders.", languages: ["en", "ta"], available: true },
  { name: "Dr. Deepak Gupta", specialty: "Pulmonologist", experienceYears: 11, consultationFee: "850", rating: "4.5", location: "Pune, Maharashtra", bio: "Asthma, COPD, sleep disorders, respiratory medicine.", languages: ["en", "hi"], available: false },
  { name: "Dr. Lakshmi Iyer", specialty: "Endocrinologist", experienceYears: 9, consultationFee: "950", rating: "4.7", location: "Bengaluru, Karnataka", bio: "Diabetes management, thyroid disorders, hormonal health.", languages: ["en", "ta"], available: true },
];

const hospitals = [
  { name: "Apollo Hospitals", location: "Mumbai, Maharashtra", specialties: ["Cardiology", "Oncology", "Neurology", "Orthopedics"], rating: "4.8", phone: "+91-22-2671-0000", website: "https://www.apollohospitals.com" },
  { name: "Fortis Healthcare", location: "Delhi, NCR", specialties: ["Cardiology", "Transplants", "Oncology", "Pediatrics"], rating: "4.7", phone: "+91-11-4277-6222", website: "https://www.fortishealthcare.com" },
  { name: "Manipal Hospitals", location: "Bengaluru, Karnataka", specialties: ["Oncology", "Neurology", "Orthopedics", "Dermatology"], rating: "4.6", phone: "+91-80-2502-4444", website: "https://www.manipalhospitals.com" },
  { name: "AIIMS Delhi", location: "Delhi, NCR", specialties: ["All Specialties", "Research", "Trauma", "Burns"], rating: "4.9", phone: "+91-11-2658-8500", website: "https://www.aiims.edu" },
  { name: "Medanta - The Medicity", location: "Gurugram, Haryana", specialties: ["Cardiology", "Robotic Surgery", "Transplants"], rating: "4.8", phone: "+91-124-4141-414", website: "https://www.medanta.org" },
  { name: "Narayana Health", location: "Bengaluru, Karnataka", specialties: ["Cardiac Surgery", "Oncology", "Nephrology"], rating: "4.7", phone: "+91-80-7122-2000", website: "https://www.narayanahealth.org" },
];

async function seedProviders() {
  console.log("Seeding doctors...");
  for (const doc of doctors) {
    await db.insert(doctorsTable).values(doc).onConflictDoNothing();
  }
  console.log(`Inserted ${doctors.length} doctors`);

  console.log("Seeding hospitals...");
  for (const hosp of hospitals) {
    await db.insert(hospitalsTable).values(hosp).onConflictDoNothing();
  }
  console.log(`Inserted ${hospitals.length} hospitals`);
  console.log("Provider seeding complete.");
}

seedProviders().catch(console.error).finally(() => process.exit(0));
