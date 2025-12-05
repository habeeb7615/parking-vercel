import { AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SubscriptionBlockedProps {
  message?: string;
}

export function SubscriptionBlocked({ message = "Your contractor's subscription has expired. Please contact your contractor to recharge." }: SubscriptionBlockedProps) {
  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <AlertCircle className="h-16 w-16 text-red-500" />
        </div>
        <CardTitle className="text-2xl font-bold text-red-600">Access Blocked</CardTitle>
        <CardDescription className="text-base mt-2">
          {message}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <Button onClick={handleRefresh} className="mt-4">
          Refresh Page
        </Button>
      </CardContent>
    </Card>
  );
}

