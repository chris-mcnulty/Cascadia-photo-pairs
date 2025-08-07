import { useState } from "react";
import { Photo, Settings } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Heart, ChevronLeft, ChevronRight, Zap } from "lucide-react";

interface MobileVotingInterfaceProps {
  photoPair: [Photo, Photo];
  onVote: (winner: Photo, loser: Photo) => void;
  isVoting: boolean;
  settings?: Settings;
}

export default function MobileVotingInterface({ 
  photoPair, 
  onVote, 
  isVoting, 
  settings 
}: MobileVotingInterfaceProps) {
  const [photoA, photoB] = photoPair;
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [showComparison, setShowComparison] = useState(false);

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
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      {/* Header */}
      <div className="p-4 text-center border-b border-gray-700">
        <h1 className="text-xl font-bold">Choose Your Favorite</h1>
        <p className="text-sm text-gray-400 mt-1">Tap or swipe to vote</p>
      </div>

      {/* Main voting area */}
      <div className="flex-1 flex flex-col">
        {/* Single photo view for mobile */}
        <div className="md:hidden">
          <div className="relative h-[60vh] bg-black">
            <div 
              className="flex h-full transition-transform duration-300 ease-out"
              style={{ 
                transform: showComparison ? 'translateX(-50%)' : 'translateX(0%)' 
              }}
            >
              {/* Photo A */}
              <div 
                className="min-w-full relative cursor-pointer"
                onClick={() => handlePhotoSelect(photoA)}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <img 
                  src={photoA.imageUrl} 
                  alt={photoA.title}
                  className={`w-full h-full object-contain transition-all duration-200 ${
                    selectedPhoto?.id === photoA.id ? 'scale-105 brightness-110' : ''
                  } ${isVoting ? 'opacity-50' : ''}`}
                />
                <div className="absolute bottom-4 left-4 right-4 bg-black/70 rounded-lg p-3">
                  <h3 className="font-semibold text-lg">{photoA.title}</h3>
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

              {/* Photo B */}
              <div 
                className="min-w-full relative cursor-pointer"
                onClick={() => handlePhotoSelect(photoB)}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <img 
                  src={photoB.imageUrl} 
                  alt={photoB.title}
                  className={`w-full h-full object-contain transition-all duration-200 ${
                    selectedPhoto?.id === photoB.id ? 'scale-105 brightness-110' : ''
                  } ${isVoting ? 'opacity-50' : ''}`}
                />
                <div className="absolute bottom-4 left-4 right-4 bg-black/70 rounded-lg p-3">
                  <h3 className="font-semibold text-lg">{photoB.title}</h3>
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

          {/* Navigation dots */}
          <div className="flex justify-center py-4">
            <div className="flex gap-2">
              <button
                className={`w-3 h-3 rounded-full transition-colors ${
                  !showComparison ? 'bg-blue-500' : 'bg-gray-600'
                }`}
                onClick={() => setShowComparison(false)}
              />
              <button
                className={`w-3 h-3 rounded-full transition-colors ${
                  showComparison ? 'bg-blue-500' : 'bg-gray-600'
                }`}
                onClick={() => setShowComparison(true)}
              />
            </div>
          </div>

          {/* Navigation arrows */}
          <div className="flex justify-between px-4 py-2">
            <Button
              variant="ghost"
              size="lg"
              onClick={() => setShowComparison(false)}
              disabled={!showComparison}
              className="text-white hover:bg-white/10"
            >
              <ChevronLeft className="w-6 h-6" />
              <span className="ml-2">{photoA.title}</span>
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => setShowComparison(true)}
              disabled={showComparison}
              className="text-white hover:bg-white/10"
            >
              <span className="mr-2">{photoB.title}</span>
              <ChevronRight className="w-6 h-6" />
            </Button>
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
              <h3 className="font-semibold text-lg">{photoA.title}</h3>
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
              <h3 className="font-semibold text-lg">{photoB.title}</h3>
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

        {/* Action buttons */}
        <div className="p-4 space-y-4">
          <div className="text-center">
            <p className="text-gray-400 text-sm mb-4">
              {isVoting ? 'Recording your vote...' : 'Swipe left/right or tap to vote'}
            </p>
          </div>

          {/* Quick vote buttons for accessibility */}
          <div className="grid grid-cols-2 gap-3 md:hidden">
            <Button
              onClick={() => handlePhotoSelect(photoA)}
              disabled={isVoting}
              className="bg-blue-600 hover:bg-blue-700 text-white py-3"
            >
              <Zap className="w-4 h-4 mr-2" />
              Vote {photoA.title}
            </Button>
            <Button
              onClick={() => handlePhotoSelect(photoB)}
              disabled={isVoting}
              className="bg-purple-600 hover:bg-purple-700 text-white py-3"
            >
              <Zap className="w-4 h-4 mr-2" />
              Vote {photoB.title}
            </Button>
          </div>

          {/* Purchase links if enabled */}
          {settings?.purchaseEnabled && (
            <div className="flex gap-2 justify-center text-sm">
              {(photoA.customPurchaseUrl || settings.defaultPurchaseUrl) && (
                <a 
                  href={photoA.customPurchaseUrl || settings.defaultPurchaseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  Buy {photoA.title}
                </a>
              )}
              {(photoB.customPurchaseUrl || settings.defaultPurchaseUrl) && (
                <a 
                  href={photoB.customPurchaseUrl || settings.defaultPurchaseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300 underline"
                >
                  Buy {photoB.title}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}