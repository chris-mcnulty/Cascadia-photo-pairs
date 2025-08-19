import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const verifyEmail = async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");

      if (!token) {
        setStatus("error");
        setMessage("No verification token provided");
        return;
      }

      try {
        const response = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (response.ok) {
          setStatus("success");
          setMessage(data.message || "Email verified successfully!");
          // Redirect to login after 3 seconds
          setTimeout(() => {
            setLocation("/login");
          }, 3000);
        } else {
          setStatus("error");
          setMessage(data.message || "Failed to verify email");
        }
      } catch (error) {
        setStatus("error");
        setMessage("An error occurred while verifying your email");
      }
    };

    verifyEmail();
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Email Verification</CardTitle>
          <CardDescription>
            {status === "loading" && "Verifying your email address..."}
            {status === "success" && "Success!"}
            {status === "error" && "Verification Failed"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4">
          {status === "loading" && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Please wait while we verify your email...</p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle2 className="h-12 w-12 text-green-600" />
              <p className="text-center">{message}</p>
              <p className="text-sm text-muted-foreground text-center">
                You will be redirected to the login page in a few seconds...
              </p>
              <Button onClick={() => setLocation("/login")} className="w-full">
                Go to Login Now
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="h-12 w-12 text-red-600" />
              <p className="text-center text-red-600">{message}</p>
              <div className="flex flex-col gap-2 w-full">
                <Button onClick={() => setLocation("/signup")} variant="outline" className="w-full">
                  Back to Sign Up
                </Button>
                <Button onClick={() => setLocation("/")} className="w-full">
                  Go to Home
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}