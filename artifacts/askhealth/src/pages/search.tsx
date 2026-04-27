import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Search as SearchIcon, AlertTriangle, CheckCircle, Activity,
  Stethoscope, Building2, ExternalLink, ChevronRight, MapPin, Sparkles
} from "lucide-react";
import { Link } from "wouter";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface SearchResult {
  intent: string;
  summary: string;
  risk_level: "low" | "medium" | "high";
  recommendations: string[];
  providers: {
    id: number;
    type: "doctor" | "hospital";
    name: string;
    specialty?: string;
    location: string;
    rating: string;
    available?: boolean;
  }[];
  articles: { title: string; source: string; url: string }[];
}

const RISK_META = {
  low: { color: "text-emerald-700 bg-emerald-50 border-emerald-200", icon: CheckCircle, label: "Low Risk" },
  medium: { color: "text-amber-700 bg-amber-50 border-amber-200", icon: Activity, label: "Medium Risk" },
  high: { color: "text-red-700 bg-red-50 border-red-200", icon: AlertTriangle, label: "High Risk — Seek Care" },
};

const TRENDING = [
  "fever and body ache", "diabetes management", "back pain relief",
  "anxiety and stress", "high blood pressure", "find cardiologist",
];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function doSearch(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setSubmittedQuery(trimmed);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/health-search?q=${encodeURIComponent(trimmed)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Search failed");
      setResult(await res.json());
    } catch {
      setError("Search unavailable. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") doSearch(query);
  }

  const riskMeta = result ? RISK_META[result.risk_level] : null;
  const RiskIcon = riskMeta?.icon;

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className={`mx-auto px-4 transition-all duration-300 ${submittedQuery ? "max-w-3xl pt-6" : "max-w-2xl pt-24"}`}>

          {/* Logo / Title */}
          {!submittedQuery && (
            <div className="text-center mb-8">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-7 h-7 text-primary" />
              </div>
              <h1 className="text-3xl font-bold text-slate-900 mb-1">HealthCircle Search</h1>
              <p className="text-slate-500 text-sm">AI-powered health answers + nearby doctors & hospitals</p>
            </div>
          )}

          {/* Search bar */}
          <div className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Search symptoms, conditions, doctors, treatments..."
              className="pl-12 pr-28 h-14 text-base rounded-2xl shadow-md border-slate-200 focus-visible:ring-primary/30 bg-white"
            />
            <Button
              onClick={() => doSearch(query)}
              disabled={loading || !query.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-10 px-5 bg-primary hover:bg-primary/90 rounded-xl text-sm"
            >
              {loading ? "Searching…" : "Search"}
            </Button>
          </div>

          {/* Trending chips — only shown before any search */}
          {!submittedQuery && (
            <div className="mt-6 text-center">
              <p className="text-xs text-slate-400 mb-3 uppercase tracking-wide">Trending searches</p>
              <div className="flex flex-wrap justify-center gap-2">
                {TRENDING.map(t => (
                  <button
                    key={t}
                    onClick={() => { setQuery(t); doSearch(t); }}
                    className="px-3 py-1.5 rounded-full text-xs bg-white border border-slate-200 text-slate-600 hover:border-primary/40 hover:text-primary transition-all shadow-sm"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="mt-8 space-y-4 animate-pulse">
              <div className="h-5 bg-slate-200 rounded w-1/3" />
              <div className="h-28 bg-slate-100 rounded-2xl" />
              <div className="h-20 bg-slate-100 rounded-2xl" />
              <div className="h-20 bg-slate-100 rounded-2xl" />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Results */}
          {result && riskMeta && RiskIcon && (
            <div className="mt-8 space-y-5">
              <p className="text-sm text-slate-500">
                Showing AI health insights for <span className="font-semibold text-slate-900">"{submittedQuery}"</span>
              </p>

              {/* Risk & Summary card */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className={`flex items-center gap-2 px-4 py-2.5 border-b text-xs font-semibold ${riskMeta.color}`}>
                  <RiskIcon className="w-4 h-4" />
                  {riskMeta.label} · {result.intent.charAt(0).toUpperCase() + result.intent.slice(1)} Query
                </div>
                <div className="p-4">
                  <p className="text-sm text-slate-700 leading-relaxed">{result.summary}</p>
                </div>
              </div>

              {/* Recommendations */}
              {result.recommendations.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">What you should do</h3>
                  <ul className="space-y-2">
                    {result.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                        <ChevronRight className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Nearby Providers */}
              {result.providers.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-primary" /> Nearby Providers
                  </h3>
                  <div className="space-y-3">
                    {result.providers.map((p, i) => (
                      <Link key={i} href="/providers">
                        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            {p.type === "doctor" ? <Stethoscope className="w-5 h-5 text-primary" /> : <Building2 className="w-5 h-5 text-slate-600" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 text-sm">{p.name}</p>
                            <p className="text-xs text-slate-500">{p.specialty ?? "Hospital"} · {p.location}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs font-semibold text-amber-600">★ {p.rating}</p>
                            {p.type === "doctor" && (
                              <Badge variant="outline" className={`mt-1 text-[10px] ${p.available ? "text-emerald-600 border-emerald-200" : "text-slate-400"}`}>
                                {p.available ? "Available" : "Busy"}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                    <Link href="/providers">
                      <button className="w-full text-center text-sm text-primary hover:underline py-1">
                        View all doctors & hospitals →
                      </button>
                    </Link>
                  </div>
                </div>
              )}

              {/* Articles */}
              {result.articles.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Trusted Health Articles</h3>
                  <div className="space-y-2">
                    {result.articles.map((a, i) => (
                      <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 hover:border-primary/30 hover:shadow-sm transition-all group">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 group-hover:text-primary transition-colors line-clamp-1">{a.title}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{a.source}</p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-primary flex-shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-center text-xs text-slate-400 pb-6">
                AI-generated health information. Always consult a qualified doctor for medical advice.
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
