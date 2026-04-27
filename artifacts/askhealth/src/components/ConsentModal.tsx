import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldCheck } from "lucide-react";

interface ConsentModalProps {
  open: boolean;
  onConsent: () => void;
  onCancel: () => void;
}

export function ConsentModal({ open, onConsent, onCancel }: ConsentModalProps) {
  const [consent1, setConsent1] = useState(false);
  const [consent2, setConsent2] = useState(false);

  const handleAgree = () => {
    if (!consent1 || !consent2) return;
    // Store consent record via API
    fetch("/api/consents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consentTypes: ["post_health_data", "ai_assistance"] }),
    }).catch(() => {});
    onConsent();
  };

  const handleClose = (open: boolean) => {
    if (!open) onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <DialogTitle className="text-lg leading-tight">Before you post</DialogTitle>
          </div>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground pt-1">
            HealthCircle is a peer support community. Your question will be visible to members and may be analysed by our AI to generate helpful guidance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <label className="flex items-start gap-3 cursor-pointer group">
            <Checkbox
              checked={consent1}
              onCheckedChange={(v) => setConsent1(v === true)}
              className="mt-0.5"
            />
            <span className="text-sm text-foreground leading-relaxed group-hover:text-foreground/90">
              I understand that the information I share is for peer support only and not a substitute for professional medical advice.
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer group">
            <Checkbox
              checked={consent2}
              onCheckedChange={(v) => setConsent2(v === true)}
              className="mt-0.5"
            />
            <span className="text-sm text-foreground leading-relaxed group-hover:text-foreground/90">
              I consent to Yukti AI analysing my post to generate a health summary that may be visible to community members.
            </span>
          </label>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={onCancel} className="sm:order-first">Cancel</Button>
          <Button onClick={handleAgree} disabled={!consent1 || !consent2} className="sm:flex-1">
            I agree — Post my question
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
