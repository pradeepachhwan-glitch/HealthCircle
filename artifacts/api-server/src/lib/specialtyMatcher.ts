// Lightweight, typo-tolerant inference from a free-text query to a canonical
// medical specialty name. Used by the provider search so users typing
// "cardilogist", "skin doc", "ear nose throat" still surface the right
// specialists. Returns null when no confident match.
//
// We match on a leading-prefix regex first (cheap), then fall back to a
// keyword-includes check. Keep the order: more specific phrases before
// generic ones (e.g. "general physician" before "physician").

const SPECIALTY_RULES: Array<{ canonical: string; patterns: RegExp[] }> = [
  { canonical: "Cardiologist", patterns: [/\bcard(io|il|i|ia)/i, /\bheart\b/i] },
  { canonical: "Orthopedic Surgeon", patterns: [/\bortho/i, /\bbone\b/i, /\bjoint\b/i] },
  { canonical: "Dermatologist", patterns: [/\bderm/i, /\bskin\b/i, /\bacne\b/i] },
  { canonical: "Gynecologist", patterns: [/\bgyna?ec/i, /\bobstet/i, /\bobgyn\b/i] },
  { canonical: "Neurologist", patterns: [/\bneuro/i, /\bnerve\b/i, /\bbrain\b/i] },
  { canonical: "Pulmonologist", patterns: [/\bpulm/i, /\blung/i, /\bchest\b/i, /\basthma\b/i] },
  { canonical: "Endocrinologist", patterns: [/\bendoc/i, /\bdiabet/i, /\bthyroid/i, /\bhormone/i] },
  { canonical: "Pediatrician", patterns: [/\bpediat/i, /\bpaediat/i, /\bchild(ren)?\b/i, /\bbaby\b/i] },
  { canonical: "Psychiatrist", patterns: [/\bpsychiat/i, /\bmental\s*health\b/i, /\bdepress/i, /\banxiety\b/i] },
  { canonical: "ENT Specialist", patterns: [/\bent\b/i, /\bear\b/i, /\bnose\b/i, /\bthroat\b/i, /\botola/i] },
  { canonical: "Urologist", patterns: [/\burolo/i, /\bkidney\b/i, /\bbladder\b/i] },
  { canonical: "Oncologist", patterns: [/\boncolo/i, /\bcancer\b/i, /\btumou?r/i] },
  { canonical: "Dentist", patterns: [/\bdent/i, /\btooth\b/i, /\bteeth\b/i] },
  { canonical: "Ophthalmologist", patterns: [/\bopthal/i, /\bophthal/i, /\beye\b/i, /\bvision\b/i] },
  { canonical: "Gastroenterologist", patterns: [/\bgastro/i, /\bstomach\b/i, /\bdigest/i] },
  { canonical: "Nephrologist", patterns: [/\bnephro/i] },
  { canonical: "Rheumatologist", patterns: [/\brheum/i, /\barthrit/i] },
  { canonical: "General Physician", patterns: [/\bgeneral\s*phys/i, /\bphysician\b/i, /\bgp\b/i, /\bfamily\s*doc/i] },
];

export function inferSpecialty(query: string | undefined | null): string | null {
  if (!query) return null;
  const q = query.trim();
  if (!q) return null;
  for (const rule of SPECIALTY_RULES) {
    for (const re of rule.patterns) {
      if (re.test(q)) return rule.canonical;
    }
  }
  return null;
}
