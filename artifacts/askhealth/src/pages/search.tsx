import { useState, useEffect, useRef, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Search as SearchIcon, AlertTriangle, CheckCircle, Activity,
  Stethoscope, Building2, ChevronRight, MapPin,
  Sparkles, Navigation, Map, Loader2, Users, MessageSquare, ThumbsUp, ShieldCheck,
} from "lucide-react";
import { Link } from "wouter";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface Provider {
  id: number; type: "doctor" | "hospital"; name: string;
  specialty?: string; location: string; rating: string; available?: boolean;
}

interface RelatedCommunity {
  id: number; slug: string; name: string;
  description: string | null; iconEmoji: string | null;
}

interface Discussion {
  id: number;
  title: string;
  excerpt: string;
  communitySlug: string;
  communityName: string;
  authorName: string | null;
  upvoteCount: number;
  commentCount: number;
  isExpertAnswered: boolean;
  createdAt: string;
}

interface SearchResult {
  intent: string;
  summary: string;
  risk_level: "low" | "medium" | "high";
  recommendations: string[];
  providers: Provider[];
  relatedCommunities: RelatedCommunity[];
  discussions: Discussion[];
  mapQuery: string;
  ai_synthesized: boolean;
}

interface Coords { lat: number; lng: number; }

const RISK_META = {
  low:    { color: "text-emerald-700 bg-emerald-50 border-emerald-200", icon: CheckCircle,    label: "Low Risk" },
  medium: { color: "text-amber-700 bg-amber-50 border-amber-200",       icon: Activity,       label: "Medium Risk" },
  high:   { color: "text-red-700 bg-red-50 border-red-200",             icon: AlertTriangle,   label: "High Risk — Seek Care" },
};

const TRENDING = [
  "fever and body ache", "diabetes management", "back pain relief",
  "anxiety and stress", "high blood pressure", "find cardiologist",
];

function buildMapsUrl(mapQuery: string, coords: Coords | null) {
  if (coords) {
    return `https://www.google.com/maps/search/${encodeURIComponent(mapQuery)}/@${coords.lat},${coords.lng},14z`;
  }
  return `https://www.google.com/maps/search/${encodeURIComponent(mapQuery)}`;
}

function buildMapsEmbedUrl(mapQuery: string, coords: Coords | null) {
  if (coords) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&ll=${coords.lat},${coords.lng}&z=14&output=embed`;
  }
  return `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`;
}

export default function SearchPage() {
  const [query, setQuery]               = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [result, setResult]             = useState<SearchResult | null>(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [coords, setCoords]             = useState<Coords | null>(null);
  const [locating, setLocating]         = useState(false);
  const [locError, setLocError]         = useState<string | null>(null);
  const [mapLoaded, setMapLoaded]       = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) { setLocError("Location not supported by your browser."); return; }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocError("Location access denied. Map will open without your exact position.");
        setLocating(false);
      },
      { timeout: 8000 }
    );
  }, []);

  useEffect(() => {
    // Auto-request location on page load (silently)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}, // silent fail
        { timeout: 5000 }
      );
    }
  }, []);

  async function doSearch(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setSubmittedQuery(trimmed);
    setLoading(true);
    setError(null);
    setResult(null);
    setMapLoaded(false);
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

  const mapsEmbedUrl = result ? buildMapsEmbedUrl(result.mapQuery, coords) : "";

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className={`mx-auto px-4 transition-all duration-300 ${submittedQuery ? "max-w-3xl pt-6" : "max-w-2xl pt-24"}`}>

          {/* Hero */}
          {!submittedQuery && (
            <div className="text-center mb-8">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-7 h-7 text-primary" />
              </div>
              <h1 className="text-3xl font-bold text-slate-900 mb-1">HealthCircle Search</h1>
              <p className="text-slate-500 text-sm">AI health insights · Nearby doctors & hospitals · Trusted links</p>
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

          {/* Trending chips */}
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
              <div className="h-48 bg-slate-100 rounded-2xl" />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
          )}

          {/* Results */}
          {result && riskMeta && RiskIcon && (
            <div className="mt-8 space-y-5">
              <p className="text-sm text-slate-500">
                AI health insights for <span className="font-semibold text-slate-900">"{submittedQuery}"</span>
              </p>

              {/* Risk & Summary */}
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

              {/* ── Nearby Providers Map ── */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Map className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-slate-700">Nearby Doctors & Hospitals</h3>
                    {coords && (
                      <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200 bg-emerald-50 gap-1">
                        <Navigation className="w-2.5 h-2.5" /> Location detected
                      </Badge>
                    )}
                  </div>
                  <Link href="/providers" className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                    View all providers
                  </Link>
                </div>

                {/* Google Maps embed */}
                <div className="relative w-full h-64 bg-slate-100">
                  {!mapLoaded && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 bg-slate-50">
                      <Loader2 className="w-6 h-6 text-primary animate-spin" />
                      <span className="text-xs text-slate-500">Loading map…</span>
                    </div>
                  )}
                  <iframe
                    src={mapsEmbedUrl}
                    className="w-full h-full border-0"
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    onLoad={() => setMapLoaded(true)}
                    title="Nearby providers map"
                  />
                </div>

                {/* Locate + In-app providers row */}
                <div className="flex gap-2 p-3 border-t border-slate-100 bg-slate-50/50">
                  {!coords && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={getLocation}
                      disabled={locating}
                      className="flex-1 h-9 text-xs border-slate-200 text-slate-600 hover:border-primary/40 hover:text-primary"
                    >
                      {locating
                        ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Locating…</>
                        : <><Navigation className="w-3.5 h-3.5 mr-1.5" />Use my location</>}
                    </Button>
                  )}
                  <Link href="/providers" className="flex-1">
                    <Button size="sm" className="w-full h-9 text-xs bg-primary hover:bg-primary/90">
                      <MapPin className="w-3.5 h-3.5 mr-1.5" />
                      Browse Verified Providers
                    </Button>
                  </Link>
                </div>

                {locError && (
                  <p className="text-xs text-amber-600 px-4 pb-3">{locError}</p>
                )}
              </div>

              {/* In-app DB providers (if any) */}
              {result.providers.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                    <Stethoscope className="w-4 h-4 text-primary" /> HealthCircle Verified Providers
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
                  </div>
                </div>
              )}

              {/* Discussions on HealthCircle — real posts matching the query */}
              {result.discussions && result.discussions.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-primary" /> Discussions on HealthCircle
                    <span className="text-xs font-normal text-slate-400">· {result.discussions.length} match{result.discussions.length === 1 ? "" : "es"}</span>
                  </h3>
                  <div className="space-y-2">
                    {result.discussions.map(d => (
                      <Link
                        key={d.id}
                        href={`/post/${d.id}`}
                        className="block p-4 bg-white rounded-xl border border-slate-200 hover:border-primary/30 hover:shadow-sm transition-all group"
                        data-testid={`discussion-${d.id}`}
                      >
                        <div className="flex items-center gap-2 mb-1.5 text-xs">
                          <span className="text-slate-400">in</span>
                          <span className="font-medium text-primary">{d.communityName}</span>
                          {d.isExpertAnswered && (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] gap-1 px-1.5 py-0">
                              <ShieldCheck className="w-2.5 h-2.5" /> Expert answered
                            </Badge>
                          )}
                        </div>
                        <p className="font-medium text-sm text-slate-900 group-hover:text-primary transition-colors line-clamp-2">{d.title}</p>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{d.excerpt}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                          {d.authorName && <span>by {d.authorName}</span>}
                          <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" />{d.upvoteCount}</span>
                          <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{d.commentCount}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Related HealthCircle Communities — native, never external */}
              {result.relatedCommunities && result.relatedCommunities.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-primary" /> Join the Conversation
                  </h3>
                  <div className="space-y-2">
                    {result.relatedCommunities.map((c) => (
                      <Link
                        key={c.id}
                        href={`/communities/${c.slug}`}
                        className="flex items-center gap-3 p-3.5 bg-white rounded-xl border border-slate-200 hover:border-primary/30 hover:shadow-sm transition-all group"
                      >
                        <span className="text-2xl flex-shrink-0">{c.iconEmoji ?? "💬"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 group-hover:text-primary transition-colors line-clamp-1">{c.name}</p>
                          {c.description && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{c.description}</p>}
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-primary flex-shrink-0" />
                      </Link>
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
