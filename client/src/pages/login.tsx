import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, LogIn, UserPlus, Eye, EyeOff, Mail } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Settings } from "@shared/schema";

export default function LoginPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showResendDialog, setShowResendDialog] = useState(false);
  const [resendEmail, setResendEmail] = useState("");

  // Fetch admin settings for customizable text
  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const loginMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/auth/login", data);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Login failed");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      // Store auth token
      if (data.token) {
        localStorage.setItem("auth-token", data.token);
      }
      
      toast({
        title: "Welcome back!",
        description: "You have successfully logged in.",
      });
      
      // Redirect to home page or previous page
      setTimeout(() => {
        setLocation("/");
      }, 1000);
    },
    onError: (error: Error) => {
      // Check if error is due to unverified email
      if (error.message.includes("verify") || error.message.includes("verified")) {
        toast({
          title: "Email not verified",
          description: "Please check your email for the verification link.",
          variant: "destructive",
          action: (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setResendEmail(formData.email);
                setShowResendDialog(true);
              }}
            >
              Resend Email
            </Button>
          ),
        });
      } else {
        toast({
          title: "Login failed",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  const resendVerificationMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest("POST", "/api/auth/resend-verification", { email });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to resend verification email");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Verification email sent!",
        description: "Please check your inbox for the verification link.",
      });
      setShowResendDialog(false);
      setResendEmail("");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to resend email",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(formData);
  };

  const handleForgotPassword = () => {
    // Navigate to password reset page
    setLocation("/reset-password");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        {/* Back to Voting Link */}
        <Link href="/">
          <Button variant="ghost" className="mb-6 text-green-700 hover:text-green-800">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Voting (No login required)
          </Button>
        </Link>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Welcome Back</CardTitle>
            <CardDescription className="text-center">
              Sign in to access your account features
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Button
                    type="button"
                    variant="link"
                    className="px-0 font-normal text-sm text-green-600 hover:text-green-700"
                    onClick={handleForgotPassword}
                  >
                    Forgot password?
                  </Button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-500" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-500" />
                    )}
                  </Button>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-green-700 hover:bg-green-800"
                disabled={loginMutation.isPending}
              >
                <LogIn className="w-4 h-4 mr-2" />
                {loginMutation.isPending ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">Or</span>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <Alert className="border-blue-200 bg-blue-50">
                  <AlertDescription className="text-sm text-blue-800">
                    <strong>New here?</strong> You can vote without an account! 
                    Sign up only if you want to access the leaderboard and track your stats.
                  </AlertDescription>
                </Alert>

                <Link href="/signup">
                  <Button variant="outline" className="w-full">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Create New Account
                  </Button>
                </Link>
              </div>
            </div>

            {/* Footer Links */}
            <div className="mt-6 text-center text-sm text-gray-500 space-y-2">
              <div>
                Need help?{" "}
                {settings?.supportEmail && (
                  <a 
                    href={`mailto:${settings.supportEmail}`} 
                    className="text-green-600 hover:underline"
                  >
                    Contact Support
                  </a>
                )}
              </div>
              <div>
                <Button
                  type="button"
                  variant="link"
                  className="text-green-600 hover:text-green-700 text-sm"
                  onClick={() => setShowResendDialog(true)}
                >
                  <Mail className="w-3 h-3 mr-1" />
                  Resend verification email
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resend Verification Dialog */}
        <Dialog open={showResendDialog} onOpenChange={setShowResendDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Resend Verification Email</DialogTitle>
              <DialogDescription>
                Enter your email address and we'll send you a new verification link.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="resend-email">Email Address</Label>
                <Input
                  id="resend-email"
                  type="email"
                  placeholder="you@example.com"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowResendDialog(false);
                    setResendEmail("");
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => resendVerificationMutation.mutate(resendEmail)}
                  disabled={!resendEmail || resendVerificationMutation.isPending}
                  className="flex-1 bg-green-700 hover:bg-green-800"
                >
                  {resendVerificationMutation.isPending ? "Sending..." : "Send Email"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}