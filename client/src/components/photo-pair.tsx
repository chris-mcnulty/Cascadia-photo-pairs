import { Photo, Settings } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, ShoppingCart } from "lucide-react";

interface PhotoPairProps {
  photo: Photo;
  onVote: () => void;
  isVoting: boolean;
  settings?: Settings;
}

export default function PhotoPair({ photo, onVote, isVoting, settings }: PhotoPairProps) {
  const purchaseUrl = photo.customPurchaseUrl || settings?.defaultPurchaseUrl || "https://www.chrismcnulty.net/store";

  const handleCardClick = (e: React.MouseEvent) => {
    // Check if click is on purchase button or its children
    const target = e.target as HTMLElement;
    if (target.closest('.purchase-button')) {
      return; // Don't trigger vote if clicking purchase button
    }
    if (!isVoting) {
      onVote();
    }
  };

  return (
    <div 
      className="voting-option group cursor-pointer"
      onClick={handleCardClick}
    >
      <Card className="relative bg-white shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 group-hover:scale-[1.02]">
        
        {/* Vote Overlay */}
        <div className="absolute inset-0 bg-green-700 bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-300 flex items-center justify-center z-10">
          <div className="bg-white rounded-full p-4 opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all duration-300 shadow-lg">
            <Heart className="text-green-700 w-6 h-6 fill-current" />
          </div>
        </div>

        {/* Photo */}
        <div className="w-full h-96 bg-gray-100 flex items-center justify-center">
          <img 
            src={photo.imageUrl} 
            alt={photo.title} 
            className="w-full h-full object-contain" 
          />
        </div>
        
        {/* Photo Info */}
        <CardContent className="p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-2">
            {photo.title}
          </h4>
          {photo.description && (
            <p className="text-sm text-gray-600 mb-4">
              {photo.description}
            </p>
          )}
          
          {/* Purchase Link (Admin Configurable) */}
          {settings?.purchaseEnabled && !photo.neverForSale && (
            <div className="mt-4">
              <button
                className="purchase-button inline-flex items-center text-blue-600 hover:text-green-700 transition-colors duration-200 text-sm font-medium"
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('Purchase button clicked, opening:', purchaseUrl);
                  window.open(purchaseUrl, '_blank');
                }}
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Purchase Print
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}