import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Camera, Trophy, BarChart3, Gift, ArrowLeft, Eye, EyeOff } from "lucide-react";
import type { Settings } from "@shared/schema";

export default function SignupPage() {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Fetch admin settings for customizable text
  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const signupMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/auth/register", {
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Registration failed");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Account created!",
        description: "Please check your email to verify your account.",
      });
      // Redirect to login page after successful signup
      setTimeout(() => {
        window.location.href = "/login";
      }, 2000);
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }
    
    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords don't match";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      signupMutation.mutate(formData);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Back to Voting Link */}
        <Link href="/">
          <Button variant="ghost" className="mb-6 text-green-700 hover:text-green-800">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Voting (No signup required)
          </Button>
        </Link>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Benefits Section */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Join Cascadia Oceanic
              </h1>
              <p className="text-lg text-gray-600">
                Enhance your photo voting experience
              </p>
            </div>

            {/* Contest Message from Admin Settings */}
            {settings?.contestSignupText && (
              <Alert className="border-green-200 bg-green-50">
                <Gift className="h-5 w-5 text-green-600" />
                <AlertDescription className="text-green-800">
                  {settings.contestSignupText}
                </AlertDescription>
              </Alert>
            )}

            {/* Benefits List */}
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <Trophy className="w-6 h-6 text-yellow-500 mt-1" />
                <div>
                  <h3 className="font-semibold text-gray-900">Access the Leaderboard</h3>
                  <p className="text-gray-600">See top-rated photos and track rankings</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <BarChart3 className="w-6 h-6 text-blue-500 mt-1" />
                <div>
                  <h3 className="font-semibold text-gray-900">Track Your Voting Stats</h3>
                  <p className="text-gray-600">Monitor your voting history and patterns</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <Gift className="w-6 h-6 text-green-500 mt-1" />
                <div>
                  <h3 className="font-semibold text-gray-900">Monthly Contests</h3>
                  <p className="text-gray-600">Compete for prizes based on voting activity</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <Camera className="w-6 h-6 text-purple-500 mt-1" />
                <div>
                  <h3 className="font-semibold text-gray-900">Save Favorites</h3>
                  <p className="text-gray-600">Build your personal collection of favorite photos</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> You can always vote anonymously without signing up. 
                Create an account only if you want these extra features!
              </p>
            </div>
          </div>

          {/* Signup Form */}
          <Card>
            <CardHeader>
              <CardTitle>Create Your Account</CardTitle>
              <CardDescription>
                Join to unlock all features or <Link href="/login" className="text-green-600 hover:text-green-700">sign in</Link>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name (Optional)</Label>
                    <Input
                      id="firstName"
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name (Optional)</Label>
                    <Input
                      id="lastName"
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  />
                  {errors.email && (
                    <p className="text-sm text-red-600">{errors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
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
                  {errors.password && (
                    <p className="text-sm text-red-600">{errors.password}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-500" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-500" />
                      )}
                    </Button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-sm text-red-600">{errors.confirmPassword}</p>
                  )}
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-green-700 hover:bg-green-800"
                  disabled={signupMutation.isPending}
                >
                  {signupMutation.isPending ? "Creating Account..." : "Create Account"}
                </Button>

                <p className="text-xs text-gray-500 text-center">
                  By creating an account, you agree to our{" "}
                  {settings?.termsOfServiceUrl && (
                    <a href={settings.termsOfServiceUrl} className="text-green-600 hover:underline">
                      Terms of Service
                    </a>
                  )}
                  {settings?.termsOfServiceUrl && settings?.privacyPolicyUrl && " and "}
                  {settings?.privacyPolicyUrl && (
                    <a href={settings.privacyPolicyUrl} className="text-green-600 hover:underline">
                      Privacy Policy
                    </a>
                  )}
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}