import { useCallback } from "react";
import { customFetch } from "@workspace/api-client-react";
import { toast } from "sonner";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface RazorpayOptions {
  amountInr?: number;
  communityId?: number;
  purpose?: "subscription_3mo" | string;
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}

export function useRazorpay() {
  const openCheckout = useCallback(async (options: RazorpayOptions) => {
    try {
      // 1. Create order on backend
      const { orderId, amount, currency } = await customFetch<{
        orderId: string;
        amount: number;
        currency: string;
        paymentId: number;
      }>("/api/payments/razorpay/create-order", {
        method: "POST",
        body: JSON.stringify({
          communityId: options.communityId,
          purpose: options.purpose,
        }),
      });

      // 2. Open Razorpay Modal
      const rzpOptions = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: amount,
        currency: currency,
        name: "HealthCircle",
        description: options.purpose === "subscription_3mo" ? "3-Month Subscription" : "Premium Community Access",
        order_id: orderId,
        handler: async function (response: any) {
          try {
            // 3. Verify payment on backend
            await customFetch("/api/payments/razorpay/verify", {
              method: "POST",
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            toast.success("Payment successful!");
            if (options.onSuccess) options.onSuccess(response);
          } catch (error) {
            console.error("Payment verification failed:", error);
            toast.error("Payment verification failed. Please contact support.");
            if (options.onError) options.onError(error);
          }
        },
        modal: {
          ondismiss: function () {
            toast.info("Payment cancelled");
          },
        },
        theme: {
          color: "#2563EB",
        },
      };

      const rzp = new window.Razorpay(rzpOptions);
      rzp.on("payment.failed", function (response: any) {
        toast.error(`Payment failed: ${response.error.description}`);
        if (options.onError) options.onError(response.error);
      });
      rzp.open();
    } catch (error: any) {
      console.error("Failed to initiate Razorpay checkout:", error);
      toast.error(error.message || "Failed to initiate payment");
      if (options.onError) options.onError(error);
    }
  }, []);

  return { openCheckout };
}
