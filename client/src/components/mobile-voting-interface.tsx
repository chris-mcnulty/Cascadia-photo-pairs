import { useState, useEffect } from "react";
import { Photo, Settings } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Heart, ChevronLeft, ChevronRight, Zap, Menu, X, Smartphone, Plus, MousePointer, RefreshCw, Infinity, Globe, Mail, Share2, MessageSquare, ArrowLeft, Settings as SettingsIcon } from "lucide-react";
import { FaInstagram, FaFacebookF, FaLinkedinIn } from "react-icons/fa6";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import UserProfile from "@/components/user-profile";
import SimpleAnnouncements from "@/components/simple-announcements";
import cascadiaLogoPath from "@assets/Cascadia-TP_1754453673312.png";

interface MobileVotingInterfaceProps {
  photoPair: [Photo, Photo];
  onVote: (winner: Photo, loser: Photo) => void;
  isVoting: boolean;
  settings?: Settings;
  onToggleView?: () => void;
  onShowInstallGuide?: () => void;
  votesCount?: number;
}



// Authentication status hook (replicating from home.tsx)
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

// Dynamic authentication buttons component for mobile
function AuthenticationButtons() {
  const { isAuthenticated, user, logout } = useUserAuth();

  if (isAuthenticated) {
    return (
      <div className="flex flex-col gap-3">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={logout}
          className="w-full"
        >
          Sign Out
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Link href="/login">
        <Button variant="outline" size="sm" className="w-full">
          Sign In
        </Button>
      </Link>
      <Link href="/signup">
        <Button size="sm" className="bg-cascadia-green hover:bg-green-700 w-full">
          Sign Up
        </Button>
      </Link>
    </div>
  );
}

export default function MobileVotingInterface({ 
  photoPair, 
  onVote, 
  isVoting, 
  settings,
  onToggleView,
  onShowInstallGuide,
  votesCount = 0
}: MobileVotingInterfaceProps) {
  const [photoA, photoB] = photoPair;
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Touch gesture support
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

  const minSwipeDistance = 50;

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.targetTouches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
    setTouchEnd(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.targetTouches[0];
    setTouchEnd({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = Math.abs(touchStart.y - touchEnd.y);

    // Only trigger swipe if horizontal movement is greater than vertical
    if (Math.abs(distanceX) > minSwipeDistance && Math.abs(distanceX) > distanceY) {
      if (distanceX > 0) {
        // Swipe left - vote for right photo
        onVote(photoB, photoA);
      } else {
        // Swipe right - vote for left photo
        onVote(photoA, photoB);
      }
    }
  };

  const handlePhotoSelect = (photo: Photo) => {
    setSelectedPhoto(photo);
    setTimeout(() => {
      const otherPhoto = photo.id === photoA.id ? photoB : photoA;
      onVote(photo, otherPhoto);
      setSelectedPhoto(null);
    }, 200);
  };

  return (
    <div className="w-full">
      {/* Mobile Interface */}
      <div className="md:hidden">
        {/* Mobile Header with Navigation */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="flex items-center justify-between p-4">
            {/* Logo - centered with more space */}
            <div className="flex items-center space-x-3 flex-1 justify-center">
              <div className="w-8 h-8 rounded overflow-hidden">
                <img 
                  src={cascadiaLogoPath} 
                  alt="Cascadia Oceanic" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h1 className="text-lg font-semibold font-epilogue" style={{ color: 'hsl(145, 37%, 28%)' }}>Cascadia Oceanic</h1>
                <p className="text-xs text-gray-600">Photo Voting</p>
              </div>
            </div>

            {/* Mobile Menu Button and User Profile */}
            <div className="flex items-center gap-2">
              <UserProfile />
              {/* Admin panel - only show when logged in */}
              {typeof window !== 'undefined' && localStorage.getItem('admin-session-id') && (
                <Link href="/admin">
                  <Button variant="ghost" size="icon" className="p-2">
                    <SettingsIcon className="h-5 w-5 text-green-600" />
                  </Button>
                </Link>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            </div>
          </div>

          {/* Mobile Menu Dropdown */}
          {mobileMenuOpen && (
            <div className="absolute top-full left-0 right-0 bg-white border-b border-gray-200 shadow-lg z-50">
              <div className="flex flex-col space-y-4 p-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onShowInstallGuide?.();
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2 justify-center"
                >
                  <Plus className="w-4 h-4" />
                  Install App
                </Button>
                
                <Link href="/leaderboard">
                  <Button variant="ghost" size="sm" className="text-gray-700 hover:text-green-700 transition-colors duration-200 font-medium text-center w-full" onClick={() => setMobileMenuOpen(false)}>
                    Leaderboard
                  </Button>
                </Link>

                <a 
                  href="https://www.chrismcnulty.net/photography" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-700 hover:text-green-700 transition-colors duration-200 font-medium text-center"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Visit Gallery
                </a>
                
                <a 
                  href="https://www.instagram.com/cascadia.oceanic/" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-700 hover:text-green-700 transition-colors duration-200 font-medium flex items-center gap-1 justify-center"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <FaInstagram className="w-4 h-4" />
                  Instagram
                </a>

                {/* Authentication Buttons */}
                {settings?.userLoginEnabledDev && (
                  <AuthenticationButtons />
                )}
                
                {!settings?.userLoginEnabledDev && (
                  <a 
                    href="https://www.chrismcnulty.net/subscribe" 
                    className="bg-cascadia-green text-white px-6 py-2 rounded-lg hover:bg-opacity-90 transition-all duration-200 font-medium text-center"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Subscribe
                  </a>
                )}
              </div>
            </div>
          )}
        </header>

        {/* Announcements */}
        <SimpleAnnouncements />

        {/* Voting Header */}
        <div className="p-6 text-center bg-white border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 font-epilogue">Choose Your Favorite</h2>
          <p className="text-sm text-gray-600 mt-2">Tap the photo you prefer</p>
        </div>

        {/* Photo Pair for Mobile */}
        <div className="space-y-8 p-6 bg-gray-50 min-h-screen pb-20">
          {/* Photo A */}
          <div 
            className="relative bg-white rounded-xl shadow-xl overflow-hidden cursor-pointer transform transition-all duration-200 active:scale-98 border border-gray-200"
            onClick={() => handlePhotoSelect(photoA)}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="aspect-[4/3] relative bg-gray-100 mx-4 mt-4 rounded-lg overflow-hidden">
              <img 
                src={photoA.imageUrl} 
                alt={photoA.title}
                className="w-full h-full object-contain"
                loading="lazy"
              />
              {selectedPhoto?.id === photoA.id && (
                <div className="absolute inset-0 bg-cascadia-green/20 flex items-center justify-center">
                  <div className="bg-cascadia-green rounded-full p-3">
                    <Heart className="w-6 h-6 text-white fill-white" />
                  </div>
                </div>
              )}
            </div>
            <div className="p-6">
              <h3 className="font-semibold text-lg text-gray-900 font-epilogue">{photoA.title}</h3>
              {photoA.description && (
                <p className="text-sm text-gray-600 mt-2">{photoA.description}</p>
              )}
            </div>
          </div>

          {/* Versus indicator */}
          <div className="text-center">
            <div className="inline-block bg-cascadia-green px-6 py-3 rounded-full shadow-lg">
              <span className="text-base font-semibold text-white">VS</span>
            </div>
          </div>

          {/* Photo B */}
          <div 
            className="relative bg-white rounded-xl shadow-xl overflow-hidden cursor-pointer transform transition-all duration-200 active:scale-98 border border-gray-200"
            onClick={() => handlePhotoSelect(photoB)}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="aspect-[4/3] relative bg-gray-100 mx-4 mt-4 rounded-lg overflow-hidden">
              <img 
                src={photoB.imageUrl} 
                alt={photoB.title}
                className="w-full h-full object-contain"
                loading="lazy"
              />
              {selectedPhoto?.id === photoB.id && (
                <div className="absolute inset-0 bg-cascadia-green/20 flex items-center justify-center">
                  <div className="bg-cascadia-green rounded-full p-3">
                    <Heart className="w-6 h-6 text-white fill-white" />
                  </div>
                </div>
              )}
            </div>
            <div className="p-6">
              <h3 className="font-semibold text-lg text-gray-900 font-epilogue">{photoB.title}</h3>
              {photoB.description && (
                <p className="text-sm text-gray-600 mt-2">{photoB.description}</p>
              )}
            </div>
          </div>

          {/* Voting Progress */}
          <Card className="bg-white mx-6 mt-8 mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 font-epilogue">Your Voting Progress</h3>
                <div className="text-sm text-gray-600">
                  {votesCount} votes cast
                </div>
              </div>
              <Progress value={Math.min((votesCount / 30) * 100, 100)} className="h-2" />
              <p className="text-xs text-gray-500 mt-2">Keep voting to help us curate the exhibition!</p>
            </CardContent>
          </Card>

          {/* Voting Instructions */}
          <div className="text-center px-6 mb-8">
            <p className="text-gray-600 mb-4">Tap on your preferred artwork to vote</p>
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-500">
              <div className="flex items-center">
                <MousePointer className="w-4 h-4 mr-2" />
                Tap to vote
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
          </div>

          {/* Call to Action Section */}
          <div className="bg-gradient-to-r from-green-700 to-green-600 rounded-2xl mx-6 p-8 text-white text-center mb-8">
            <div className="max-w-3xl mx-auto">
              <h3 className="text-2xl font-bold mb-4 font-epilogue">Explore More Photography</h3>
              <p className="text-lg mb-6 opacity-90">
                Discover the complete collection of landscape and nature photography at Chris McNulty's gallery.
              </p>
              <div className="flex flex-col gap-4">
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

          {/* Mobile Footer */}
          <footer className="bg-gray-50 border-t border-gray-200">
            <div className="px-6 py-8">
              <div className="space-y-8">
                
                {/* About Section */}
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-3 mb-4">
                    <div className="w-8 h-8 rounded overflow-hidden">
                      <img 
                        src={cascadiaLogoPath} 
                        alt="Cascadia Oceanic" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <h3 className="text-lg font-semibold font-epilogue" style={{ color: 'hsl(145, 37%, 28%)' }}>Cascadia Oceanic</h3>
                  </div>
                  <p className="text-gray-600 text-sm mb-4">
                    Images of the Pacific & Atlantic coasts, and the land in between.
                  </p>
                </div>

                {/* Quick Links */}
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 font-epilogue">Explore</h3>
                  <div className="flex flex-wrap justify-center gap-4 text-sm">
                    <a 
                      href="/leaderboard"
                      className="text-gray-600 hover:text-green-700 transition-colors duration-200"
                    >
                      Leaderboard
                    </a>
                    <a 
                      href="https://www.chrismcnulty.net/photography/landscapes" 
                      className="text-gray-600 hover:text-green-700 transition-colors duration-200"
                    >
                      Landscapes
                    </a>
                    <a 
                      href="https://www.chrismcnulty.net/photography/seascapes" 
                      className="text-gray-600 hover:text-green-700 transition-colors duration-200"
                    >
                      Seascapes
                    </a>
                    <a 
                      href="https://www.chrismcnulty.net/photography/cityscapes" 
                      className="text-gray-600 hover:text-green-700 transition-colors duration-200"
                    >
                      Cityscapes
                    </a>
                    <a 
                      href="https://www.chrismcnulty.net/about" 
                      className="text-gray-600 hover:text-green-700 transition-colors duration-200"
                    >
                      About the Artist
                    </a>
                  </div>
                </div>

                {/* Sharing Links */}
                <div className="text-center">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 font-epilogue">Share This Page</h4>
                  <div className="flex justify-center gap-4">
                    <a
                      href={`sms:?body=Check out this photo voting page: ${window.location.href}`}
                      className="bg-gray-100 hover:bg-green-100 p-3 rounded-lg transition-colors duration-200"
                      title="Share via Text Message"
                    >
                      <MessageSquare className="w-5 h-5 text-gray-600 hover:text-green-600" />
                    </a>
                    <a
                      href={`mailto:?subject=Photo Voting Page&body=Check out this photo voting page: ${window.location.href}`}
                      className="bg-gray-100 hover:bg-blue-100 p-3 rounded-lg transition-colors duration-200"
                      title="Share via Email"
                    >
                      <Mail className="w-5 h-5 text-gray-600 hover:text-blue-600" />
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

                {/* Copyright */}
                <div className="text-center border-t border-gray-200 pt-6">
                  <p className="text-gray-500 text-sm">
                    © Christopher F. McNulty 2025. All rights reserved.
                  </p>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* Desktop side-by-side view */}
      <div className="hidden md:grid md:grid-cols-2 gap-4 p-4 h-[70vh]">
        <div 
          className="relative cursor-pointer group"
          onClick={() => handlePhotoSelect(photoA)}
        >
          <img 
            src={photoA.imageUrl} 
            alt={photoA.title}
            className={`w-full h-full object-contain rounded-lg transition-all duration-200 ${
              selectedPhoto?.id === photoA.id ? 'scale-105 brightness-110' : ''
            } ${isVoting ? 'opacity-50' : 'group-hover:scale-105'}`}
          />
          <div className="absolute bottom-4 left-4 right-4 bg-black/70 rounded-lg p-3">
            <h3 className="font-semibold text-lg text-white">{photoA.title}</h3>
            {photoA.description && (
              <p className="text-sm text-gray-300 mt-1">{photoA.description}</p>
            )}
          </div>
          {selectedPhoto?.id === photoA.id && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-green-500 rounded-full p-4">
                <Heart className="w-8 h-8 text-white fill-white" />
              </div>
            </div>
          )}
        </div>

        <div 
          className="relative cursor-pointer group"
          onClick={() => handlePhotoSelect(photoB)}
        >
          <img 
            src={photoB.imageUrl} 
            alt={photoB.title}
            className={`w-full h-full object-contain rounded-lg transition-all duration-200 ${
              selectedPhoto?.id === photoB.id ? 'scale-105 brightness-110' : ''
            } ${isVoting ? 'opacity-50' : 'group-hover:scale-105'}`}
          />
          <div className="absolute bottom-4 left-4 right-4 bg-black/70 rounded-lg p-3">
            <h3 className="font-semibold text-lg text-white">{photoB.title}</h3>
            {photoB.description && (
              <p className="text-sm text-gray-300 mt-1">{photoB.description}</p>
            )}
          </div>
          {selectedPhoto?.id === photoB.id && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-green-500 rounded-full p-4">
                <Heart className="w-8 h-8 text-white fill-white" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}