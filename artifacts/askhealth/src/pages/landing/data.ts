import mindSpaceImg from "@/assets/community-mind-space.png";
import sugarCareImg from "@/assets/community-sugar-care.png";
import momJourneyImg from "@/assets/community-mom-journey.png";
import workResetImg from "@/assets/community-work-reset.png";
import fitLifeImg from "@/assets/community-fit-life.png";
import heartCircleImg from "@/assets/community-heart-circle.png";

export const COMMUNITIES_PREVIEW = [
  { img: mindSpaceImg, name: "Mind Space", desc: "Talk, share, heal", tag: "Mental Wellness", slug: "mental-wellness", accent: "from-teal-50 to-cyan-50" },
  { img: sugarCareImg, name: "Sugar Care", desc: "Manage diabetes better", tag: "Diabetes", slug: "diabetes-care", accent: "from-rose-50 to-orange-50" },
  { img: momJourneyImg, name: "Mom Journey", desc: "Pregnancy to parenting", tag: "Motherhood", slug: "pregnancy-motherhood", accent: "from-pink-50 to-purple-50" },
  { img: workResetImg, name: "Work Reset", desc: "Beat stress & burnout", tag: "Work Wellness", slug: "work-stress-burnout", accent: "from-blue-50 to-sky-50" },
  { img: fitLifeImg, name: "Fit Life", desc: "Fitness your way", tag: "Fitness", slug: "weight-loss-fitness", accent: "from-green-50 to-emerald-50" },
  { img: heartCircleImg, name: "Heart Circle", desc: "Care for your heart", tag: "Cardiology", slug: "heart-health", accent: "from-red-50 to-rose-50" },
];

export const HOW_IT_WORKS = [
  { step: "1", title: "Ask your question", desc: "Type what's on your mind. No medical jargon required." },
  { step: "2", title: "Get AI clarity", desc: "Yukti summarises evidence, flags risk, and suggests next steps." },
  { step: "3", title: "Hear from real people", desc: "Join the right community and read what others lived through." },
  { step: "4", title: "Talk to a doctor", desc: "Book a verified specialist if Yukti or your community recommends it." },
];

export const NAV_ITEMS: { label: string; href: string }[] = [
  { label: "Solutions", href: "/solutions" },
  { label: "For Doctors", href: "/for-doctors" },
  { label: "About", href: "/about" },
  { label: "Support", href: "/support" },
];
