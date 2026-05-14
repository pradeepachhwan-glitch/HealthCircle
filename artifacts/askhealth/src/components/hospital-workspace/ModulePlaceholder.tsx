import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Lock } from "lucide-react";

interface ModulePlaceholderProps {
  title: string;
  description: string;
  isPartial?: boolean;
}

export function ModulePlaceholder({ title, description, isPartial }: ModulePlaceholderProps) {
  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden min-h-[400px] flex flex-col items-center justify-center text-center p-8">
      <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-6">
        {isPartial ? (
          <AlertCircle className="w-8 h-8 text-amber-500 animate-pulse" />
        ) : (
          <Lock className="w-8 h-8 text-slate-300" />
        )}
      </div>
      <div className="max-w-md space-y-4">
        <div>
          <Badge variant="outline" className={cn(
            "mb-2 uppercase tracking-widest text-[10px] font-bold px-2 py-0.5",
            isPartial ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-50 text-slate-500 border-slate-200"
          )}>
            {isPartial ? "Expansion in Progress" : "Coming Soon"}
          </Badge>
          <CardTitle className="text-xl font-bold text-slate-900">{title}</CardTitle>
          <CardDescription className="text-sm mt-2 font-medium">
            {description}
          </CardDescription>
        </div>
        
        <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="outline" className="text-xs font-bold border-slate-200 hover:bg-slate-50">
            View Documentation
          </Button>
          <Button className="text-xs font-bold shadow-lg shadow-primary/20">
            Request Early Access
          </Button>
        </div>
        
        {isPartial && (
          <p className="text-[10px] text-slate-400 mt-8 font-medium italic">
            Note: Basic functionality is available in specific sub-routes. Full dashboard integration is being layered.
          </p>
        )}
      </div>
    </Card>
  );
}

import { cn } from "@/lib/utils";
