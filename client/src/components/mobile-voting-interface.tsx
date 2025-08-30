import { useState, useEffect } from "react";
import { Photo, Settings } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Heart, ArrowLeft, Settings as SettingsIcon, ShoppingCart, Menu, X, Plus, Monitor, Globe, Share2, MessageSquare, Facebook } from "lucide-react";
import { FaInstagram, FaThreads, FaBluesky, FaXTwitter, FaFacebookF, FaLinkedinIn } from "react-icons/fa6";
import { Link } from "wouter";
import UserProfile from "@/components/user-profile";
import SimpleAnnouncements from "@/components/simple-announcements";
// import AuthenticationButtons from "@/components/authentication-buttons";
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

// Authentication status hook
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
          setIsAuthenticated(false);
          setUser(null);
          localStorage.removeItem('auth-token');
        }
      } catch (error) {
        setIsAuthenticated(false);
        setUser(null);
        localStorage.removeItem('auth-token');
      }
    };

    checkAuth();
  }, []);

  return { isAuthenticated, user };
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const { isAuthenticated } = useUserAuth();

  const minSwipeDistance = 50;

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
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
    <div className="min-h-screen bg-gray-50">
      {/* Rich Mobile Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="flex items-center justify-between p-4">
          {/* Logo and Title */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded overflow-hidden">
              <img 
                src={cascadiaLogoPath} 
                alt="Cascadia Oceanic" 
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h1 className="font-bold text-lg text-gray-900">Cascadia Oceanic</h1>
              <p className="text-xs text-gray-600">Photo Voting</p>
            </div>
          </div>

          {/* Mobile Actions */}
          <div className="flex items-center gap-2">
            <UserProfile />
            {/* Admin panel */}
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
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Rich Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-white border-b border-gray-200 shadow-lg z-50">
            <div className="grid grid-cols-2 gap-3 p-4">
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
                <Button variant="outline" size="sm" className="text-gray-700 hover:text-green-700 transition-colors duration-200 font-medium text-center w-full" onClick={() => setMobileMenuOpen(false)}>
                  Leaderboard
                </Button>
              </Link>

              {/* Switch to Desktop Mode */}
              {onToggleView && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onToggleView();
                    setMobileMenuOpen(false);
                  }}
                  className="text-gray-700 hover:text-green-700 transition-colors duration-200 font-medium text-center col-span-2"
                >
                  <Monitor className="w-4 h-4 mr-2" />
                  Switch to Desktop Mode
                </Button>
              )}

              <a 
                href="https://www.chrismcnulty.net/photography" 
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg text-gray-700 hover:text-green-700 transition-colors duration-200 font-medium text-center text-sm"
                onClick={() => setMobileMenuOpen(false)}
              >
                Visit Gallery
              </a>
              
              <a 
                href="https://www.instagram.com/cascadia.oceanic/" 
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg text-gray-700 hover:text-green-700 transition-colors duration-200 font-medium flex items-center gap-1 justify-center text-sm"
                onClick={() => setMobileMenuOpen(false)}
              >
                <FaInstagram className="w-4 h-4" />
                Instagram
              </a>

              {/* Authentication Buttons */}
              {(settings?.userLoginEnabledDev || settings?.userLoginEnabledProd) && (
                <div className="col-span-2 space-y-2">
                  <Link href="/login">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/signup">
                    <Button 
                      size="sm" 
                      className="w-full bg-cascadia-green hover:bg-green-700"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Sign Up
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Announcements */}
      <SimpleAnnouncements />

      {/* Rich Mobile Photo Voting Interface */}
      <div className="px-2 pb-20">
        {/* Voting Instructions */}
        <div className="text-center py-4 px-2">
          <h2 className="text-xl font-bold text-gray-900 mb-3">Choose Your Favorite</h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            Help me curate the photos for my next exhibition. I've added some of my classic and newest images to discover here. 
            Click on your preferred photo to vote, then continue with the next pair. Vote as many times as you like!
          </p>

        </div>

        {/* Photo Cards - Stacked Mobile Layout */}
        <div className="space-y-3">
          {/* Photo A Card */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div 
              className="relative cursor-pointer transform transition-all duration-200 active:scale-98"
              onClick={() => handlePhotoSelect(photoA)}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="relative bg-gray-100 overflow-hidden flex items-center justify-center" style={{ height: '350px' }}>
                <img 
                  src={photoA.imageUrl} 
                  alt={photoA.title}
                  className="max-w-full max-h-full object-contain"
                  loading="lazy"
                />
                {selectedPhoto?.id === photoA.id && (
                  <div className="absolute inset-0 bg-cascadia-green/20 flex items-center justify-center">
                    <div className="bg-cascadia-green rounded-full p-4">
                      <Heart className="w-8 h-8 text-white fill-white" />
                    </div>
                  </div>
                )}
              </div>
              
              {/* Photo Details */}
              <div className="p-4">
                <h3 className="font-bold text-lg text-gray-900 mb-2">{photoA.title}</h3>
                {photoA.description && (
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">{photoA.description}</p>
                )}
                
                {/* Purchase Button */}
                {settings?.purchaseEnabled && !photoA.neverForSale && (
                  <div className="mt-3">
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        const purchaseUrl = photoA.customPurchaseUrl || settings?.defaultPurchaseUrl || "https://www.chrismcnulty.net/store";
                        const newWindow = window.open(purchaseUrl, '_blank');
                        if (!newWindow) {
                          window.location.href = purchaseUrl;
                        }
                      }}
                      className="w-full bg-cascadia-green hover:bg-cascadia-green/90 text-white border-none"
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Purchase
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* VS Divider */}
          <div className="text-center py-1">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-200 rounded-full">
              <span className="text-gray-600 font-bold text-lg">VS</span>
            </div>
          </div>

          {/* Photo B Card */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div 
              className="relative cursor-pointer transform transition-all duration-200 active:scale-98"
              onClick={() => handlePhotoSelect(photoB)}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="relative bg-gray-100 overflow-hidden flex items-center justify-center" style={{ height: '350px' }}>
                <img 
                  src={photoB.imageUrl} 
                  alt={photoB.title}
                  className="max-w-full max-h-full object-contain"
                  loading="lazy"
                />
                {selectedPhoto?.id === photoB.id && (
                  <div className="absolute inset-0 bg-cascadia-green/20 flex items-center justify-center">
                    <div className="bg-cascadia-green rounded-full p-4">
                      <Heart className="w-8 h-8 text-white fill-white" />
                    </div>
                  </div>
                )}
              </div>
              
              {/* Photo Details */}
              <div className="p-4">
                <h3 className="font-bold text-lg text-gray-900 mb-2">{photoB.title}</h3>
                {photoB.description && (
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">{photoB.description}</p>
                )}
                
                {/* Purchase Button */}
                {settings?.purchaseEnabled && !photoB.neverForSale && (
                  <div className="mt-3">
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        const purchaseUrl = photoB.customPurchaseUrl || settings?.defaultPurchaseUrl || "https://www.chrismcnulty.net/store";
                        const newWindow = window.open(purchaseUrl, '_blank');
                        if (!newWindow) {
                          window.location.href = purchaseUrl;
                        }
                      }}
                      className="w-full bg-cascadia-green hover:bg-cascadia-green/90 text-white border-none"
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Purchase
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Voting Progress */}
        <div className="mt-8 mb-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Your Progress</h3>
              <div className="text-sm text-gray-600">
                {votesCount} votes cast
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
              <div 
                className="bg-cascadia-green h-3 rounded-full transition-all duration-300" 
                style={{ width: `${Math.min((votesCount / 30) * 100, 100)}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500">Keep voting to help curate the exhibition!</p>
          </div>
        </div>

        {/* Bottom Call to Action */}
        <div className="mt-8 mb-6">
          <div className="bg-gradient-to-r from-green-700 to-green-600 rounded-xl p-6 text-white text-center">
            <h3 className="text-lg font-bold mb-2">Explore More Photography</h3>
            <p className="text-sm mb-4 opacity-90">
              Discover the complete collection of landscape and nature photography.
            </p>
            <div className="flex flex-col gap-3">
              <a 
                href="https://www.chrismcnulty.net/photography" 
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white text-green-700 px-6 py-3 rounded-lg font-semibold hover:bg-opacity-90 transition-all duration-200 text-center"
              >
                View Full Gallery
              </a>
              <a 
                href="https://www.chrismcnulty.net/subscribe" 
                className="border-2 border-white text-white px-6 py-3 rounded-lg font-semibold hover:bg-white hover:text-green-700 transition-all duration-200 text-center"
              >
                Subscribe for Updates
              </a>
            </div>
          </div>
        </div>

        {/* Enhanced Mobile Footer */}
        <footer className="mt-12 py-8 border-t border-gray-200 bg-white">
          <div className="px-4 space-y-6">
            {/* Logo and Branding */}
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-10 h-10 rounded overflow-hidden">
                  <img 
                    src={cascadiaLogoPath} 
                    alt="Cascadia Oceanic" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="font-bold text-xl text-gray-900">Cascadia Oceanic</span>
              </div>
              <p className="text-gray-700 text-sm font-medium">
                Images of the Pacific & Atlantic coasts, and the lands in between.
              </p>
              <p className="text-gray-600 text-xs max-w-sm mx-auto">
                Landscape photography showcasing the natural beauty of the Pacific Northwest and beyond.
              </p>
            </div>

            {/* Purchase Call-to-Action */}
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <h3 className="font-semibold text-gray-900 mb-2">Own a Piece of Nature</h3>
              <p className="text-sm text-gray-600 mb-3">
                Museum-quality prints available in various sizes. Each purchase supports conservation efforts.
              </p>
              <a 
                href="https://www.chrismcnulty.net/store" 
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-cascadia-green text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                Browse Print Store
              </a>
            </div>

            {/* Quick Links */}
            <div className="grid grid-cols-2 gap-3 text-center">
              <a 
                href="https://www.chrismcnulty.net/photography" 
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gray-100 py-3 px-4 rounded-lg text-gray-700 hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                Full Gallery
              </a>
              <a 
                href="https://www.chrismcnulty.net/biography" 
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gray-100 py-3 px-4 rounded-lg text-gray-700 hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                About the Artist
              </a>
              <a 
                href="https://www.chrismcnulty.net/contact-me" 
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gray-100 py-3 px-4 rounded-lg text-gray-700 hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                Contact
              </a>
              <a 
                href="https://www.chrismcnulty.net/subscribe" 
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gray-100 py-3 px-4 rounded-lg text-gray-700 hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                Newsletter
              </a>
            </div>
            
            {/* Social Links */}
            <div className="flex justify-center space-x-8 py-4">
              <a 
                href="https://www.instagram.com/cascadia.oceanic/" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-green-600 transition-colors duration-200"
              >
                <FaInstagram className="w-7 h-7" />
              </a>
              <a 
                href="https://www.chrismcnulty.net" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-green-600 transition-colors duration-200"
              >
                <Globe className="w-7 h-7" />
              </a>
            </div>
            
            {/* Copyright and Exhibition Message */}
            <div className="text-center border-t pt-4">
              <p className="text-xs text-gray-500">© 2025 Christopher F. McNulty</p>
              <p className="text-xs text-gray-500 mt-1">Your votes help curate the next exhibition</p>
              
              {/* Share Icons */}
              <div className="flex justify-center items-center gap-4 mt-4 pt-4">
                <button
                  onClick={() => {
                    const shareUrl = `https://www.instagram.com/cascadia.oceanic/`;
                    window.open(shareUrl, '_blank');
                  }}
                  className="text-gray-400 hover:text-pink-600 transition-colors"
                  title="Instagram"
                >
                  <FaInstagram className="h-5 w-5" />
                </button>
                <button
                  onClick={() => {
                    const shareUrl = `https://www.threads.net/intent/post?text=${encodeURIComponent('Check out these amazing landscape photos! Vote for your favorites at ' + window.location.href)}`;
                    window.open(shareUrl, '_blank');
                  }}
                  className="text-gray-400 hover:text-gray-700 transition-colors"
                  title="Threads"
                >
                  <FaThreads className="h-5 w-5" />
                </button>
                <button
                  onClick={() => {
                    const shareUrl = `https://bsky.app/intent/compose?text=${encodeURIComponent('Check out these amazing landscape photos! Vote for your favorites at ' + window.location.href)}`;
                    window.open(shareUrl, '_blank');
                  }}
                  className="text-gray-400 hover:text-blue-500 transition-colors"
                  title="Bluesky"
                >
                  <FaBluesky className="h-5 w-5" />
                </button>
                <button
                  onClick={() => {
                    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Check out these amazing landscape photos! Vote for your favorites at ' + window.location.href)}`;
                    window.open(shareUrl, '_blank');
                  }}
                  className="text-gray-400 hover:text-gray-900 transition-colors"
                  title="X"
                >
                  <FaXTwitter className="h-5 w-5" />
                </button>
                <button
                  onClick={() => {
                    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`;
                    window.open(shareUrl, '_blank');
                  }}
                  className="text-gray-400 hover:text-blue-600 transition-colors"
                  title="Facebook"
                >
                  <FaFacebookF className="h-5 w-5" />
                </button>
                <button
                  onClick={() => {
                    const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`;
                    window.open(shareUrl, '_blank');
                  }}
                  className="text-gray-400 hover:text-blue-700 transition-colors"
                  title="LinkedIn"
                >
                  <FaLinkedinIn className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}