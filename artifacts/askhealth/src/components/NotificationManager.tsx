import { useEffect, useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useToast } from "@/hooks/use-toast";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "./ui/button";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function NotificationManager() {
  const { isSignedIn } = useAuth();
  const { toast } = useToast();
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  async function subscribe() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      toast({ title: "Unsupported", description: "Your browser doesn't support push notifications.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // 1. Get VAPID key
      const configRes = await fetch(`${API_BASE}/notifications/config`);
      const { vapidPublicKey } = await configRes.json();

      if (!vapidPublicKey) throw new Error("Push notifications not configured on server.");

      // 2. Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        toast({ title: "Permission Denied", description: "Please enable notifications in your browser settings." });
        return;
      }

      // 3. Register/Get Subscription
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      // 4. Send to backend
      const res = await fetch(`${API_BASE}/notifications/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (res.ok) {
        toast({ title: "Notifications Enabled!", description: "You will now receive health updates and alerts." });
      } else {
        throw new Error("Failed to save subscription on server.");
      }
    } catch (err: any) {
      console.error("[Push] Subscription failed:", err);
      toast({ title: "Subscription Failed", description: err.message || "Something went wrong.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  if (!isSignedIn || permission === "granted") return null;

  return (
    <div className="fixed bottom-20 right-4 z-50 animate-in fade-in slide-in-from-bottom-4">
      <div className="bg-white border border-slate-200 shadow-lg rounded-2xl p-4 max-w-[280px]">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 leading-tight">Stay Updated</p>
            <p className="text-[11px] text-slate-500 mt-1 leading-snug">
              Enable notifications for community replies and health alerts.
            </p>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button 
            onClick={subscribe} 
            disabled={loading}
            className="flex-1 h-8 text-xs bg-primary hover:bg-primary/90 rounded-lg"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Enable Now"}
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => setPermission("denied")}
            className="h-8 text-[11px] text-slate-400 hover:text-slate-600"
          >
            Not now
          </Button>
        </div>
      </div>
    </div>
  );
}
