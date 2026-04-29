import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { ExternalLink, Smartphone, Copy } from "lucide-react";
import { toast } from "sonner";

interface UpiPaymentBlockProps {
  upiLink: string;
  upiId: string;
  amountInr: number;
  payeeName: string;
  txnRef: string;
}

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod|opera mini|iemobile|blackberry/i.test(navigator.userAgent);
}

async function copyText(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error(`Couldn't copy ${label}. Long-press to copy manually.`);
  }
}

/**
 * UPI payment helper used inside payment dialogs. Renders:
 *   1. A QR code of the upi:// link so desktop users can scan it with their
 *      phone's camera or any UPI app — this is the "always works" path.
 *   2. A primary "Open UPI app" button. On mobile we navigate via
 *      `window.location.href` (more reliable than a plain anchor inside
 *      sandboxed iframes / SPAs). On desktop we fall back to a clear toast
 *      telling the user to scan the QR instead — no more silent dead button.
 *   3. Quick-copy buttons for UPI ID, amount, and reference, so the user can
 *      always pay manually if everything else fails.
 */
export function UpiPaymentBlock({ upiLink, upiId, amountInr, payeeName, txnRef }: UpiPaymentBlockProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);
  const mobile = isMobileDevice();

  useEffect(() => {
    let cancelled = false;
    setQrError(false);
    setQrDataUrl(null);
    QRCode.toDataURL(upiLink, {
      width: 220,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then((url) => { if (!cancelled) setQrDataUrl(url); })
      .catch((err) => {
        console.error("QR generation failed", err);
        if (!cancelled) setQrError(true);
      });
    return () => { cancelled = true; };
  }, [upiLink]);

  const handleOpenUpiApp = () => {
    if (mobile) {
      // Programmatic navigation is more reliable than <a href> for custom
      // schemes inside React SPAs. If no UPI app handles the scheme, the
      // user lands back here and can use the QR/copy fallbacks.
      window.location.href = upiLink;
      return;
    }
    toast.info("Scan the QR code with your phone — UPI apps don't run on desktop.", {
      duration: 5000,
    });
  };

  return (
    <div className="space-y-3">
      <Button
        type="button"
        onClick={handleOpenUpiApp}
        className="w-full"
        data-testid="button-open-upi-app"
      >
        {mobile ? <ExternalLink className="h-4 w-4 mr-2" /> : <Smartphone className="h-4 w-4 mr-2" />}
        {mobile ? "Open UPI app to pay" : "On desktop? Scan the QR below"}
      </Button>

      <div className="flex flex-col items-center gap-2 rounded-lg border bg-white dark:bg-slate-50 p-4">
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt={`UPI payment QR for ${payeeName}`}
            width={220}
            height={220}
            className="rounded"
            data-testid="img-upi-qr"
          />
        ) : qrError ? (
          <div className="w-[220px] h-[220px] flex items-center justify-center text-xs text-muted-foreground text-center px-4">
            Couldn't render QR. Use the UPI ID below in any UPI app.
          </div>
        ) : (
          <div className="w-[220px] h-[220px] animate-pulse bg-slate-100 dark:bg-slate-200 rounded" />
        )}
        <p className="text-[11px] text-slate-600 dark:text-slate-700 text-center max-w-[240px]">
          Scan with GPay / PhonePe / Paytm / BHIM, or your phone's camera.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => copyText(upiId, "UPI ID")}
          type="button"
        >
          <Copy className="h-3 w-3 mr-1" />UPI ID
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => copyText(String(amountInr), "Amount")}
          type="button"
        >
          <Copy className="h-3 w-3 mr-1" />₹{amountInr}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => copyText(txnRef, "Reference")}
          type="button"
        >
          <Copy className="h-3 w-3 mr-1" />Ref
        </Button>
      </div>

      <div className="rounded-md bg-slate-50 dark:bg-slate-900 px-3 py-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
        <span className="font-medium">Manual:</span> Send <span className="font-semibold">₹{amountInr}</span> to{" "}
        <span className="font-mono font-semibold">{upiId}</span> ({payeeName}) with note{" "}
        <span className="font-mono">{txnRef}</span>.
      </div>
    </div>
  );
}
