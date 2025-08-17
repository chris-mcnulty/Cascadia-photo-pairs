import { useState } from "react";
import { Photo, Settings } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Heart, ArrowLeft, Settings as SettingsIcon, ShoppingCart, Menu, X, Plus, Monitor } from "lucide-react";
import { FaInstagram } from "react-icons/fa6";
import { Link } from "wouter";
import UserProfile from "@/components/user-profile";
import SimpleAnnouncements from "@/components/simple-announcements";
import cascadiaLogoPath from "@assets/Cascadia-TP_1754453673312.png";

interface FocusModeInterfaceProps {
  photoPair: [Photo, Photo];
  onVote: (winner: Photo, loser: Photo) => void;
  isVoting: boolean;
  settings?: Settings;
  onToggleView?: () => void;
  onShowInstallGuide?: () => void;
  votesCount?: number;
}

export default function FocusModeInterface({
  photoPair,
  onVote,
  isVoting,
  settings,
  onToggleView,
  onShowInstallGuide,
  votesCount = 0
}: FocusModeInterfaceProps) {
  const [photoA, photoB] = photoPair;
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
            onClick={onToggleView}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Exit Focus Mode
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
      <div className="bg-black flex items-center justify-center" style={{ minHeight: 'calc(100vh - 60px)' }}>
        <div className="w-full h-full">
          {/* Side-by-side layout for desktop focus mode */}
          <div className="grid grid-cols-2 gap-1 h-full">
            {/* Photo A */}
            <div 
              className="relative bg-black overflow-hidden cursor-pointer transform transition-all duration-200 hover:scale-[1.01] flex items-center justify-center"
              onClick={() => handlePhotoSelect(photoA)}
              style={{ height: 'calc(100vh - 60px)' }}
            >
              <div className="relative w-full h-full flex items-center justify-center p-2">
                <img 
                  src={photoA.imageUrl} 
                  alt={photoA.title}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
                {selectedPhoto?.id === photoA.id && (
                  <div className="absolute inset-0 bg-cascadia-green/20 flex items-center justify-center">
                    <div className="bg-cascadia-green rounded-full p-6">
                      <Heart className="w-12 h-12 text-white fill-white" />
                    </div>
                  </div>
                )}
              </div>
              
              {/* Overlay with title */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6">
                <h3 className="font-bold text-white text-2xl mb-2">{photoA.title}</h3>
                {settings?.purchaseEnabled && !photoA.neverForSale && (
                  <button
                    type="button"
                    className="inline-flex items-center px-4 py-2 text-white bg-cascadia-green hover:bg-cascadia-green/90 rounded-lg transition-all duration-200 text-base font-medium backdrop-blur-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      const purchaseUrl = photoA.customPurchaseUrl || settings?.defaultPurchaseUrl || "https://www.chrismcnulty.net/store";
                      const newWindow = window.open(purchaseUrl, '_blank');
                      if (!newWindow) {
                        window.location.href = purchaseUrl;
                      }
                    }}
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Purchase
                  </button>
                )}
              </div>
            </div>

            {/* Photo B */}
            <div 
              className="relative bg-black overflow-hidden cursor-pointer transform transition-all duration-200 hover:scale-[1.01] flex items-center justify-center"
              onClick={() => handlePhotoSelect(photoB)}
              style={{ height: 'calc(100vh - 60px)' }}
            >
              <div className="relative w-full h-full flex items-center justify-center p-2">
                <img 
                  src={photoB.imageUrl} 
                  alt={photoB.title}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
                {selectedPhoto?.id === photoB.id && (
                  <div className="absolute inset-0 bg-cascadia-green/20 flex items-center justify-center">
                    <div className="bg-cascadia-green rounded-full p-6">
                      <Heart className="w-12 h-12 text-white fill-white" />
                    </div>
                  </div>
                )}
              </div>
              
              {/* Overlay with title */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6">
                <h3 className="font-bold text-white text-2xl mb-2">{photoB.title}</h3>
                {settings?.purchaseEnabled && !photoB.neverForSale && (
                  <button
                    type="button"
                    className="inline-flex items-center px-4 py-2 text-white bg-cascadia-green hover:bg-cascadia-green/90 rounded-lg transition-all duration-200 text-base font-medium backdrop-blur-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      const purchaseUrl = photoB.customPurchaseUrl || settings?.defaultPurchaseUrl || "https://www.chrismcnulty.net/store";
                      const newWindow = window.open(purchaseUrl, '_blank');
                      if (!newWindow) {
                        window.location.href = purchaseUrl;
                      }
                    }}
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Purchase
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