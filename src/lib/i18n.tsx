import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "en" | "hi" | "ta";

const DICT: Record<Lang, Record<string, string>> = {
  en: {
    dashboard: "Dashboard",
    calendar: "Calendar",
    transactions: "Transactions",
    assistant: "AI Assistant",
    insights: "Insights",
    budget: "Budget",
    anomalies: "Anomalies",
    monitor: "Live Monitor",
    alerts: "Alerts",
    settings: "Settings",
    smartsave: "SmartSave Journey",
    livesync: "Incoming Transactions",
    moneyleaks: "Money Leak Detector",
    simulator: "Future Simulator",
    language: "Language",
    total_spending: "Total Spending",
    transactions_count: "Transactions",
    financial_health: "Financial Health",
    merchant_breakdown: "Merchant Breakdown",
    category_breakdown: "Category Breakdown",
    ai_insight: "AI Insight",
    ai_recommendation: "AI Recommendation",
    monthly_overview: "Monthly Overview",
    ai_monthly_summary: "AI Monthly Summary",
    ai_budget_coach: "AI Budget Coach",
    allocated: "Allocated",
    spent: "Spent",
    remaining: "Remaining",
    on_track: "On Track",
    near_limit: "Near Limit",
    exceeded: "Budget Exceeded",
    normal: "Normal",
    warning: "Warning",
    high_spending: "High Spending",
    unusual: "Unusual Transaction",
    strengths: "Strengths",
    needs_improvement: "Needs Improvement",
    how_to_reach: "How to Reach 85+",
    potential_monthly: "Potential Monthly Saving",
    potential_annual: "Potential Annual Saving",
    simulate: "Simulate",
    reset: "Reset",
  },
  hi: {
    dashboard: "डैशबोर्ड",
    calendar: "कैलेंडर",
    transactions: "लेन-देन",
    assistant: "एआई सहायक",
    insights: "इनसाइट्स",
    budget: "बजट",
    anomalies: "असामान्यताएं",
    monitor: "लाइव मॉनिटर",
    alerts: "अलर्ट",
    settings: "सेटिंग्स",
    smartsave: "स्मार्टसेव यात्रा",
    livesync: "नए लेन-देन",
    moneyleaks: "पैसा रिसाव डिटेक्टर",
    simulator: "भविष्य सिम्युलेटर",
    language: "भाषा",
    total_spending: "कुल खर्च",
    transactions_count: "लेन-देन",
    financial_health: "वित्तीय स्वास्थ्य",
    merchant_breakdown: "मर्चेंट विवरण",
    category_breakdown: "श्रेणी विवरण",
    ai_insight: "एआई अंतर्दृष्टि",
    ai_recommendation: "एआई सिफारिश",
    monthly_overview: "मासिक अवलोकन",
    ai_monthly_summary: "एआई मासिक सारांश",
    ai_budget_coach: "एआई बजट कोच",
    allocated: "आवंटित",
    spent: "खर्च",
    remaining: "बाकी",
    on_track: "सही रास्ते पर",
    near_limit: "सीमा के पास",
    exceeded: "बजट पार",
    normal: "सामान्य",
    warning: "चेतावनी",
    high_spending: "अधिक खर्च",
    unusual: "असामान्य लेन-देन",
    strengths: "मजबूतियां",
    needs_improvement: "सुधार की आवश्यकता",
    how_to_reach: "85+ तक कैसे पहुंचें",
    potential_monthly: "संभावित मासिक बचत",
    potential_annual: "संभावित वार्षिक बचत",
    simulate: "सिम्युलेट",
    reset: "रीसेट",
  },
  ta: {
    dashboard: "டாஷ்போர்டு",
    calendar: "காலண்டர்",
    transactions: "பரிவர்த்தனைகள்",
    assistant: "AI உதவியாளர்",
    insights: "நுண்ணறிவுகள்",
    budget: "பட்ஜெட்",
    anomalies: "முரண்பாடுகள்",
    monitor: "நேரடி கண்காணிப்பு",
    alerts: "எச்சரிக்கைகள்",
    settings: "அமைப்புகள்",
    smartsave: "ஸ்மார்ட்சேவ் பயணம்",
    livesync: "புதிய பரிவர்த்தனைகள்",
    moneyleaks: "பணக் கசிவு கண்டறிதல்",
    simulator: "எதிர்கால சிமுலேட்டர்",
    language: "மொழி",
    total_spending: "மொத்த செலவு",
    transactions_count: "பரிவர்த்தனைகள்",
    financial_health: "நிதி ஆரோக்கியம்",
    merchant_breakdown: "வணிக விவரம்",
    category_breakdown: "வகை விவரம்",
    ai_insight: "AI நுண்ணறிவு",
    ai_recommendation: "AI பரிந்துரை",
    monthly_overview: "மாதாந்திர கண்ணோட்டம்",
    ai_monthly_summary: "AI மாதாந்திர சுருக்கம்",
    ai_budget_coach: "AI பட்ஜெட் பயிற்சியாளர்",
    allocated: "ஒதுக்கப்பட்டது",
    spent: "செலவழிக்கப்பட்டது",
    remaining: "மீதம்",
    on_track: "பாதையில்",
    near_limit: "வரம்பிற்கு அருகில்",
    exceeded: "பட்ஜெட் மீறியது",
    normal: "இயல்பானது",
    warning: "எச்சரிக்கை",
    high_spending: "அதிக செலவு",
    unusual: "வழக்கத்திற்கு மாறான பரிவர்த்தனை",
    strengths: "வலிமைகள்",
    needs_improvement: "மேம்பாடு தேவை",
    how_to_reach: "85+ ஐ எப்படி அடைவது",
    potential_monthly: "சாத்தியமான மாத சேமிப்பு",
    potential_annual: "சாத்தியமான ஆண்டு சேமிப்பு",
    simulate: "சிமுலேட்",
    reset: "மீட்டமை",
  },
};

type I18nCtx = { lang: Lang; setLang: (l: Lang) => void; t: (k: string) => string };
const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    try {
      const s = localStorage.getItem("finguard.lang");
      if (s === "en" || s === "hi" || s === "ta") setLangState(s);
    } catch {}
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("finguard.lang", l); } catch {}
  };
  const value = useMemo<I18nCtx>(() => ({
    lang,
    setLang,
    t: (k: string) => DICT[lang][k] ?? DICT.en[k] ?? k,
  }), [lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const c = useContext(Ctx);
  if (!c) return { lang: "en" as Lang, setLang: () => {}, t: (k: string) => DICT.en[k] ?? k };
  return c;
}

export const LANGUAGES: { code: Lang; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
];
