import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useClerk, useAuth } from "@workspace/replit-auth-web";
import { MessageSquare, Users, Search, CheckCircle, Plus, Crown } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface Community {
  id: number;
  name: string;
  slug: string;
  description?: string;
  iconEmoji?: string;
  iconUrl?: string | null;
  coverColor?: string;
  memberCount: number;
  postCount: number;
  isMember: boolean;
}

const CATEGORIES: { key: string; label: string; slugPrefixes: string[] }[] = [
  { key: "joined", label: "My Communities", slugPrefixes: [] },
  { key: "core", label: "Core Health", slugPrefixes: ["heart-health", "mental-wellness", "diabetes-care", "thyroid-hormonal", "bone-joint-health"] },
  { key: "women", label: "Women's Health", slugPrefixes: ["pregnancy-motherhood", "pcos-womens-health", "fertility-ivf"] },
  { key: "family", label: "Family & Life Stage", slugPrefixes: ["child-health", "elder-care"] },
  { key: "lifestyle", label: "Lifestyle & Preventive", slugPrefixes: ["weight-loss-fitness", "nutrition-diet", "sleep-recovery"] },
  { key: "condition", label: "Condition-Specific", slugPrefixes: ["respiratory-health", "cancer-support", "infectious-diseases"] },
  { key: "modern", label: "Modern Problems", slugPrefixes: ["work-stress-burnout", "digital-health"] },
  { key: "special", label: "Special Interest", slugPrefixes: ["alternative-medicine", "neurology-brain"] },
];

function CommunityCard({ community, onJoin, onLeave }: {
  community: Community;
  onJoin: (id: number) => void;
  onLeave: (id: number) => void;
}) {
  const accentColor = community.coverColor ?? "hsl(var(--primary))";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-md transition-all group hover:border-slate-300">
      <div className="h-1.5 w-full" style={{ backgroundColor: accentColor }} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-3">
            {community.iconUrl ? (
              <img
                src={community.iconUrl}
                alt=""
                className="w-8 h-8 rounded-lg object-cover shrink-0 bg-white"
              />
            ) : (
              <span className="text-2xl leading-none">{community.iconEmoji ?? "🏥"}</span>
            )}
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-semibold text-slate-900 text-sm leading-tight">{community.name}</h3>
                {(community as any).isPremium && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-full">
                    <Crown className="w-2.5 h-2.5" /> Premium
                  </span>
                )}
              </div>
              {community.isMember && (
                <span className="inline-flex items-center gap-1 text-xs text-primary font-medium mt-0.5">
                  <CheckCircle className="w-3 h-3" /> Joined
                </span>
              )}
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed mb-4 line-clamp-2 min-h-[2.5rem]">
          {community.description}
        </p>

        <div className="flex items-center gap-3 text-xs text-slate-400 mb-4">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {community.memberCount.toLocaleString()} members
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="w-3.5 h-3.5" />
            {community.postCount} posts
          </span>
        </div>

        <div className="flex gap-2">
          {community.isMember ? (
            <>
              <Link href={`/communities/${community.id}`} className="flex-1">
                <Button size="sm" className="w-full text-xs bg-primary hover:bg-primary/90">
                  View Community
                </Button>
              </Link>
              <Button
                size="sm"
                variant="outline"
                className="text-xs text-slate-500 hover:text-red-500 hover:border-red-200"
                onClick={() => onLeave(community.id)}
              >
                Leave
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs border-primary/30 text-primary hover:bg-primary/5"
              onClick={() => onJoin(community.id)}
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Join Community
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function CategorySection({ label, communities, onJoin, onLeave }: {
  label: string;
  communities: Community[];
  onJoin: (id: number) => void;
  onLeave: (id: number) => void;
}) {
  if (communities.length === 0) return null;
  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 px-1">{label}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {communities.map(c => (
          <CommunityCard key={c.id} community={c} onJoin={onJoin} onLeave={onLeave} />
        ))}
      </div>
    </div>
  );
}

export default function Communities() {
  const { toast } = useToast();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  async function handleSessionExpired() {
    await signOut();
    setLocation("/sign-in");
  }

  // Wait until Clerk has finished bootstrapping before firing the query.
  // Otherwise the request goes out before the session token is available, the
  // server returns 401, and the user sees "sign in again" even though they
  // already are signed in.
  const { isLoaded: clerkLoaded, isSignedIn } = useAuth();

  const { data: rawCommunities, isLoading, isError } = useQuery<Community[]>({
    queryKey: ["communities"],
    enabled: clerkLoaded && isSignedIn === true,
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/communities`, { credentials: "include" });
      if (r.status === 401) {
        throw new Error("Session expired");
      }
      if (!r.ok) throw new Error("Failed to fetch communities");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
    retry: 1,
  });
  const communities: Community[] = Array.isArray(rawCommunities) ? rawCommunities : [];

  const join = useMutation({
    mutationFn: (id: number) =>
      fetch(`${API_BASE}/communities/${id}/join`, { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["communities"] });
      const c = communities.find(x => x.id === id);
      toast({ title: `Joined ${c?.name ?? "community"}!`, description: "You can now post and interact in this community." });
    },
    onError: () => toast({ title: "Error", description: "Failed to join community.", variant: "destructive" }),
  });

  const leave = useMutation({
    mutationFn: (id: number) =>
      fetch(`${API_BASE}/communities/${id}/join`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["communities"] });
      const c = communities.find(x => x.id === id);
      toast({ title: `Left ${c?.name ?? "community"}` });
    },
    onError: () => toast({ title: "Error", description: "Failed to leave community.", variant: "destructive" }),
  });

  const filtered = communities.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.description?.toLowerCase().includes(search.toLowerCase())
  );

  const joined = filtered.filter(c => c.isMember);
  const tabs = [
    { key: "all", label: "Explore All", count: filtered.length },
    { key: "joined", label: "My Communities", count: joined.length },
  ];

  const getCategoryList = (slugs: string[]) =>
    filtered.filter(c => slugs.includes(c.slug));

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
        {isError && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-4">
            <p className="text-sm text-amber-800">Unable to load communities. Please refresh the page or sign in again.</p>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="outline" className="text-amber-700 border-amber-300 hover:bg-amber-100" onClick={() => window.location.reload()}>
                Refresh
              </Button>
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" onClick={handleSessionExpired}>
                Sign in again
              </Button>
            </div>
          </div>
        )}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-1">Health Communities</h1>
          <p className="text-slate-500">Join communities relevant to your health journey and connect with others.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              className="pl-10"
              placeholder="Search communities..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}
              >
                {t.label}
                {t.count > 0 && (
                  <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${activeTab === t.key ? "bg-primary/10 text-primary" : "bg-slate-200 text-slate-500"}`}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="h-1.5 bg-slate-100 w-full" />
                <div className="p-5 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && activeTab === "joined" && (
          <>
            {joined.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <Users className="w-12 h-12 mx-auto mb-4 text-slate-200" />
                <p className="font-medium text-slate-500 mb-1">No communities joined yet</p>
                <p className="text-sm mb-4">Explore and join communities that match your health interests.</p>
                <Button variant="outline" onClick={() => setActiveTab("all")}>Explore Communities</Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {joined.map(c => (
                  <CommunityCard key={c.id} community={c} onJoin={id => join.mutate(id)} onLeave={id => leave.mutate(id)} />
                ))}
              </div>
            )}
          </>
        )}

        {!isLoading && activeTab === "all" && (
          <>
            {filtered.length === 0 && (
              <div className="text-center py-20 text-slate-400">
                <Search className="w-12 h-12 mx-auto mb-4 text-slate-200" />
                <p className="font-medium text-slate-600">No communities match your search</p>
              </div>
            )}
            {CATEGORIES.filter(cat => cat.key !== "joined").map(cat => (
              <CategorySection
                key={cat.key}
                label={cat.label}
                communities={getCategoryList(cat.slugPrefixes)}
                onJoin={id => join.mutate(id)}
                onLeave={id => leave.mutate(id)}
              />
            ))}
            {/* Uncategorized communities */}
            {(() => {
              const allCategorized = CATEGORIES.flatMap(c => c.slugPrefixes);
              const uncategorized = filtered.filter(c => !allCategorized.includes(c.slug));
              return uncategorized.length > 0 ? (
                <CategorySection
                  label="Other Communities"
                  communities={uncategorized}
                  onJoin={id => join.mutate(id)}
                  onLeave={id => leave.mutate(id)}
                />
              ) : null;
            })()}
          </>
        )}
      </div>
    </Layout>
  );
}
