import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Crown, Copy, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

export interface QuotaInfo {
  exceeded: "daily" | "weekly" | "monthly" | null;
  used: { daily: number; weekly: number; monthly: number };
  limits: { daily: number; weekly: number; monthly: number };
  resetAt: string | null;
}

interface SubscribeOrder {
  paymentId: number;
  upiId: string;
  upiLink: string;
  amountInr: number;
  planDays: number;
  txnRef: string;
  payeeName: string;
  note: string;
}

function fmtReset(iso: string | null): string {
  if (!iso) return "soon";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function copyText(text: string, label: string) {
  navigator.clipboard?.writeText(text).then(
    () => toast({ title: `${label} copied` }),
    () => toast({ title: `Could not copy ${label}`, variant: "destructive" }),
  );
}

export function QuotaExhaustedModal({
  open,
  quota,
  onClose,
  onSubscribed,
}: {
  open: boolean;
  quota: QuotaInfo | null;
  onClose: () => void;
  onSubscribed?: () => void;
}) {
  const [order, setOrder] = useState<SubscribeOrder | null>(null);
  const [starting, setStarting] = useState(false);
  const [utr, setUtr] = useState("");
  const [confirming, setConfirming] = useState(false);

  function handleClose() {
    setOrder(null);
    setUtr("");
    onClose();
  }

  async function startSubscribe() {
    setStarting(true);
    try {
      const r = await fetch(`${API_BASE}/payments/upi/subscribe`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Could not start payment");
      }
      const o = (await r.json()) as SubscribeOrder;
      setOrder(o);
    } catch (err) {
      toast({ title: "Couldn't start payment", description: (err as Error).message, variant: "destructive" });
    } finally {
      setStarting(false);
    }
  }

  async function confirmSubscribe() {
    if (!order) return;
    if (utr.trim().length < 6) {
      toast({ title: "Enter a valid UTR", description: "Min 6 characters", variant: "destructive" });
      return;
    }
    setConfirming(true);
    try {
      const r = await fetch(`${API_BASE}/payments/upi/confirm`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: order.paymentId, utr: utr.trim() }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Could not confirm payment");
      }
      toast({ title: "Subscription activated", description: "You now have unlimited AI access for 3 months." });
      onSubscribed?.();
      handleClose();
    } catch (err) {
      toast({ title: "Couldn't confirm payment", description: (err as Error).message, variant: "destructive" });
    } finally {
      setConfirming(false);
    }
  }

  const ex = quota?.exceeded;
  const limitLabel = ex === "daily" ? "daily" : ex === "weekly" ? "weekly" : ex === "monthly" ? "monthly" : "usage";
  const usedNum = ex && quota ? quota.used[ex] : 0;
  const limitNum = ex && quota ? quota.limits[ex] : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md">
        {!order ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-500" />
                Limit exhausted ({limitLabel})
              </DialogTitle>
              <DialogDescription>
                You've used <strong>{usedNum} of {limitNum}</strong> {limitLabel} AI questions.
                Resets {fmtReset(quota?.resetAt ?? null)}.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
              <div className="flex justify-between"><span>Today</span><span>{quota?.used.daily ?? 0} / {quota?.limits.daily ?? 4}</span></div>
              <div className="flex justify-between"><span>This week</span><span>{quota?.used.weekly ?? 0} / {quota?.limits.weekly ?? 15}</span></div>
              <div className="flex justify-between"><span>This month</span><span>{quota?.used.monthly ?? 0} / {quota?.limits.monthly ?? 50}</span></div>
            </div>

            <div className="rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800 p-4">
              <p className="font-semibold text-sm mb-1">Get unlimited AI access</p>
              <p className="text-xs text-muted-foreground mb-3">3-month plan — no daily/weekly/monthly limits, just ₹299.</p>
              <Button onClick={startSubscribe} disabled={starting} className="w-full" data-testid="button-subscribe-3mo">
                {starting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Starting…</> : "Subscribe to three month plan"}
              </Button>
            </div>

            <Button variant="ghost" onClick={handleClose} className="w-full">Maybe later</Button>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Pay ₹{order.amountInr} via UPI</DialogTitle>
              <DialogDescription>Complete payment in any UPI app, then enter the UTR below.</DialogDescription>
            </DialogHeader>

            <Alert>
              <AlertDescription className="text-xs">
                Pay to <strong>{order.upiId}</strong> ({order.payeeName}) with note <strong>{order.txnRef}</strong>.
              </AlertDescription>
            </Alert>

            <div className="grid gap-2">
              <a href={order.upiLink} className="block">
                <Button variant="default" className="w-full" data-testid="button-open-upi-app">
                  <ExternalLink className="h-4 w-4 mr-2" />Open UPI app
                </Button>
              </a>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => copyText(order.upiId, "UPI ID")}><Copy className="h-3 w-3 mr-1" />UPI ID</Button>
                <Button variant="outline" size="sm" onClick={() => copyText(order.txnRef, "Reference")}><Copy className="h-3 w-3 mr-1" />Ref</Button>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="utr-input">UTR / Transaction reference</Label>
              <Input
                id="utr-input"
                value={utr}
                onChange={(e) => setUtr(e.target.value)}
                placeholder="e.g. 412312345678"
                data-testid="input-utr"
              />
              <p className="text-xs text-muted-foreground">Find this in your UPI app's payment receipt.</p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose} disabled={confirming} className="flex-1">Cancel</Button>
              <Button onClick={confirmSubscribe} disabled={confirming || utr.trim().length < 6} className="flex-1" data-testid="button-confirm-utr">
                {confirming ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Confirming…</> : "Confirm payment"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
