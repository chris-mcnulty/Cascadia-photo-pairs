import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Photo, Settings } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import VotingInterface from "@/components/voting-interface";
import MobileVotingInterface from "@/components/mobile-voting-interface";
import FocusModeInterface from "@/components/focus-mode-interface";

import { IOSInstallGuide } from "@/components/ios-install-guide";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Menu, X, Globe, Mail, Heart, MousePointer, RefreshCw, Infinity, Smartphone, Monitor, Share2, MessageSquare, Facebook, Linkedin, Twitter, Plus } from "lucide-react";
import { FaInstagram, FaThreads, FaBluesky } from "react-icons/fa6";
import { FaFacebookF, FaLinkedinIn, FaXTwitter } from "react-icons/fa6";
import cascadiaLogoPath from "@assets/Cascadia-TP_1754453673312.png";
import { useTitle } from "@/hooks/use-title";
import UserProfile from "@/components/user-profile";
import SimpleAnnouncements from "@/components/simple-announcements";

// Authentication status hook (for both admin and regular users)
function useUserAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('auth-token');
        if (!token) {
          setIsAuthenticated(false);
          setUser(null);
          return;
        }

        const response = await fetch('/api/auth/user', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const userData = await response.json();
          setIsAuthenticated(true);
          setUser(userData);
        } else {
          localStorage.removeItem('auth-token');
          setIsAuthenticated(false);
          setUser(null);
        }
      } catch (error) {
        localStorage.removeItem('auth-token');
        setIsAuthenticated(false);
        setUser(null);
      }
    };

    checkAuth();
  }, []);

  const logout = () => {
    localStorage.removeItem('auth-token');
    setIsAuthenticated(false);
    setUser(null);
    window.location.href = '/';
  };

  return { isAuthenticated, user, logout };
}

// Dynamic authentication buttons component
function AuthenticationButtons({ isMobile = false }: { isMobile?: boolean }) {
  const { isAuthenticated, user, logout } = useUserAuth();

  if (isAuthenticated) {
    return (
      <div className={isMobile ? "flex flex-col gap-3" : "flex items-center gap-3"}>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={logout}
          className={isMobile ? "w-full" : ""}
        >
          Sign Out
        </Button>
      </div>
    );
  }

  return (
    <div className={isMobile ? "flex flex-col gap-3" : "flex items-center gap-3"}>
      <Link href="/login">
        <Button variant="outline" size="sm" className={isMobile ? "w-full" : ""}>
          Sign In
        </Button>
      </Link>
      <Link href="/signup">
        <Button size="sm" className={`bg-cascadia-green hover:bg-green-700 ${isMobile ? "w-full" : ""}`}>
          Sign Up
        </Button>
      </Link>
    </div>
  );
}

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [useMobileInterface, setUseMobileInterface] = useState(false);
  const [useFocusMode, setUseFocusMode] = useState(false);
  const [votesCount, setVotesCount] = useState(0);
  const [hasVoted, setHasVoted] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const { toast } = useToast();

  useTitle(); // Uses default title

  // Detect if user is on mobile
  useEffect(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
      || (window.innerWidth <= 768);
    setUseMobileInterface(isMobile);
  }, []);

  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const { data: photoPair, refetch: refetchPair } = useQuery<[Photo, Photo]>({
    queryKey: ["/api/photos/random-pair"],
  });

  const voteMutation = useMutation({
    mutationFn: async ({ photoId, winnerPhotoId, loserPhotoId }: { 
      photoId: string; 
      winnerPhotoId: string; 
      loserPhotoId: string; 
    }) => {
      // Include session ID if admin is logged in for vote segregation
      const sessionId = localStorage.getItem('admin-session-id');
      const headers = sessionId ? { 'x-session-id': sessionId } : undefined;
      
      const response = await apiRequest("POST", "/api/votes", { 
        photoId, 
        winnerPhotoId, 
        loserPhotoId 
      }, headers);
      return response.json();
    },
    onSuccess: () => {
      setVotesCount(prev => prev + 1);
      if (!hasVoted) {
        setHasVoted(true);
      }
      refetchPair();
      toast({
        title: "Thanks. Here's your next pair.",
      });
    },
    onError: () => {
      toast({
        title: "Vote failed",
        description: "There was an error recording your vote. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleVote = (winnerPhoto: Photo, loserPhoto: Photo) => {
    voteMutation.mutate({
      photoId: winnerPhoto.id,
      winnerPhotoId: winnerPhoto.id,
      loserPhotoId: loserPhoto.id,
    });
  };

  const progressPercentage = Math.min((votesCount / 30) * 100, 100);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header - only show for desktop */}
      {!useMobileInterface && (
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo and Title */}
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-lg overflow-hidden">
                <img 
                  src={cascadiaLogoPath} 
                  alt="Cascadia Oceanic Logo" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h1 className="text-2xl font-semibold cascadia-green">Cascadia Oceanic</h1>
                <p className="text-sm text-gray-600">Photo Voting</p>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="hidden md:flex items-center space-x-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUseMobileInterface(!useMobileInterface)}
                className="flex items-center gap-2"
              >
                <Smartphone className="w-4 h-4" />
                {useMobileInterface ? "Exit Focus Mode" : "Focus Mode"}
              </Button>
              <a 
                href="https://www.chrismcnulty.net/photography" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-700 hover:text-green-700 transition-colors duration-200 font-medium"
              >
                Visit Gallery
              </a>
              <a 
                href="https://www.instagram.com/cascadia.oceanic/" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-700 hover:text-green-700 transition-colors duration-200 font-medium flex items-center gap-1"
              >
                <FaInstagram className="w-4 h-4" />
                Instagram
              </a>
              <Link 
                href="/leaderboard"
                className="text-gray-700 hover:text-green-700 transition-colors duration-200 font-medium"
              >
                Leaderboard
              </Link>
              {settings?.userLoginEnabledDev && (
                <AuthenticationButtons />
              )}
              <UserProfile />
              {/* Admin panel - only show when logged in */}
              {localStorage.getItem('admin-session-id') && (
                <Link href="/admin">
                  <Button variant="outline" size="sm" className="bg-green-50 border-green-300">
                    Admin Panel
                  </Button>
                </Link>
              )}
            </nav>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-gray-100 py-4">
              <div className="flex flex-col space-y-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUseMobileInterface(!useMobileInterface)}
                  className="flex items-center gap-2 justify-center"
                >
                  <Smartphone className="w-4 h-4" />
  {useMobileInterface ? "Exit Focus Mode" : "Focus Mode"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowInstallGuide(true);
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2 justify-center"
                >
                  <Plus className="w-4 h-4" />
                  Install App
                </Button>
                <a 
                  href="https://www.chrismcnulty.net/photography" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-700 hover:text-green-700 transition-colors duration-200 font-medium"
                >
                  Visit Gallery
                </a>
                <a 
                  href="https://www.instagram.com/cascadia.oceanic/" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-700 hover:text-green-700 transition-colors duration-200 font-medium flex items-center gap-1"
                >
                  <FaInstagram className="w-4 h-4" />
                  Instagram
                </a>
                <Link
                  href="/leaderboard"
                  className="text-gray-700 hover:text-green-700 transition-colors duration-200 font-medium"
                >
                  Leaderboard
                </Link>
                {settings?.userLoginEnabledDev && (
                  <AuthenticationButtons isMobile />
                )}
                {!settings?.userLoginEnabledDev && (
                  <a 
                    href="https://www.chrismcnulty.net/subscribe" 
                    className="bg-cascadia-green text-white px-6 py-2 rounded-lg hover:bg-opacity-90 transition-all duration-200 font-medium text-center"
                  >
                    Subscribe
                  </a>
                )}
                <a 
                  href="/admin"
                  className="text-gray-700 hover:text-green-700 transition-colors duration-200 font-medium"
                >
                  Admin
                </a>
              </div>
            </div>
          )}
        </div>
      </header>
      )}

      {/* Mobile Interface - Rich Mobile Experience */}
      {useMobileInterface && photoPair ? (
        <MobileVotingInterface 
          photoPair={photoPair}
          onVote={handleVote}
          isVoting={voteMutation.isPending}
          settings={settings}
          onToggleView={() => setUseMobileInterface(false)}
          onShowInstallGuide={() => setShowInstallGuide(true)}
          votesCount={votesCount}
        />
      ) : useFocusMode && photoPair ? (
        /* Focus Mode - Desktop Only */
        <FocusModeInterface 
          photoPair={photoPair}
          onVote={handleVote}
          isVoting={voteMutation.isPending}
          settings={settings}
          onToggleView={() => setUseFocusMode(false)}
          onShowInstallGuide={() => setShowInstallGuide(true)}
          votesCount={votesCount}
        />
      ) : (
        <>
          {/* Announcements outside main container for full-width header bar */}
          <SimpleAnnouncements />
          
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          
          {/* Introduction Section */}
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Choose Your Favorite</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Help me curate the photos for my next exhibition. I've added some of my classic and newest images to discover here. Click on your preferred photo to vote, then continue with the next pair. Vote as many times as you like!
            </p>
          </div>



          {/* Desktop Voting Interface */}
          {photoPair && (
            <VotingInterface 
              photoPair={photoPair}
              onVote={handleVote}
              isVoting={voteMutation.isPending}
              settings={settings}
            />
          )}

          {/* Voting Instructions with Mobile Mode Toggle */}
          <div className="text-center mt-8 mb-12">
            <p className="text-gray-600 mb-4">Click on your preferred artwork to vote</p>
            <div className="flex items-center justify-center space-x-4 text-sm text-gray-500">
              <div className="flex items-center">
                <MousePointer className="w-4 h-4 mr-2" />
                Click to vote
              </div>
              <div className="flex items-center">
                <RefreshCw className="w-4 h-4 mr-2" />
                Auto-load next pair
              </div>
              <div className="flex items-center">
                <Infinity className="w-4 h-4 mr-2" />
                Vote unlimited times
              </div>
            </div>
            
            {/* Desktop Focus Mode Toggle Button */}
            <div className="mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUseFocusMode(true)}
                className="text-gray-600 hover:text-gray-900"
              >
                <Monitor className="w-4 h-4 mr-2" />
                Switch to Focus Mode
              </Button>
              <p className="text-xs text-gray-500 mt-2">A distraction-free voting experience with side-by-side photos</p>
            </div>
          </div>

          {/* Voting Progress - Desktop Only */}
          <Card className="bg-cascadia-light mb-12">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Your Voting Progress</h3>
                <div className="text-sm text-gray-600">
                  {votesCount} votes cast
                </div>
              </div>
              <Progress value={progressPercentage} className="h-2" />
              <p className="text-xs text-gray-500 mt-2">Keep voting to help us curate the exhibition!</p>
            </CardContent>
          </Card>

          {/* Call to Action Section */}
        <div className="bg-gradient-to-r from-green-700 to-green-600 rounded-2xl p-8 text-white text-center">
          <div className="max-w-3xl mx-auto">
            <h3 className="text-2xl font-bold mb-4">Explore More Photography</h3>
            <p className="text-lg mb-6 opacity-90">
              Discover the complete collection of landscape and nature photography at Chris McNulty's gallery.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a 
                href="https://www.chrismcnulty.net/photography" 
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white text-green-700 px-8 py-3 rounded-lg font-semibold hover:bg-opacity-90 transition-all duration-200 inline-flex items-center justify-center"
              >
                <Globe className="w-4 h-4 mr-2" />
                View Full Gallery
              </a>
              <a 
                href="https://www.chrismcnulty.net/subscribe" 
                className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-green-700 transition-all duration-200 inline-flex items-center justify-center"
              >
                <Mail className="w-4 h-4 mr-2" />
                Subscribe for Updates
              </a>
            </div>
          </div>
        </div>

          </main>
        </>
      )}

      {/* Footer - only show for desktop */}
      {!useMobileInterface && (
      <footer className="bg-gray-50 border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-3 gap-8">
            
            {/* About Section */}
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-8 h-8 rounded overflow-hidden">
                  <img 
                    src={cascadiaLogoPath} 
                    alt="Cascadia Oceanic" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <h3 className="text-lg font-semibold cascadia-green">Cascadia Oceanic</h3>
              </div>
              <p className="text-gray-600 text-sm mb-4">
                Images of the Pacific & Atlantic coasts, and the land in between.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Explore</h3>
              <ul className="space-y-2">
                <li>
                  <a 
                    href="https://www.chrismcnulty.net/photography/landscapes" 
                    className="text-gray-600 hover:text-green-700 transition-colors duration-200 text-sm"
                  >
                    Landscapes
                  </a>
                </li>
                <li>
                  <a 
                    href="https://www.chrismcnulty.net/photography/seascapes" 
                    className="text-gray-600 hover:text-green-700 transition-colors duration-200 text-sm"
                  >
                    Seascapes  
                  </a>
                </li>
                <li>
                  <a 
                    href="https://www.chrismcnulty.net/photography/cityscapes" 
                    className="text-gray-600 hover:text-green-700 transition-colors duration-200 text-sm"
                  >
                    Cityscapes
                  </a>
                </li>
                <li>
                  <Link 
                    href="/leaderboard" 
                    className="text-gray-600 hover:text-green-700 transition-colors duration-200 text-sm"
                  >
                    Leaderboard
                  </Link>
                </li>
                <li>
                  <a 
                    href="https://www.chrismcnulty.net/subscribe" 
                    className="text-gray-600 hover:text-green-700 transition-colors duration-200 text-sm"
                  >
                    Subscribe
                  </a>
                </li>
                <li>
                  <a 
                    href="https://www.chrismcnulty.net/store" 
                    className="text-gray-600 hover:text-green-700 transition-colors duration-200 text-sm"
                  >
                    Purchase Prints
                  </a>
                </li>

              </ul>
            </div>

            {/* Contact */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Connect</h3>
              <div className="space-y-2">
                <p className="text-gray-600 text-sm">
                  <Globe className="w-4 h-4 mr-2 inline" />
                  <a 
                    href="https://www.chrismcnulty.net" 
                    className="hover:text-green-700 transition-colors duration-200"
                  >
                    chrismcnulty.net
                  </a>
                </p>
                <p className="text-gray-600 text-sm">
                  Bothell, WA
                </p>
              </div>
            </div>
          </div>

          {/* Sharing Links */}
          <div className="border-t border-gray-200 pt-8 mt-8">
            <div className="text-center mb-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Share This Page</h4>
              <div className="flex flex-wrap justify-center gap-4">
                <a
                  href={`sms:?body=Check out this photo voting page: ${window.location.href}`}
                  className="bg-gray-100 hover:bg-green-100 p-3 rounded-lg transition-colors duration-200"
                  title="Share via Text Message"
                >
                  <MessageSquare className="w-5 h-5 text-gray-600 hover:text-green-700" />
                </a>
                <a
                  href={`mailto:?subject=Check out this photo voting page&body=I thought you might enjoy voting on these photos: ${window.location.href}`}
                  className="bg-gray-100 hover:bg-green-100 p-3 rounded-lg transition-colors duration-200"
                  title="Share via Email"
                >
                  <Mail className="w-5 h-5 text-gray-600 hover:text-green-700" />
                </a>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-gray-100 hover:bg-blue-100 p-3 rounded-lg transition-colors duration-200"
                  title="Share on Facebook"
                >
                  <FaFacebookF className="w-5 h-5 text-gray-600 hover:text-blue-600" />
                </a>
                <a
                  href={`https://www.instagram.com/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-gray-100 hover:bg-pink-100 p-3 rounded-lg transition-colors duration-200"
                  title="Follow on Instagram"
                >
                  <FaInstagram className="w-5 h-5 text-gray-600 hover:text-pink-600" />
                </a>
                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-gray-100 hover:bg-blue-100 p-3 rounded-lg transition-colors duration-200"
                  title="Share on LinkedIn"
                >
                  <FaLinkedinIn className="w-5 h-5 text-gray-600 hover:text-blue-700" />
                </a>

              </div>
            </div>
          </div>

          {/* Copyright and Legal Links */}
          <div className="border-t border-gray-200 pt-8 mt-8 text-center">
            <p className="text-gray-500 text-sm mb-2">
              © Christopher F. McNulty 2025. All rights reserved.
            </p>
            <div className="flex justify-center space-x-4 text-sm">
              {settings?.privacyPolicyUrl && (
                <a 
                  href={settings.privacyPolicyUrl} 
                  className="text-gray-500 hover:text-green-700 transition-colors"
                >
                  Privacy Policy
                </a>
              )}
              {settings?.termsOfServiceUrl && (
                <a 
                  href={settings.termsOfServiceUrl} 
                  className="text-gray-500 hover:text-green-700 transition-colors"
                >
                  Terms of Service
                </a>
              )}
              {settings?.supportEmail && (
                <a 
                  href={`mailto:${settings.supportEmail}`} 
                  className="text-gray-500 hover:text-green-700 transition-colors"
                >
                  Contact Support
                </a>
              )}
            </div>
          </div>
        </div>
      </footer>
      )}
      
      {/* PWA Install Prompt - Disabled, only available via menu */}
      
      {/* iOS Install Guide */}
      <IOSInstallGuide 
        showInitial={false} 
        forceShow={showInstallGuide}
        onClose={() => setShowInstallGuide(false)}
      />
    </div>
  );
}
