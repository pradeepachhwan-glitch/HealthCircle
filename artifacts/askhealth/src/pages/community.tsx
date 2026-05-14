import { useState, useEffect } from "react";
import {
  useGetCommunity, useListPosts, useGetCommunityStats, useGetLeaderboard,
  getListPostsQueryKey, useCreatePost, getGetCommunityQueryKey,
  getGetCommunityStatsQueryKey, getGetLeaderboardQueryKey,
} from "@workspace/api-client-react";
import { Link, useRoute, useLocation } from "wouter";
import { Layout, UserAvatar } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowUp, MessageSquare, Eye, Plus, ArrowLeft, Users, Stethoscope,
  TrendingUp, Clock, HelpCircle, Bot, Crown, Sparkles, Lock, ShieldCheck, HeartPulse, Baby, Brain as BrainIcon,
  Star, ArrowRight
} from "lucide-react";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ConsentModal } from "@/components/ConsentModal";
import { ContentEmbed } from "@/components/ContentEmbed";
import { UpiPaymentBlock } from "@/components/UpiPaymentBlock";
import { cn } from "@/lib/utils";

type Tab = "trending" | "latest" | "unanswered" | "doctor";

const SPECIALTY_CONFIGS: Record<string, {
  name: string;
  theme: string;
  accentColor: string;
  advisorTitle: string;
  advisorSpecialty: string;
  intro: string;
  continuityMessaging: string;
  icon: any;
}> = {
  "mental-wellness": {
    name: "Psychiatry & Wellness",
    theme: "from-indigo-600 to-violet-700",
    accentColor: "text-indigo-600",
    advisorTitle: "Medical Advisors",
    advisorSpecialty: "Psychiatrist",
    intro: "A dedicated space for psychiatric care, emotional support, and mental wellness continuity. Connect with verified specialists for professional guidance.",
    continuityMessaging: "Open for long-term psychiatric support",
    icon: BrainIcon,
  },
  "child-health": {
    name: "Pediatric Care",
    theme: "from-emerald-500 to-green-600",
    accentColor: "text-emerald-600",
    advisorTitle: "Pediatric Advisors",
    advisorSpecialty: "Pediatrician",
    intro: "Specialized pediatric guidance for every milestone. A trusted space for parents to connect with child health specialists.",
    continuityMessaging: "Trusted pediatric partners",
    icon: Baby,
  },
  "fertility-ivf": {
    name: "IVF & Fertility Excellence",
    theme: "from-rose-500 to-pink-600",
    accentColor: "text-rose-600",
    advisorTitle: "Fertility Advisors",
    advisorSpecialty: "Gynecologist",
    intro: "Empathetic, expert-led support for your fertility and IVF journey. Professional guidance for every step of your family planning.",
    continuityMessaging: "Continuity care for fertility journeys",
    icon: HeartPulse,
  },
  "pcos-womens-health": {
    name: "Women's Health & PCOS",
    theme: "from-fuchsia-500 to-purple-600",
    accentColor: "text-fuchsia-600",
    advisorTitle: "Clinical Advisors",
    advisorSpecialty: "Gynecologist",
    intro: "Comprehensive support for PCOS, hormonal health, and clinical women's wellness journeys.",
    continuityMessaging: "Long-term wellness partners",
    icon: ShieldCheck,
  }
};

export default function Community() {
  const [, params] = useRoute("/communities/:id");
  const [, navigate] = useLocation();
  const identifier = params?.id || "";
  const isNumeric = /^\d+$/.test(identifier);
  const routeParam = isNumeric ? parseInt(identifier, 10) : identifier;
  const queryClient = useQueryClient();

  const { data: community, isLoading: communityLoading } = useGetCommunity(routeParam as any, {
    query: { 
      queryKey: isNumeric ? getGetCommunityQueryKey(routeParam as number) : ["communities", identifier],
      enabled: !!identifier 
    },
  });

  const communityId = community?.id || 0;

  const { data: posts, isLoading: postsLoading } = useListPosts(communityId, undefined, {
    query: { queryKey: getListPostsQueryKey(communityId), enabled: !!communityId },
  });
  const { data: stats } = useGetCommunityStats(communityId, {
    query: { queryKey: getGetCommunityStatsQueryKey(communityId), enabled: !!communityId },
  });
  const { data: leaderboard } = useGetLeaderboard(communityId, { period: "weekly" }, {
    query: { queryKey: getGetLeaderboardQueryKey(communityId, { period: "weekly" }), enabled: !!communityId },
  });

  const specConfig = community?.slug ? SPECIALTY_CONFIGS[community.slug] : null;

  const { data: advisors } = useQuery({
    queryKey: ["advisors", specConfig?.advisorSpecialty],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/tc/doctors?specialty=${encodeURIComponent(specConfig?.advisorSpecialty || "")}`);
      const data = await res.json();
      return (data.doctors || []).slice(0, 3);
    },
    enabled: !!specConfig,
  });

  const createPost = useCreatePost();
  const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

  const joinCommunity = useMutation({
    mutationFn: async ({ communityId, isCurrentlyMember }: { communityId: number; isCurrentlyMember: boolean }) => {
      const res = await fetch(`${API_BASE}/communities/${communityId}/join`, {
        method: isCurrentlyMember ? "DELETE" : "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update membership");
      return res.json();
    },
  });

  const [activeTab, setActiveTab] = useState<Tab>("latest");
  const [isPostOpen, setIsPostOpen] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [hasConsented, setHasConsented] = useState(false);
  const [postTitle, setPostTitle] = useState("");
  const [postContent, setPostContent] = useState("");
  const [postAnonymous, setPostAnonymous] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const isMember = (community as any)?.isMember ?? false;
  const isPremium = !!(community as any)?.isPremium;
  const premiumPriceInr = Number((community as any)?.premiumPriceInr ?? 0);
  const premiumPerks = ((community as any)?.premiumPerks as string | null | undefined) ?? "";
  const hasPremiumAccess = !!(community as any)?.hasPremiumAccess;
  const requiresPaymentToJoin = isPremium && premiumPriceInr > 0 && !hasPremiumAccess;
  const [paymentLoading, setPaymentLoading] = useState(false);

  const [upiPayment, setUpiPayment] = useState<{
    paymentId: number; upiId: string; upiLink: string; amountInr: number; txnRef: string; payeeName: string;
  } | null>(null);
  const [utrInput, setUtrInput] = useState("");
  const [confirmingUtr, setConfirmingUtr] = useState(false);

  async function handlePremiumUnlock() {
    if (!community) return;
    setPaymentLoading(true);
    try {
      const orderRes = await fetch(`${API_BASE}/payments/upi/initiate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ communityId, purpose: "community_premium" }),
      });
      if (!orderRes.ok) {
        const body = await orderRes.json().catch(() => ({}));
        throw new Error((body as any).error ?? "Could not start payment");
      }
      const order = await orderRes.json();
      setUpiPayment(order);
      setUtrInput("");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not start payment");
    } finally {
      setPaymentLoading(false);
    }
  }

  async function handleConfirmUtr() {
    if (!upiPayment) return;
    if (utrInput.trim().length < 6) {
      toast.error("Please enter a valid UTR / transaction reference (min 6 characters).");
      return;
    }
    setConfirmingUtr(true);
    try {
      const r = await fetch(`${API_BASE}/payments/upi/confirm`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: upiPayment.paymentId, utr: utrInput.trim() }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error((body as any).error ?? "Could not confirm payment");
      }
      queryClient.invalidateQueries({ queryKey: getGetCommunityQueryKey(communityId) });
      toast.success("Premium unlocked! Welcome to the inner circle.");
      setUpiPayment(null);
      setUtrInput("");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not confirm payment");
    } finally {
      setConfirmingUtr(false);
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard?.writeText(text).then(
      () => toast.success(`${label} copied`),
      () => toast.error(`Could not copy ${label}`),
    );
  }

  const { data: communityAIPrompts } = useQuery<{ suggestedQuestions: string[] }>({
    queryKey: ["community-prompts", community?.slug],
    queryFn: () => fetch(`${API_BASE}/ai/community-prompts/${community!.slug}`).then(r => r.json()),
    enabled: !!community?.slug,
  });
  const suggestedQuestions = communityAIPrompts?.suggestedQuestions ?? [];

  const handleAskClick = () => {
    if (!hasConsented) {
      setShowConsent(true);
    } else {
      setIsPostOpen(true);
    }
  };

  const handleConsent = () => {
    setShowConsent(false);
    setHasConsented(true);
    setIsPostOpen(true);
  };

  const handleJoin = () => {
    joinCommunity.mutate({ communityId, isCurrentlyMember: isMember }, {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetCommunityQueryKey(communityId) });
        toast.success(data?.isMember ? "Joined community!" : "Left community");
      },
      onError: () => toast.error("Failed to update membership"),
    });
  };

  const handleCreatePost = () => {
    if (!postTitle.trim() || !postContent.trim()) {
      toast.error("Title and content are required");
      return;
    }
    createPost.mutate({
      communityId,
      data: { title: postTitle, content: postContent, isAnonymous: postAnonymous } as any
    }, {
      onSuccess: () => {
        setIsPostOpen(false);
        setPostTitle("");
        setPostContent("");
        setPostAnonymous(false);
        queryClient.invalidateQueries({ queryKey: getListPostsQueryKey(communityId) });
        toast.success("Your question has been posted. Yukti AI is generating a summary...");
      },
      onError: () => toast.error("Failed to create post"),
    });
  };

  const filteredPosts = posts?.filter(p => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q);
    }
    return true;
  }) ?? [];

  const sortedPosts = (() => {
    switch (activeTab) {
      case "trending": return [...filteredPosts].sort((a, b) => (b.upvoteCount + b.commentCount * 2) - (a.upvoteCount + a.commentCount * 2));
      case "latest": return [...filteredPosts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case "unanswered": return filteredPosts.filter(p => p.commentCount === 0).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case "doctor": return filteredPosts.filter(p => (p as any).hasDoctorAnswer).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      default: return filteredPosts;
    }
  })();

  if (communityLoading) {
    return (
      <Layout>
        <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </Layout>
    );
  }

  if (!community) return <Layout><div className="p-8 text-center text-muted-foreground">Community not found</div></Layout>;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto pb-24 md:pb-6">
        {/* Hero Banner */}
        <div 
          className={cn(
            "relative transition-all duration-500",
            specConfig ? `bg-gradient-to-br ${specConfig.theme}` : ""
          )}
          style={{ backgroundColor: !specConfig ? (community.coverColor || "hsl(var(--primary))") : undefined }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/50" />
          <div className="relative px-4 md:px-8 pt-12 pb-8">
            <button
              onClick={() => navigate("/communities")}
              className="inline-flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> All Communities
            </button>
            <div className="flex items-end justify-between gap-4">
              <div className="flex items-end gap-4">
                <div className="w-16 h-16 md:w-20 md:h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-4xl md:text-5xl border border-white/30 shadow-lg overflow-hidden">
                  {specConfig ? (
                    <specConfig.icon className="w-10 h-10 md:w-12 md:h-12 text-white" />
                  ) : (community as any).iconUrl ? (
                    <img
                      src={(community as any).iconUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    community.iconEmoji || "🏥"
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                      {specConfig ? specConfig.name : community.name}
                    </h1>
                    {isPremium && (
                      <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm shadow-md">
                        <Crown className="w-3 h-3 mr-1" /> Premium
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-white/80 text-sm flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> {stats?.memberCount ?? community.memberCount} members
                    </span>
                    <span className="text-white/40">•</span>
                    <span className="text-white/80 text-sm">Professional Ecosystem</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {requiresPaymentToJoin ? (
                  <Button
                    size="sm"
                    onClick={handlePremiumUnlock}
                    disabled={paymentLoading}
                    className="shrink-0 bg-white text-primary hover:bg-white/90 border-0 shadow-lg font-bold px-6"
                  >
                    {paymentLoading ? "Loading…" : `Unlock ₹${premiumPriceInr}`}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant={isMember ? "secondary" : "default"}
                    onClick={handleJoin}
                    disabled={joinCommunity.isPending}
                    className="shrink-0 bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm font-bold"
                  >
                    {isMember ? "✓ Joined" : "+ Join Community"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 md:px-8 mt-6 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed font-medium">
            {specConfig ? specConfig.intro : community.description}
          </p>

          {isPremium && (
            <div className={cn(
              "rounded-xl p-4 border",
              hasPremiumAccess
                ? "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200"
                : "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200"
            )}>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0">
                  {hasPremiumAccess ? <Sparkles className="w-5 h-5 text-white" /> : <Lock className="w-5 h-5 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {hasPremiumAccess ? "You're a Premium member" : `Premium · ₹${premiumPriceInr} one-time`}
                  </h3>
                  {premiumPerks && (
                    <ul className="mt-1.5 text-xs text-slate-600 space-y-0.5">
                      {premiumPerks.split("|").map((perk, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-amber-600 mt-0.5">•</span>
                          <span>{perk.trim()}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {requiresPaymentToJoin && (
                    <Button
                      onClick={handlePremiumUnlock}
                      disabled={paymentLoading}
                      size="sm"
                      className="mt-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white border-0 font-semibold"
                    >
                      <Crown className="w-3.5 h-3.5 mr-1.5" />
                      {paymentLoading ? "Loading…" : `Unlock for ₹${premiumPriceInr}`}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Ask Question CTA */}
          <button
            onClick={handleAskClick}
            className="w-full flex items-center gap-3 bg-muted/50 hover:bg-muted rounded-xl px-4 py-3 text-sm text-muted-foreground border border-border/60 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Plus className="w-4 h-4 text-primary" />
            </div>
            <span>Ask a health question in {community.name}...</span>
          </button>

          {/* Search */}
          <Input
            placeholder="Search discussions..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-background"
          />

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-6">
            {/* Feed */}
            <div>
              <Tabs value={activeTab} onValueChange={v => setActiveTab(v as Tab)}>
                <TabsList className="w-full grid grid-cols-4 mb-4">
                  <TabsTrigger value="trending" className="text-xs gap-1">
                    <TrendingUp className="w-3 h-3" /> Trending
                  </TabsTrigger>
                  <TabsTrigger value="latest" className="text-xs gap-1">
                    <Clock className="w-3 h-3" /> Latest
                  </TabsTrigger>
                  <TabsTrigger value="unanswered" className="text-xs gap-1">
                    <HelpCircle className="w-3 h-3" /> Unanswered
                  </TabsTrigger>
                  <TabsTrigger value="doctor" className="text-xs gap-1">
                    <Stethoscope className="w-3 h-3" /> Doctor
                  </TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="mt-0">
                  <div className="space-y-3">
                    {postsLoading ? (
                      [1, 2, 3].map(i => <Skeleton key={i} className="h-36 w-full rounded-xl" />)
                    ) : sortedPosts.length === 0 ? (
                      <div className="text-center py-14 border rounded-xl border-dashed bg-muted/20">
                        <div className="text-3xl mb-2">💬</div>
                        <p className="text-sm text-muted-foreground">
                          {activeTab === "unanswered" ? "All questions have been answered!" :
                           activeTab === "doctor" ? "No doctor answers yet in this community." :
                           searchQuery ? "No posts match your search." :
                           "No discussions yet. Be the first to ask!"}
                        </p>
                        {activeTab === "latest" && !searchQuery && (
                          <Button size="sm" className="mt-3" onClick={handleAskClick}>Ask the first question</Button>
                        )}
                      </div>
                    ) : (
                      sortedPosts.map(post => (
                        <PostCard key={post.id} post={post} communityId={communityId} communitySlug={community.slug} communityName={community.name} />
                      ))
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {specConfig && advisors && advisors.length > 0 && (
                <Card className="border-slate-100 shadow-sm overflow-hidden">
                  <CardHeader className="pb-3 bg-slate-50/50">
                    <CardTitle className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <ShieldCheck className={cn("w-3.5 h-3.5", specConfig.accentColor)} />
                      {specConfig.advisorTitle}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-slate-100">
                      {advisors.map((advisor: any) => (
                        <div key={advisor.id} className="p-4 space-y-3">
                          <div className="flex items-center gap-3">
                            <UserAvatar name={advisor.name} url={advisor.imageUrl} className="w-9 h-9 border border-slate-100" />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-bold text-slate-900 truncate">{advisor.name}</div>
                              <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">{advisor.specialty}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                            <span>{Number(advisor.rating).toFixed(1)} Rating</span>
                            <span className="text-slate-200">|</span>
                            <span>{advisor.experienceYears} yrs exp.</span>
                          </div>
                          <Button 
                            size="sm" 
                            className={cn("w-full h-8 text-[11px] font-bold gap-2", specConfig.theme.includes("indigo") ? "bg-indigo-600 hover:bg-indigo-700" : specConfig.theme.includes("rose") ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700")}
                            onClick={() => navigate(`/teleconsult/doctors?specialty=${encodeURIComponent(advisor.specialty)}`)}
                          >
                            Continuity Consult
                            <ArrowRight className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {leaderboard && leaderboard.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Top Contributors</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {leaderboard.slice(0, 5).map((entry, idx) => (
                        <div key={entry.userId} className="flex items-center gap-3 px-4 py-2.5">
                          <span className="text-xs font-bold text-muted-foreground w-4 text-center">{idx + 1}</span>
                          <UserAvatar name={entry.displayName} url={entry.avatarUrl} className="w-7 h-7" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{entry.displayName}</div>
                            <div className="text-[10px] text-muted-foreground">Level {entry.level}</div>
                          </div>
                          <Badge variant="secondary" className="text-[10px] shrink-0">{entry.credits} HC</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Bot className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-primary">Ask Yukti AI</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                    Get instant AI guidance specialised for {community.name}.
                  </p>
                  <Link href={`/chat?community=${encodeURIComponent(community.slug)}&communityName=${encodeURIComponent(community.name)}`}>
                    <Button size="sm" variant="default" className="w-full text-xs">Ask Yukti about {community.name}</Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Consent Modal */}
      <ConsentModal
        open={showConsent}
        onConsent={handleConsent}
        onCancel={() => setShowConsent(false)}
      />

      {/* Ask Question Dialog */}
      <Dialog open={isPostOpen} onOpenChange={setIsPostOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Ask in {community.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {suggestedQuestions.length > 0 && !postTitle && (
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium">Common questions in {community.name}:</p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestedQuestions.slice(0, 4).map((q, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPostTitle(q)}
                      className="text-xs px-2.5 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors text-left"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Input
              placeholder={`What's your ${community.name} question? (Be specific)`}
              value={postTitle}
              onChange={e => setPostTitle(e.target.value)}
              className="font-medium"
            />
            <Textarea
              placeholder="Share more details — symptoms, duration, medications, age, etc. The more context, the better the community can help."
              value={postContent}
              onChange={e => setPostContent(e.target.value)}
              className="min-h-[140px]"
            />
            
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-slate-900">Post Anonymously</div>
                <div className="text-[11px] text-slate-500">Hide your identity from others in this community</div>
              </div>
              <Switch 
                checked={postAnonymous} 
                onCheckedChange={setPostAnonymous} 
              />
            </div>

            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-start gap-2">
              <Bot className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Yukti AI will automatically generate a health summary for your post.
                Type <span className="font-semibold text-primary">@askYukti</span> anywhere in your question to get a personal AI reply from Yukti in the thread.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPostOpen(false)}>Cancel</Button>
            <Button onClick={handleCreatePost} disabled={createPost.isPending || !postTitle.trim() || !postContent.trim()}>
              {createPost.isPending ? "Posting..." : "Post Question"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* UPI Payment Dialog */}
      <Dialog open={!!upiPayment} onOpenChange={(open) => { if (!open) { setUpiPayment(null); setUtrInput(""); } }}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Pay ₹{upiPayment?.amountInr} via UPI</DialogTitle>
          </DialogHeader>
          {upiPayment && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-slate-50 dark:bg-slate-900 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs text-slate-500">Pay to</p>
                    <p className="font-mono text-sm font-semibold">{upiPayment.upiId}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{upiPayment.payeeName}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(upiPayment.upiId, "UPI ID")}>
                    Copy
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-2 border-t pt-3">
                  <div>
                    <p className="text-xs text-slate-500">Amount</p>
                    <p className="text-xl font-bold">₹{upiPayment.amountInr}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Reference</p>
                    <p className="font-mono text-[11px] break-all">{upiPayment.txnRef}</p>
                  </div>
                </div>
              </div>

              <UpiPaymentBlock
                upiLink={upiPayment.upiLink}
                upiId={upiPayment.upiId}
                amountInr={upiPayment.amountInr}
                payeeName={upiPayment.payeeName}
                txnRef={upiPayment.txnRef}
              />

              <div className="border-t pt-3 space-y-2">
                <label className="text-sm font-medium">After paying, enter your UTR / Transaction Ref</label>
                <input
                  type="text"
                  value={utrInput}
                  onChange={(e) => setUtrInput(e.target.value)}
                  placeholder="e.g. 412334567890"
                  className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm font-mono"
                  autoCapitalize="characters"
                />
                <p className="text-[11px] text-slate-500">
                  You'll find this 12-digit number in your UPI app's payment receipt or SMS confirmation.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUpiPayment(null); setUtrInput(""); }} disabled={confirmingUtr}>
              Cancel
            </Button>
            <Button onClick={handleConfirmUtr} disabled={confirmingUtr || utrInput.trim().length < 6}>
              {confirmingUtr ? "Confirming..." : "I've paid — Unlock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

// Map of reaction key → display emoji + label, used by the picker and the
// summary chip strip. Keep keys in sync with ALLOWED_REACTIONS on the server.
const REACTION_DISPLAY: Record<string, { emoji: string; label: string }> = {
  like: { emoji: "👍", label: "Like" },
  love: { emoji: "❤️", label: "Love" },
  care: { emoji: "🤗", label: "Care" },
  insightful: { emoji: "💡", label: "Insightful" },
  celebrate: { emoji: "🎉", label: "Celebrate" },
  sad: { emoji: "😢", label: "Sad" },
};
const REACTION_ORDER = ["like", "love", "care", "insightful", "celebrate", "sad"];

function PostCard({ post, communityId, communitySlug, communityName }: { post: any; communityId: number; communitySlug?: string; communityName?: string }) {
  const queryClient = useQueryClient();
  const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  // Local optimistic mirrors of the server-truth values.
  const [localUpvoted, setLocalUpvoted] = useState<boolean>(!!post.hasUpvoted);
  const [localUpvoteCount, setLocalUpvoteCount] = useState<number>(post.upvoteCount ?? 0);
  const [localReactions, setLocalReactions] = useState<{ counts: Record<string, number>; total: number; mine: string | null }>(
    post.reactions ?? { counts: {}, total: 0, mine: null }
  );

  // Re-sync mirrors whenever a fresh `post` arrives from React Query (e.g. after
  // background refetch or another user's action), otherwise we'd display stale
  // counts/reaction chips after invalidations.
  useEffect(() => {
    setLocalUpvoted(!!post.hasUpvoted);
    setLocalUpvoteCount(post.upvoteCount ?? 0);
    setLocalReactions(post.reactions ?? { counts: {}, total: 0, mine: null });
  }, [post.hasUpvoted, post.upvoteCount, post.reactions]);

  const upvoteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/posts/${post.id}/upvote`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Upvote failed");
      return res.json() as Promise<{ upvoteCount: number; hasUpvoted: boolean }>;
    },
    // Snapshot pre-mutate state so onError can roll back to the exact prior
    // value without depending on (possibly stale) closure variables.
    onMutate: (): { wasUpvoted: boolean; wasCount: number } => {
      const wasUpvoted = localUpvoted;
      const wasCount = localUpvoteCount;
      setLocalUpvoted(!wasUpvoted);
      setLocalUpvoteCount(wasCount + (wasUpvoted ? -1 : 1));
      return { wasUpvoted, wasCount };
    },
    onSuccess: (data) => {
      setLocalUpvoted(data.hasUpvoted);
      setLocalUpvoteCount(data.upvoteCount);
      queryClient.invalidateQueries({ queryKey: getListPostsQueryKey(communityId) });
    },
    onError: (_err, _vars, context) => {
      if (context) {
        setLocalUpvoted(context.wasUpvoted);
        setLocalUpvoteCount(context.wasCount);
      }
      toast.error("Could not save your vote");
    },
  });

  const reactMutation = useMutation({
    mutationFn: async (emoji: string | null) => {
      const res = await fetch(`${API_BASE}/posts/${post.id}/react`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      if (!res.ok) throw new Error("React failed");
      return res.json() as Promise<{ counts: Record<string, number>; total: number; mine: string | null }>;
    },
    onSuccess: (data) => {
      setLocalReactions(data);
      setShowReactionPicker(false);
      queryClient.invalidateQueries({ queryKey: getListPostsQueryKey(communityId) });
    },
    onError: () => toast.error("Could not save your reaction"),
  });

  // A post is a "content card" when admin attached an embeddable payload.
  // Falsy / 'discussion' contentType keeps the legacy text-only render.
  const hasContent = post.contentType && post.contentType !== "discussion" && post.contentUrl;
  const contentTypeLabel: Record<string, string> = { video: "VIDEO", article: "ARTICLE", audio: "PODCAST" };

  // Pre-compute the top-3 emojis to display as a stacked chip (Facebook-style).
  const topReactions = REACTION_ORDER
    .filter(k => (localReactions.counts[k] ?? 0) > 0)
    .sort((a, b) => (localReactions.counts[b] ?? 0) - (localReactions.counts[a] ?? 0))
    .slice(0, 3);

  // Helper that prevents a child interactive control from triggering the
  // parent navigation when the title/body Link is clicked.
  const stop = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); };

  return (
    <Card className="hover:border-primary/40 transition-all shadow-sm hover:shadow-md group" data-testid={`post-card-${post.id}`}>
      <CardContent className="p-4">
        <div className="flex gap-3">
          {/* Vote Column — clickable, does NOT navigate */}
          <div className="flex flex-col items-center gap-0.5 shrink-0 pt-0.5">
            <button
              type="button"
              onClick={(e) => { stop(e); upvoteMutation.mutate(); }}
              disabled={upvoteMutation.isPending}
              data-testid={`button-upvote-${post.id}`}
              className={cn(
                "p-1 rounded hover:bg-primary/10 transition-colors",
                localUpvoted ? "text-primary" : "text-muted-foreground hover:text-primary"
              )}
              aria-label={localUpvoted ? "Remove upvote" : "Upvote"}
            >
              <ArrowUp className={cn("w-4 h-4", localUpvoted && "fill-current")} />
            </button>
            <span className={cn("text-xs font-bold", localUpvoted ? "text-primary" : "text-foreground")}>{localUpvoteCount}</span>
          </div>

          {/* Content — wrap only the title/body in the Link so action buttons stay clickable */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5 flex-wrap">
              <UserAvatar name={post.authorName} url={post.authorAvatar} className="w-4 h-4" />
              <span className="font-medium text-foreground/80">{post.authorName}</span>
              {post.isAnonymous && (
                <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-slate-200 bg-slate-50 text-slate-500">ANONYMOUS</Badge>
              )}
              {post.isBroadcast && (
                <Badge className="text-[9px] h-4 px-1.5 bg-blue-600">ANNOUNCEMENT</Badge>
              )}
              {hasContent && (
                <Badge className="text-[9px] h-4 px-1.5 bg-purple-600">
                  {contentTypeLabel[post.contentType] ?? post.contentType.toUpperCase()}
                </Badge>
              )}
              <span className="text-muted-foreground/50">•</span>
              <span>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</span>
            </div>

              <Link href={`/communities/${communityId}/post/${post.id}`}>
              <div className="cursor-pointer">
                <div className="flex items-center gap-2 mb-1.5">
                  <h3 className="font-bold text-base text-foreground leading-snug group-hover:text-primary transition-colors">
                    {post.title}
                  </h3>
                  {post.isPremiumLocked && (
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-amber-200 bg-amber-50 text-amber-600 font-bold">
                      <Lock className="w-2.5 h-2.5 mr-1" /> PREMIUM LOCKED
                    </Badge>
                  )}
                </div>
                {!hasContent && (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-3">
                    {post.content}
                  </p>
                )}
              </div>
            </Link>

            {hasContent && (
              <ContentEmbed
                title={post.title}
                payload={{
                  contentType: post.contentType,
                  contentUrl: post.contentUrl,
                  contentSource: post.contentSource ?? null,
                  contentThumbnail: post.contentThumbnail ?? null,
                  contentDurationSec: post.contentDurationSec ?? null,
                  contentSummary: post.contentSummary ?? post.content ?? null,
                }}
                communitySlug={communitySlug}
                communityName={communityName}
              />
            )}

            {/* Reaction summary strip — stacked emoji chips with running total */}
            {localReactions.total > 0 && (
              <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <div className="flex -space-x-1">
                  {topReactions.map(k => (
                    <span key={k} className="inline-flex items-center justify-center w-4 h-4 text-[11px] rounded-full bg-white border border-border" title={REACTION_DISPLAY[k].label}>
                      {REACTION_DISPLAY[k].emoji}
                    </span>
                  ))}
                </div>
                <span>{localReactions.total}</span>
              </div>
            )}

            <div className={cn("flex items-center gap-3 text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50")}>
              {/* Reaction picker trigger */}
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => { stop(e); setShowReactionPicker(v => !v); }}
                  data-testid={`button-react-${post.id}`}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded hover:bg-primary/10 transition-colors",
                    localReactions.mine ? "text-primary font-medium" : "text-muted-foreground hover:text-primary"
                  )}
                  aria-label="React"
                >
                  {localReactions.mine ? (
                    <>
                      <span className="text-sm leading-none">{REACTION_DISPLAY[localReactions.mine]?.emoji ?? "👍"}</span>
                      <span>{REACTION_DISPLAY[localReactions.mine]?.label ?? "Like"}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-sm leading-none">😊</span>
                      <span>React</span>
                    </>
                  )}
                </button>
                {showReactionPicker && (
                  <div
                    onClick={stop}
                    className="absolute bottom-full left-0 mb-2 z-20 bg-white dark:bg-card border border-border rounded-full shadow-lg px-2 py-1 flex items-center gap-1"
                  >
                    {REACTION_ORDER.map(k => (
                      <button
                        key={k}
                        type="button"
                        onClick={(e) => { stop(e); reactMutation.mutate(k); }}
                        disabled={reactMutation.isPending}
                        title={REACTION_DISPLAY[k].label}
                        data-testid={`reaction-option-${k}-${post.id}`}
                        className="text-xl hover:scale-125 transition-transform p-0.5"
                      >
                        {REACTION_DISPLAY[k].emoji}
                      </button>
                    ))}
                    {localReactions.mine && (
                      <button
                        type="button"
                        onClick={(e) => { stop(e); reactMutation.mutate(null); }}
                        className="text-xs text-muted-foreground hover:text-destructive px-2 border-l border-border ml-1"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}
              </div>

              <Link href={`/communities/${communityId}/post/${post.id}`}>
                <span className="flex items-center gap-1 cursor-pointer hover:text-primary transition-colors">
                  <MessageSquare className="w-3.5 h-3.5" /> {post.commentCount}
                </span>
              </Link>
              <span className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" /> {post.viewCount ?? 0}
              </span>
              {post.commentCount === 0 && (
                <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-900/20">
                  Unanswered
                </Badge>
              )}
              <div className="ml-auto">
                <Bot className="w-3.5 h-3.5 text-primary/60" />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
