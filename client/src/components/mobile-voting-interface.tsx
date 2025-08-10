import { useState } from "react";
import { Photo, Settings } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Heart, ChevronLeft, ChevronRight, Zap, Menu, X, Smartphone, Plus } from "lucide-react";
import { FaInstagram } from "react-icons/fa6";
import cascadiaLogoPath from "@assets/Cascadia-TP_1754453673312.png";

interface MobileVotingInterfaceProps {
  photoPair: [Photo, Photo];
  onVote: (winner: Photo, loser: Photo) => void;
  isVoting: boolean;
  settings?: Settings;
  onToggleView?: () => void;
  onShowInstallGuide?: () => void;
}

export default function MobileVotingInterface({ 
  photoPair, 
  onVote, 
  isVoting, 
  settings,
  onToggleView,
  onShowInstallGuide
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
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded overflow-hidden">
                <img 
                  src={cascadiaLogoPath} 
                  alt="Cascadia Oceanic" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-cascadia-green font-epilogue">Cascadia Oceanic</h1>
                <p className="text-xs text-gray-600">Photo Voting</p>
              </div>
            </div>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>

          {/* Mobile Menu Dropdown */}
          {mobileMenuOpen && (
            <div className="absolute top-full left-0 right-0 bg-white border-b border-gray-200 shadow-lg z-50">
              <div className="flex flex-col space-y-4 p-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onToggleView?.();
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2 justify-center"
                >
                  <Smartphone className="w-4 h-4" />
                  Desktop View
                </Button>
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
                <a 
                  href="https://www.chrismcnulty.net/photography" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-700 hover:text-green-700 transition-colors duration-200 font-medium text-center"
                >
                  Visit Gallery
                </a>
                <a 
                  href="https://www.instagram.com/cascadia.oceanic/" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-700 hover:text-green-700 transition-colors duration-200 font-medium flex items-center gap-1 justify-center"
                >
                  <FaInstagram className="w-4 h-4" />
                  Instagram
                </a>
                <a 
                  href="https://www.chrismcnulty.net/subscribe" 
                  className="bg-cascadia-green text-white px-6 py-2 rounded-lg hover:bg-opacity-90 transition-all duration-200 font-medium text-center"
                >
                  Subscribe
                </a>
                <a 
                  href="/admin"
                  className="text-gray-700 hover:text-green-700 transition-colors duration-200 font-medium text-center"
                >
                  Admin
                </a>
              </div>
            </div>
          )}
        </header>

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