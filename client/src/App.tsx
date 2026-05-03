import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/contexts/cart-context";
import PhotoPairs from "@/pages/photo-pairs";
import Admin from "@/pages/admin";
import Leaderboard from "@/pages/leaderboard";
import Signup from "@/pages/signup";
import Login from "@/pages/login";
import ResetPassword from "@/pages/reset-password";
import VerifyEmail from "@/pages/verify-email";
import NotFound from "@/pages/not-found";
import UserStats from "@/pages/user-stats";
import Profile from "@/pages/profile";
import PublicHome from "@/pages/public/public-home";
import Portfolio from "@/pages/public/portfolio";
import PortfolioCollection from "@/pages/public/portfolio-collection";
import Store from "@/pages/public/store";
import Product from "@/pages/public/product";
import Cart from "@/pages/public/cart";
import Checkout from "@/pages/public/checkout";
import CheckoutSuccess from "@/pages/public/checkout-success";
import CheckoutCancel from "@/pages/public/checkout-cancel";
import Biography from "@/pages/public/biography";
import CalendarPage from "@/pages/public/calendar";
import News from "@/pages/public/news";
import NewsPost from "@/pages/public/news-post";
import Unsubscribe from "@/pages/unsubscribe";
import PrivacyAnalytics from "@/pages/public/privacy-analytics";
import RouteTracker from "@/components/route-tracker";

function Router() {
  return (
    <Switch>
      {/* Public site */}
      <Route path="/" component={PublicHome} />
      <Route path="/portfolio" component={Portfolio} />
      <Route path="/portfolio/:slug" component={PortfolioCollection} />
      <Route path="/store" component={Store} />
      <Route path="/store/category/:slug" component={Store} />
      <Route path="/store/:slug" component={Product} />
      <Route path="/cart" component={Cart} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/checkout/success" component={CheckoutSuccess} />
      <Route path="/checkout/cancel" component={CheckoutCancel} />
      <Route path="/biography" component={Biography} />
      <Route path="/calendar" component={CalendarPage} />
      <Route path="/news" component={News} />
      <Route path="/news/:slug" component={NewsPost} />

      {/* Photo Pairs / voting (was at /) */}
      <Route path="/photo-pairs" component={PhotoPairs} />

      {/* Existing back-office, auth, admin */}
      <Route path="/leaderboard" component={Leaderboard} />
      <Route path="/admin" component={Admin} />
      <Route path="/signup" component={Signup} />
      <Route path="/login" component={Login} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/user-stats" component={UserStats} />
      <Route path="/profile" component={Profile} />
      <Route path="/user-settings" component={Profile} />
      <Route path="/unsubscribe" component={Unsubscribe} />
      <Route path="/privacy/analytics" component={PrivacyAnalytics} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CartProvider>
          <Toaster />
          <RouteTracker />
          <Router />
        </CartProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
