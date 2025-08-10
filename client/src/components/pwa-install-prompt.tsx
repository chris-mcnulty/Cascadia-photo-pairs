import { X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { usePWA } from '@/hooks/use-pwa';
import { useState, useEffect } from 'react';

export function PWAInstallPrompt() {
  const { isInstallable, isPWAInstalled, installPWA } = usePWA();
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if user has previously dismissed the prompt
    const wasDismissed = localStorage.getItem('pwa-install-dismissed');
    if (wasDismissed) {
      setDismissed(true);
    }

    // Disabled automatic prompt - only show via menu
  }, [isInstallable, isPWAInstalled]);

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  const handleInstall = async () => {
    await installPWA();
    setShowPrompt(false);
  };

  // Don't show if already installed, dismissed, or not installable
  if (isPWAInstalled || dismissed || !isInstallable || !showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96">
      <Card className="p-4 shadow-lg border-cascadia-green/20 bg-white/95 backdrop-blur">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cascadia-green/10">
              <Download className="w-5 h-5 text-cascadia-green" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Install Photo Pairs</h3>
              <p className="text-xs text-gray-600 mt-0.5">Add to your home screen for the best experience</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDismiss}
            className="flex-1"
          >
            Not now
          </Button>
          <Button
            size="sm"
            onClick={handleInstall}
            className="flex-1 bg-cascadia-green hover:bg-cascadia-green/90"
          >
            Install
          </Button>
        </div>
      </Card>
    </div>
  );
}