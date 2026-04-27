/**
 * Hard-stop emergency detector. Runs BEFORE the AI for any chat / search /
 * Yukti input — if it triggers, we return a fixed, unmissable 108/112 response
 * without spending an AI call or risking a soft answer.
 *
 * Triggers cover English, Hinglish (Roman-Hindi), and major Indic scripts
 * (Hindi/Marathi Devanagari, Bengali, Tamil, Telugu).
 */
import type { SupportedLanguage } from "./languageDetect";

interface Trigger {
  pattern: RegExp;
  language: SupportedLanguage;
}

const TRIGGERS: Trigger[] = [
  // ── English ──
  { pattern: /\b(chest pain|heart attack|stroke|can'?t breathe|cannot breathe|not breathing|unconscious|fainted|passed out|severe bleeding|bleeding heavily|overdose|poisoning|hanging|drowning)\b/i, language: "en" },
  { pattern: /\b(suicide|kill myself|end my life|want to die|end it all|ending it all|self[- ]?harm)\b/i, language: "en" },
  { pattern: /\b(stab(bed)?|shot|gunshot|knife wound|stroke symptoms|heart attack symptoms)\b/i, language: "en" },

  // ── Hinglish (Roman Hindi) ──
  { pattern: /\b(seena|chhati|chati)\s+(dard|pain)\b/i, language: "hi-Latn" },
  { pattern: /\b(dil\s+ka\s+daura|heart\s+ka\s+attack)\b/i, language: "hi-Latn" },
  { pattern: /\b(sans|saans)\s+(nahi|nahin|ruk|band)\b/i, language: "hi-Latn" },
  { pattern: /\bbehosh(i)?\b/i, language: "hi-Latn" },
  { pattern: /\b(tez|bahut|jyada|zyada)\s+khoon\b/i, language: "hi-Latn" },
  { pattern: /\bkhoon\s+(beh|nikal|aa)/i, language: "hi-Latn" },
  { pattern: /\b(khudkushi|atmahatya|marna chahta|jeena nahi)\b/i, language: "hi-Latn" },

  // ── Hindi / Marathi (Devanagari) ──
  { pattern: /(सीने में दर्द|छाती में दर्द|दिल का दौरा)/, language: "hi" },
  { pattern: /(साँस नहीं|सांस नहीं|दम घुट)/, language: "hi" },
  { pattern: /(बेहोश|बेहोशी|अचेत)/, language: "hi" },
  { pattern: /(खून बह|बहुत खून|खून निकल)/, language: "hi" },
  { pattern: /(खुदकुशी|आत्महत्या|जीना नहीं चाह|मरना चाह)/, language: "hi" },

  // ── Bengali ──
  { pattern: /(বুকে ব্যথা|হার্ট অ্যাটাক|শ্বাস নিতে পার|অজ্ঞান|আত্মহত্যা)/, language: "bn" },

  // ── Tamil ──
  { pattern: /(மார்பு வலி|மாரடைப்பு|மூச்சு விட|சுயமாக|தற்கொலை)/, language: "ta" },

  // ── Telugu ──
  { pattern: /(ఛాతీ నొప్పి|గుండెపోటు|శ్వాస తీసుకో|అపస్మారక|ఆత్మహత్య)/, language: "te" },
];

export interface EmergencyHit {
  matched: true;
  trigger: string;
  language: SupportedLanguage;
}

export function detectEmergency(text: string): EmergencyHit | null {
  if (!text) return null;
  for (const t of TRIGGERS) {
    const m = text.match(t.pattern);
    if (m) return { matched: true, trigger: m[0], language: t.language };
  }
  return null;
}

interface EmergencyResponse {
  intent: "emergency";
  summary: string;
  risk_level: "emergency";
  reply: string;
  recommendations: string[];
  suggested_questions: string[];
  disclaimer: string;
  emergency_numbers: {
    ambulance: string;
    police: string;
    women_helpline: string;
    poison_control: string;
    mental_health_helpline: string;
  };
}

interface LocalizedStrings {
  summary: string;
  reply: string;
  recommendations: string[];
  disclaimer: string;
}

const LOCALIZED: Partial<Record<SupportedLanguage, LocalizedStrings>> = {
  en: {
    summary: "🚨 This sounds like a medical emergency. Please call 108 (ambulance) immediately.",
    reply: "🚨 This is an emergency. Call 108 right now. If you can't call yourself, ask someone nearby to call. Do not leave the person alone.",
    recommendations: [
      "CALL 108 NOW — India's national ambulance service (free)",
      "If you cannot call, ask someone nearby to call for you",
      "Do not leave the person alone",
      "Stay on the line with emergency services",
    ],
    disclaimer: "In emergencies, always call 108 immediately. Do not wait.",
  },
  hi: {
    summary: "🚨 यह एक आपातकालीन स्थिति लगती है। कृपया तुरंत 108 (एम्बुलेंस) पर कॉल करें।",
    reply: "🚨 यह आपातकाल है। तुरंत 108 पर कॉल करें। यदि आप स्वयं कॉल नहीं कर सकते, तो किसी को बुलाएँ। मरीज़ को अकेला न छोड़ें।",
    recommendations: [
      "अभी 108 पर कॉल करें — भारत की राष्ट्रीय एम्बुलेंस सेवा (निःशुल्क)",
      "यदि आप कॉल नहीं कर सकते, तो किसी को कॉल करने के लिए कहें",
      "मरीज़ को अकेला न छोड़ें",
      "आपातकालीन सेवाओं के साथ लाइन पर बने रहें",
    ],
    disclaimer: "आपातकाल में हमेशा तुरंत 108 पर कॉल करें। प्रतीक्षा न करें।",
  },
  "hi-Latn": {
    summary: "🚨 Yeh medical emergency lag rahi hai. Turant 108 (ambulance) par call kariye.",
    reply: "🚨 Yeh emergency hai. Abhi 108 par call kariye. Agar aap khud call nahi kar sakte, kisi ko bula lijiye. Patient ko akele mat chhodiye.",
    recommendations: [
      "ABHI 108 par call kariye — India ki national ambulance service (free)",
      "Agar call nahi kar sakte, kisi paas wale ko call karne ke liye boliye",
      "Patient ko akela mat chhodiye",
      "Emergency services ke saath line par baney rahiye",
    ],
    disclaimer: "Emergency mein hamesha turant 108 par call kariye. Wait mat kariye.",
  },
  bn: {
    summary: "🚨 এটি একটি চিকিৎসা জরুরি অবস্থা মনে হচ্ছে। অবিলম্বে 108 (অ্যাম্বুলেন্স) এ কল করুন।",
    reply: "🚨 এটি জরুরি অবস্থা। এখনই 108 এ কল করুন। যদি আপনি নিজে কল করতে না পারেন, কাউকে ডাকুন।",
    recommendations: [
      "এখনই 108 এ কল করুন — ভারতের জাতীয় অ্যাম্বুলেন্স পরিষেবা (বিনামূল্যে)",
      "কল করতে না পারলে কাউকে ডাকুন",
      "রোগীকে একা ছেড়ে যাবেন না",
    ],
    disclaimer: "জরুরি অবস্থায় সর্বদা অবিলম্বে 108 এ কল করুন।",
  },
  ta: {
    summary: "🚨 இது மருத்துவ அவசரநிலை போல் தெரிகிறது. உடனே 108 ஐ அழைக்கவும்.",
    reply: "🚨 இது அவசரநிலை. இப்போதே 108 ஐ அழைக்கவும். நீங்கள் அழைக்க முடியாவிட்டால் வேறு யாரையாவது அழைக்கச் சொல்லுங்கள்.",
    recommendations: [
      "இப்போதே 108 ஐ அழைக்கவும் — இந்தியாவின் தேசிய ஆம்புலன்ஸ் சேவை (இலவசம்)",
      "அழைக்க முடியாவிட்டால் அருகில் உள்ளவரிடம் கேளுங்கள்",
      "நோயாளியை தனியாக விடாதீர்கள்",
    ],
    disclaimer: "அவசரநிலையில் எப்போதும் உடனே 108 ஐ அழைக்கவும்.",
  },
  te: {
    summary: "🚨 ఇది వైద్య అత్యవసర పరిస్థితిలా ఉంది. వెంటనే 108 కు ఫోన్ చేయండి.",
    reply: "🚨 ఇది అత్యవసరం. ఇప్పుడే 108 కు ఫోన్ చేయండి. మీరు ఫోన్ చేయలేకపోతే, ఎవరినైనా అడగండి.",
    recommendations: [
      "ఇప్పుడే 108 కు ఫోన్ చేయండి — భారతదేశ జాతీయ అంబులెన్స్ సేవ (ఉచితం)",
      "ఫోన్ చేయలేకపోతే దగ్గరలోని వారిని అడగండి",
      "రోగిని ఒంటరిగా వదలవద్దు",
    ],
    disclaimer: "అత్యవసర పరిస్థితుల్లో ఎల్లప్పుడూ వెంటనే 108 కు ఫోన్ చేయండి.",
  },
};

export function buildEmergencyResponse(language: SupportedLanguage = "en"): EmergencyResponse {
  const strings = LOCALIZED[language] ?? LOCALIZED.en!;
  return {
    intent: "emergency",
    summary: strings.summary,
    risk_level: "emergency",
    reply: strings.reply,
    recommendations: strings.recommendations,
    suggested_questions: [],
    disclaimer: strings.disclaimer,
    emergency_numbers: {
      ambulance: "108",
      police: "100",
      women_helpline: "1091",
      poison_control: "1800-116-117",
      mental_health_helpline: "1800-599-0019",
    },
  };
}
