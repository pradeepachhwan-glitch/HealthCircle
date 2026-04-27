import * as React from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "default" | "highlighted" | "loading";

interface AIResponseCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  showIcon?: boolean;
  title?: React.ReactNode;
}

export const AIResponseCard = React.forwardRef<HTMLDivElement, AIResponseCardProps>(
  ({ className, children, variant = "default", showIcon = true, title, ...props }, ref) => {
    const isLoading = variant === "loading";
    const isHighlighted = variant === "highlighted";

    return (
      <div
        ref={ref}
        className={cn(
          "relative rounded-2xl border border-l-4 p-5 sm:p-6 bg-ai-soft border-ai-indigo transition-default",
          "dark:bg-accent/10",
          isHighlighted && "shadow-ai-glow",
          isLoading && "animate-pulse",
          className,
        )}
        {...props}
      >
        {(showIcon || title) && (
          <div className="flex items-center gap-2 mb-2">
            {showIcon && (
              <div className="w-7 h-7 rounded-lg bg-ai-gradient flex items-center justify-center shadow-card">
                {isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                )}
              </div>
            )}
            {title && <div className="text-sm font-semibold text-foreground">{title}</div>}
          </div>
        )}
        <div className="text-[15px] leading-relaxed text-foreground/80">{children}</div>
      </div>
    );
  },
);
AIResponseCard.displayName = "AIResponseCard";
