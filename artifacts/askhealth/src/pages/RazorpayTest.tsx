import React from "react";
import { useRazorpay } from "@/hooks/useRazorpay";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function RazorpayTest() {
  const { openCheckout } = useRazorpay();

  const handleSubscriptionPay = () => {
    openCheckout({
      purpose: "subscription_3mo",
      onSuccess: (data) => console.log("Subscription Success", data),
    });
  };

  const handleCommunityPay = () => {
    // Note: This requires a valid premium community ID from your database
    openCheckout({
      communityId: 1, 
      onSuccess: (data) => console.log("Community Success", data),
    });
  };

  return (
    <div className="container mx-auto py-10 flex flex-col items-center gap-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Razorpay Integration Test</CardTitle>
          <CardDescription>
            Test the Standard Checkout integration using the buttons below.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button onClick={handleSubscriptionPay} className="w-full">
            Test 3-Month Subscription (₹299)
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            This will trigger the create-order endpoint with purpose 'subscription_3mo'.
          </p>
          
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">OR</span>
            </div>
          </div>

          <Button onClick={handleCommunityPay} variant="outline" className="w-full">
            Test Community Access (ID: 1)
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Requires community with ID 1 to be premium in the database.
          </p>
        </CardContent>
      </Card>
      
      <div className="text-sm text-muted-foreground max-w-md">
        <h3 className="font-semibold mb-2">Checklist for testing:</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Razorpay script is loaded in head</li>
          <li>VITE_RAZORPAY_KEY_ID is set in .env</li>
          <li>Backend server is running with RAZORPAY_KEY_SECRET</li>
          <li>You are logged in (authenticated)</li>
        </ul>
      </div>
    </div>
  );
}
