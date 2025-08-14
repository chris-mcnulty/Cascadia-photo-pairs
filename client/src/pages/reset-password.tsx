import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Mail, KeyRound } from "lucide-react";

export default function ResetPasswordPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Request password reset
  const requestResetMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest("POST", "/api/auth/request-reset", { email });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to send reset email");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Reset email sent!",
        description: "Check your email for the reset code.",
      });
      setStep("reset");
    },
    onError: (error: Error) => {
      toast({
        title: "Request failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Reset password with token
  const resetPasswordMutation = useMutation({
    mutationFn: async (data: { token: string; password: string }) => {
      const response = await apiRequest("POST", "/api/auth/reset-password", data);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to reset password");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Password reset successful!",
        description: "You can now login with your new password.",
      });
      setTimeout(() => {
        setLocation("/login");
      }, 2000);
    },
    onError: (error: Error) => {
      toast({
        title: "Reset failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRequestReset = (e: React.FormEvent) => {
    e.preventDefault();
    requestResetMutation.mutate(email);
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive",
      });
      return;
    }
    
    if (newPassword.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters.",
        variant: "destructive",
      });
      return;
    }
    
    resetPasswordMutation.mutate({
      token: resetToken,
      password: newPassword,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        {/* Back Link */}
        <Link href="/login">
          <Button variant="ghost" className="mb-6 text-green-700 hover:text-green-800">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Login
          </Button>
        </Link>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">
              {step === "request" ? "Reset Your Password" : "Set New Password"}
            </CardTitle>
            <CardDescription className="text-center">
              {step === "request" 
                ? "Enter your email to receive a reset code"
                : "Enter the code from your email and new password"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === "request" ? (
              <form onSubmit={handleRequestReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-green-700 hover:bg-green-800"
                  disabled={requestResetMutation.isPending}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  {requestResetMutation.isPending ? "Sending..." : "Send Reset Code"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <Alert className="border-blue-200 bg-blue-50">
                  <AlertDescription className="text-sm">
                    Check your email for the 6-digit reset code. The code expires in 1 hour.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label htmlFor="token">Reset Code</Label>
                  <Input
                    id="token"
                    type="text"
                    placeholder="123456"
                    maxLength={6}
                    required
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="At least 8 characters"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-green-700 hover:bg-green-800"
                  disabled={resetPasswordMutation.isPending}
                >
                  <KeyRound className="w-4 h-4 mr-2" />
                  {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
                </Button>

                <Button
                  type="button"
                  variant="link"
                  className="w-full text-sm"
                  onClick={() => setStep("request")}
                >
                  Didn't receive the code? Request again
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}