import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import Admin from "@/pages/admin";
import Leaderboard from "@/pages/leaderboard";
import Signup from "@/pages/signup";
import Login from "@/pages/login";
import ResetPassword from "@/pages/reset-password";
import VerifyEmail from "@/pages/verify-email";
import NotFound from "@/pages/not-found";
import UserStats from "@/pages/user-stats";
import Profile from "@/pages/profile";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/leaderboard" component={Leaderboard} />
      <Route path="/admin" component={Admin} />
      <Route path="/signup" component={Signup} />
      <Route path="/login" component={Login} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/user-stats" component={UserStats} />
      <Route path="/profile" component={Profile} />
      <Route path="/user-settings" component={Profile} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
