import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Share2, Plus, X } from 'lucide-react';

export function IOSInstallGuide() {
  const [showGuide, setShowGuide] = useState(false);
  
  // Check if it's iOS Safari (not in standalone mode)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isIOSSafari = isIOS && !isStandalone;
  
  if (!isIOSSafari) {
    return null;
  }

  return (
    <>
      {/* Install button */}
      <div className="fixed bottom-4 right-4 z-40">
        <Button
          onClick={() => setShowGuide(true)}
          className="bg-cascadia-green hover:bg-cascadia-green/90 text-white shadow-lg"
          size="lg"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add to Home Screen
        </Button>
      </div>

      {/* Guide modal */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="max-w-md w-full p-6 bg-white">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold">Install Photo Pairs App</h3>
              <button
                onClick={() => setShowGuide(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-cascadia-green/10 rounded-full flex items-center justify-center">
                  <span className="text-cascadia-green font-semibold">1</span>
                </div>
                <div>
                  <p className="text-sm">Tap the Share button at the bottom of Safari</p>
                  <Share2 className="w-6 h-6 text-gray-400 mt-2" />
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-cascadia-green/10 rounded-full flex items-center justify-center">
                  <span className="text-cascadia-green font-semibold">2</span>
                </div>
                <div>
                  <p className="text-sm">Scroll down and tap "Add to Home Screen"</p>
                  <div className="flex items-center space-x-1 mt-2">
                    <Plus className="w-5 h-5 text-gray-400" />
                    <span className="text-xs text-gray-400">Add to Home Screen</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-cascadia-green/10 rounded-full flex items-center justify-center">
                  <span className="text-cascadia-green font-semibold">3</span>
                </div>
                <div>
                  <p className="text-sm">Tap "Add" to install the app</p>
                </div>
              </div>
            </div>
            
            <Button
              onClick={() => setShowGuide(false)}
              className="w-full mt-6 bg-cascadia-green hover:bg-cascadia-green/90"
            >
              Got it!
            </Button>
          </Card>
        </div>
      )}
    </>
  );
}