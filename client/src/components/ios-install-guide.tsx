import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Share2, Plus, X, Download } from 'lucide-react';

interface IOSInstallGuideProps {
  showInitial?: boolean;
  forceShow?: boolean;
  onClose?: () => void;
}

export function IOSInstallGuide({ showInitial = false, forceShow = false, onClose }: IOSInstallGuideProps) {
  const [showGuide, setShowGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  
  // Check if it's mobile browser (not in standalone mode)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isAndroid = /Android/.test(navigator.userAgent);
  const isMobile = isIOS || isAndroid;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const canInstall = isMobile && !isStandalone;
  
  useEffect(() => {
    if (forceShow) {
      setShowGuide(true);
      return;
    }
    
    if (showInitial && canInstall && !dismissed) {
      const hasSeenInstallPrompt = localStorage.getItem('install-prompt-seen');
      if (!hasSeenInstallPrompt) {
        // Show after a delay to let the toast appear first
        const timer = setTimeout(() => {
          setShowGuide(true);
        }, 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [showInitial, canInstall, dismissed, forceShow]);

  const handleDismiss = () => {
    setShowGuide(false);
    setDismissed(true);
    if (!forceShow) {
      localStorage.setItem('install-prompt-seen', 'true');
    }
    onClose?.();
  };
  
  if (!canInstall && !forceShow) {
    return null;
  }

  return (
    <>
      {/* Guide modal */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="max-w-md w-full p-6 bg-white">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold">Install Photo Pairs App</h3>
              <button
                onClick={handleDismiss}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="text-center mb-4">
                <Download className="w-12 h-12 text-cascadia-green mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  Install this app on your phone for the best experience!
                </p>
              </div>

              {isIOS ? (
                <>
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-cascadia-green/10 rounded-full flex items-center justify-center">
                      <span className="text-cascadia-green font-semibold">1</span>
                    </div>
                    <div>
                      <p className="text-sm">Tap the Share button in Safari</p>
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
                </>
              ) : (
                <>
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-cascadia-green/10 rounded-full flex items-center justify-center">
                      <span className="text-cascadia-green font-semibold">1</span>
                    </div>
                    <div>
                      <p className="text-sm">Open your browser menu (⋮ or ⋯)</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-cascadia-green/10 rounded-full flex items-center justify-center">
                      <span className="text-cascadia-green font-semibold">2</span>
                    </div>
                    <div>
                      <p className="text-sm">Look for "Add to Home Screen" or "Install App"</p>
                      <div className="flex items-center space-x-1 mt-2">
                        <Plus className="w-5 h-5 text-gray-400" />
                        <span className="text-xs text-gray-400">Install App</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
              
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-cascadia-green/10 rounded-full flex items-center justify-center">
                  <span className="text-cascadia-green font-semibold">3</span>
                </div>
                <div>
                  <p className="text-sm">Tap "Add" or "Install" to save the app</p>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2 mt-6">
              <Button
                variant="outline"
                onClick={handleDismiss}
                className="flex-1"
              >
                Maybe later
              </Button>
              <Button
                onClick={handleDismiss}
                className="flex-1 bg-cascadia-green hover:bg-cascadia-green/90"
              >
                Got it!
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}