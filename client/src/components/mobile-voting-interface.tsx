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
    <div className="w-full">
      {/* Minimal Header with Return Button */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="flex items-center justify-between p-2">
          {/* Return Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.history.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          {/* Minimal Logo */}
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded overflow-hidden">
              <img 
                src={cascadiaLogoPath} 
                alt="Cascadia Oceanic" 
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-sm font-medium text-gray-700">Focus Mode</span>
          </div>

          {/* User Profile - compact */}
          <div className="flex items-center gap-1">
            <UserProfile />
            {/* Admin panel - compact */}
            {typeof window !== 'undefined' && localStorage.getItem('admin-session-id') && (
              <Link href="/admin">
                <Button variant="ghost" size="icon" className="p-1">
                  <SettingsIcon className="h-4 w-4 text-green-600" />
                </Button>
              </Link>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-white border-b border-gray-200 shadow-lg z-50">
            <div className="flex flex-col space-y-3 p-4">
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

              {/* Exit Focus Mode */}
              {onToggleView && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onToggleView();
                    setMobileMenuOpen(false);
                  }}
                  className="text-gray-700 hover:text-green-700 transition-colors duration-200 font-medium text-center w-full"
                >
                  <Monitor className="w-4 h-4 mr-2" />
                  Exit Focus Mode
                </Button>
              )}

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
                <div className="text-center">
                  <a 
                    href="/api/login"
                    className="bg-cascadia-green text-white px-4 py-2 rounded-lg hover:bg-opacity-90 transition-all duration-200 font-medium text-center block"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Login
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Announcements */}
      <SimpleAnnouncements />

      {/* Photo Pair - Side by Side Layout for Focus Mode */}
      <div className="bg-black min-h-screen flex items-center justify-center p-2">
        <div className="w-full h-full max-w-7xl mx-auto">
          {/* Side-by-side layout for larger screens, stacked for mobile */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 h-full">
            {/* Photo A */}
            <div 
              className="relative bg-black rounded-lg overflow-hidden cursor-pointer transform transition-all duration-200 active:scale-98 flex items-center justify-center"
              onClick={() => handlePhotoSelect(photoA)}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{ minHeight: 'calc(100vh - 120px)' }}
            >
              <div className="relative w-full h-full flex items-center justify-center">
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
              
              {/* Minimal overlay with title */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                <h3 className="font-semibold text-white text-lg font-epilogue">{photoA.title}</h3>
                {settings?.purchaseEnabled && !photoA.neverForSale && (
                  <button
                    type="button"
                    className="mt-2 inline-flex items-center px-3 py-1 text-white bg-green-600/80 hover:bg-green-600 rounded-md transition-all duration-200 text-sm font-medium backdrop-blur-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      const purchaseUrl = photoA.customPurchaseUrl || settings?.defaultPurchaseUrl || "https://www.chrismcnulty.net/store";
                      const newWindow = window.open(purchaseUrl, '_blank');
                      if (!newWindow) {
                        window.location.href = purchaseUrl;
                      }
                    }}
                  >
                    <ShoppingCart className="w-3 h-3 mr-1" />
                    Print
                  </button>
                )}
              </div>
            </div>

            {/* Photo B */}
            <div 
              className="relative bg-black rounded-lg overflow-hidden cursor-pointer transform transition-all duration-200 active:scale-98 flex items-center justify-center"
              onClick={() => handlePhotoSelect(photoB)}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{ minHeight: 'calc(100vh - 120px)' }}
            >
              <div className="relative w-full h-full flex items-center justify-center">
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
              
              {/* Minimal overlay with title */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                <h3 className="font-semibold text-white text-lg font-epilogue">{photoB.title}</h3>
                {settings?.purchaseEnabled && !photoB.neverForSale && (
                  <button
                    type="button"
                    className="mt-2 inline-flex items-center px-3 py-1 text-white bg-green-600/80 hover:bg-green-600 rounded-md transition-all duration-200 text-sm font-medium backdrop-blur-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      const purchaseUrl = photoB.customPurchaseUrl || settings?.defaultPurchaseUrl || "https://www.chrismcnulty.net/store";
                      const newWindow = window.open(purchaseUrl, '_blank');
                      if (!newWindow) {
                        window.location.href = purchaseUrl;
                      }
                    }}
                  >
                    <ShoppingCart className="w-3 h-3 mr-1" />
                    Print
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}