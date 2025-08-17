import { useState, useEffect } from "react";
import { Photo, Settings } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Heart, ArrowLeft, Settings as SettingsIcon, ShoppingCart, Menu, X, Plus, Monitor } from "lucide-react";
import { FaInstagram } from "react-icons/fa6";
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
              <p className="text-xs text-gray-600">Choose Your Favorite</p>
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
              {settings?.userLoginEnabledDev && (
                <div className="col-span-2">
                  <a 
                    href="/api/login"
                    className="bg-cascadia-green text-white px-4 py-2 rounded-lg hover:bg-opacity-90 transition-all duration-200 font-medium text-center block"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Login with Replit
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Announcements */}
      <SimpleAnnouncements />

      {/* Rich Mobile Photo Voting Interface */}
      <div className="px-4 pb-20">
        {/* Voting Instructions */}
        <div className="text-center py-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Which photo do you prefer?</h2>
          <p className="text-gray-600 text-sm">Tap your favorite to vote • Swipe left/right to vote • Vote unlimited times</p>
          {votesCount > 0 && (
            <div className="mt-2 text-xs text-green-600 font-medium">
              {votesCount} votes cast - Thanks for helping!
            </div>
          )}
        </div>

        {/* Photo Cards - Stacked Mobile Layout */}
        <div className="space-y-4">
          {/* Photo A Card */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div 
              className="relative cursor-pointer transform transition-all duration-200 active:scale-98"
              onClick={() => handlePhotoSelect(photoA)}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="aspect-video bg-gray-100 relative overflow-hidden">
                <img 
                  src={photoA.imageUrl} 
                  alt={photoA.title}
                  className="w-full h-full object-cover"
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
                
                {/* Action Buttons */}
                <div className="flex items-center justify-between">
                  <Button
                    onClick={() => handlePhotoSelect(photoA)}
                    className="bg-cascadia-green hover:bg-green-700 text-white flex-1 mr-2"
                    disabled={isVoting}
                  >
                    <Heart className="w-4 h-4 mr-2" />
                    Choose This One
                  </Button>
                  
                  {settings?.purchaseEnabled && !photoA.neverForSale && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        const purchaseUrl = photoA.customPurchaseUrl || settings?.defaultPurchaseUrl || "https://www.chrismcnulty.net/store";
                        const newWindow = window.open(purchaseUrl, '_blank');
                        if (!newWindow) {
                          window.location.href = purchaseUrl;
                        }
                      }}
                      className="ml-2"
                    >
                      <ShoppingCart className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* VS Divider */}
          <div className="text-center py-2">
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
              <div className="aspect-video bg-gray-100 relative overflow-hidden">
                <img 
                  src={photoB.imageUrl} 
                  alt={photoB.title}
                  className="w-full h-full object-cover"
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
                
                {/* Action Buttons */}
                <div className="flex items-center justify-between">
                  <Button
                    onClick={() => handlePhotoSelect(photoB)}
                    className="bg-cascadia-green hover:bg-green-700 text-white flex-1 mr-2"
                    disabled={isVoting}
                  >
                    <Heart className="w-4 h-4 mr-2" />
                    Choose This One
                  </Button>
                  
                  {settings?.purchaseEnabled && !photoB.neverForSale && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        const purchaseUrl = photoB.customPurchaseUrl || settings?.defaultPurchaseUrl || "https://www.chrismcnulty.net/store";
                        const newWindow = window.open(purchaseUrl, '_blank');
                        if (!newWindow) {
                          window.location.href = purchaseUrl;
                        }
                      }}
                      className="ml-2"
                    >
                      <ShoppingCart className="w-4 h-4" />
                    </Button>
                  )}
                </div>
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

        {/* Mobile Footer */}
        <footer className="mt-12 py-8 border-t border-gray-200 bg-white">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center space-x-2">
              <div className="w-8 h-8 rounded overflow-hidden">
                <img 
                  src={cascadiaLogoPath} 
                  alt="Cascadia Oceanic" 
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="font-bold text-lg text-gray-900">Cascadia Oceanic</span>
            </div>
            
            <p className="text-gray-600 text-sm max-w-sm mx-auto">
              Landscape photography showcasing the natural beauty of the Pacific Northwest and beyond.
            </p>
            
            {/* Social Links */}
            <div className="flex justify-center space-x-6">
              <a 
                href="https://www.instagram.com/cascadia.oceanic/" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-green-600 transition-colors duration-200"
              >
                <FaInstagram className="w-6 h-6" />
              </a>
              <a 
                href="https://www.chrismcnulty.net/photography" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-green-600 transition-colors duration-200"
              >
                <span className="text-sm font-medium">Gallery</span>
              </a>
            </div>
            
            <div className="text-xs text-gray-500 space-y-1">
              <p>© 2024 Chris McNulty Photography</p>
              <p>Help curate the next exhibition by voting</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}