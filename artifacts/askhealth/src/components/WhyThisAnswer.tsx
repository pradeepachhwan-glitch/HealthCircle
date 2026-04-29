import { useState } from "react";
import { ChevronDown, Info, ShieldCheck, Tag } from "lucide-react";

export interface WhyThisAnswerProps {
  /** Community name when the AI was answering inside a community context
   *  (e.g. "Sugar Care", "Heart Circle"). When provided, surfaces a
   *  "Based on your X community guidance" line in the footer. */
  communityName?: string | null;
  /** Topic tags Yukti inferred from the user's question
   *  (e.g. ["sleep", "anxiety"]). Rendered as small pills. */
  topicTags?: string[];
  /** Trusted clinical references the answer is grounded in
   *  (e.g. ["Mayo Clinic", "WHO guidelines"]). */
  sources?: string[];
  /** When set, locks the footer to the surrounding light/dark surface so it
   *  doesn't blow out the contrast. Defaults to "light". */
  variant?: "light" | "muted";
  /** Test id passed through to the toggle button so e2e tests can target it. */
  testId?: string;
}

/**
 * "Why this answer?" trust footer rendered under any Yukti AI response.
 *
 * Surfaces three things, in this order, when available:
 *   1. The community guidance the answer was tailored for (if any)
 *   2. The topics Yukti inferred from the user's question
 *   3. The clinical sources the answer is grounded in
 *
 * Collapsed by default to keep replies clean — taps open a small panel.
 * If nothing useful would render, the component returns null.
 */
export function WhyThisAnswer({
  communityName,
  topicTags,
  sources,
  variant = "light",
  testId = "why-this-answer",
}: WhyThisAnswerProps) {
  const [open, setOpen] = useState(false);

  // Defensively de-duplicate (case-insensitive) so duplicate strings from the
  // backend can't trigger React's "two children with the same key" warning.
  const dedupe = (arr: string[]) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const v of arr) {
      const t = (v ?? "").trim();
      if (!t) continue;
      const k = t.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(t);
    }
    return out;
  };
  const tags = dedupe(topicTags ?? []);
  const refs = dedupe(sources ?? []);
  const hasCommunity = !!communityName && communityName.trim().length > 0;

  if (!hasCommunity && tags.length === 0 && refs.length === 0) return null;

  const surface =
    variant === "muted"
      ? "bg-background/60 border-border/60 text-muted-foreground"
      : "bg-slate-50/80 border-slate-200 text-slate-600";

  return (
    <div className={`mt-3 rounded-lg border ${surface} text-[11px]`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:opacity-80 transition-opacity"
        data-testid={`button-${testId}-toggle`}
      >
        <Info className="h-3 w-3 text-primary/70 shrink-0" />
        <span className="font-medium">Why this answer?</span>
        <ChevronDown
          className={`h-3 w-3 ml-auto transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          className="px-3 pb-3 pt-1 space-y-2 border-t border-current/10"
          data-testid={`panel-${testId}`}
        >
          {hasCommunity && (
            <div className="flex items-start gap-1.5">
              <ShieldCheck className="h-3 w-3 text-primary/70 mt-0.5 shrink-0" />
              <p className="leading-snug">
                Tailored for the{" "}
                <span className="font-semibold">{communityName}</span> community
                guidance on HealthCircle.
              </p>
            </div>
          )}

          {tags.length > 0 && (
            <div className="flex items-start gap-1.5">
              <Tag className="h-3 w-3 text-primary/70 mt-0.5 shrink-0" />
              <div className="flex flex-wrap gap-1">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {refs.length > 0 && (
            <div className="flex items-start gap-1.5">
              <Info className="h-3 w-3 text-primary/70 mt-0.5 shrink-0" />
              <p className="leading-snug">
                Grounded in:{" "}
                <span className="font-medium text-current">
                  {refs.join(" · ")}
                </span>
              </p>
            </div>
          )}

          <p className="text-[10px] opacity-70 leading-snug pt-1 border-t border-current/10">
            Yukti AI summarises trusted clinical references — not a substitute
            for a doctor's diagnosis.
          </p>
        </div>
      )}
    </div>
  );
}
