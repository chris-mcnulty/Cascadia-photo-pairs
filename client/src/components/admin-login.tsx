import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Lock, Smartphone, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import cascadiaLogoPath from "@assets/Cascadia-TP_1754453673312.png";

interface LoginResponse {
  sessionId?: string;
  requiresMfa?: boolean;
  message: string;
  authenticated?: boolean;
}

interface AdminLoginProps {
  onAuthenticated: (sessionId: string) => void;
}

export default function AdminLogin({ onAuthenticated }: AdminLoginProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<'password' | 'mfa'>('password');
  const [sessionId, setSessionId] = useState<string>('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const passwordMutation = useMutation({
    mutationFn: async (password: string) => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      return response.json() as Promise<LoginResponse>;
    },
    onSuccess: (data) => {
      if (data.requiresMfa && data.sessionId) {
        setSessionId(data.sessionId);
        setStep('mfa');
        // Extract phone number from message for display
        const phoneMatch = data.message.match(/(\+1-\d{3}-\d{3}-\d{4})/);
        if (phoneMatch) {
          setPhoneNumber(phoneMatch[1]);
        }
        toast({
          title: "SMS sent",
          description: data.message,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Login failed", 
        description: error.message || "Invalid password",
        variant: "destructive",
      });
    },
  });

  const mfaMutation = useMutation({
    mutationFn: async (code: string) => {
      console.log('MFA Verification - SessionId:', sessionId, 'Code:', code);
      const response = await fetch('/api/auth/verify-mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, code })
      });
      const data = await response.json();
      console.log('MFA Response:', data);
      if (!response.ok) {
        throw new Error(data.message || 'Verification failed');
      }
      return data as LoginResponse;
    },
    onSuccess: (data) => {
      if (data.authenticated) {
        onAuthenticated(sessionId);
        toast({
          title: "Welcome!",
          description: "Successfully logged in to admin panel.",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Verification failed",
        description: error.message || "Invalid verification code",
        variant: "destructive",
      });
    },
  });

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    passwordMutation.mutate(password);
  };

  const handleMfaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaCode.trim()) return;
    mfaMutation.mutate(mfaCode);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-lg overflow-hidden">
              <img 
                src={cascadiaLogoPath} 
                alt="Cascadia Oceanic Logo" 
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          <h1 className="text-2xl font-bold cascadia-green">Admin Login</h1>
          <p className="text-gray-600 mt-2">Cascadia Oceanic Management</p>
          
          <Link href="/" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mt-4">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Voting
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              {step === 'password' ? (
                <>
                  <Lock className="w-5 h-5 mr-2" />
                  Enter Password
                </>
              ) : (
                <>
                  <Smartphone className="w-5 h-5 mr-2" />
                  Enter Verification Code
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            
            {step === 'password' ? (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Admin Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter admin password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={passwordMutation.isPending}
                    required
                  />
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full bg-green-700 hover:bg-green-800"
                  disabled={passwordMutation.isPending}
                >
                  {passwordMutation.isPending ? "Verifying..." : "Continue"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleMfaSubmit} className="space-y-4">
                <Alert>
                  <Smartphone className="h-4 w-4" />
                  <AlertDescription>
                    A 6-digit verification code has been sent to {phoneNumber}. 
                    Enter the code below to complete login.
                  </AlertDescription>
                </Alert>
                
                <div className="space-y-2">
                  <Label htmlFor="mfaCode">Verification Code</Label>
                  <Input
                    id="mfaCode"
                    type="text"
                    placeholder="123456"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    disabled={mfaMutation.isPending}
                    maxLength={6}
                    required
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    type="submit" 
                    className="flex-1 bg-green-700 hover:bg-green-800"
                    disabled={mfaMutation.isPending || mfaCode.length !== 6}
                  >
                    {mfaMutation.isPending ? "Verifying..." : "Login"}
                  </Button>
                  <Button 
                    type="button"
                    variant="outline" 
                    onClick={() => {
                      setStep('password');
                      setPassword('');
                      setMfaCode('');
                      setSessionId('');
                    }}
                    disabled={mfaMutation.isPending}
                  >
                    Back
                  </Button>
                </div>
              </form>
            )}
            
          </CardContent>
        </Card>
        
        <div className="text-center mt-6 text-xs text-gray-500">
          © Christopher F. McNulty 2025
        </div>
      </div>
    </div>
  );
}