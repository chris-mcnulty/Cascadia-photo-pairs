import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Photo, Settings } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import VotingInterface from "@/components/voting-interface";
import MobileVotingInterface from "@/components/mobile-voting-interface";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Menu, X, Globe, Mail, Heart, MousePointer, RefreshCw, Infinity, Smartphone } from "lucide-react";
import cascadiaLogoPath from "@assets/Cascadia-TP_1754453673312.png";
import { useTitle } from "@/hooks/use-title";

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [useMobileInterface, setUseMobileInterface] = useState(false);
  const [votesCount, setVotesCount] = useState(0);
  const { toast } = useToast();

  useTitle(); // Uses default title

  // Detect if user is on mobile and auto-enable mobile interface
  useEffect(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
      || (window.innerWidth <= 768);
    setUseMobileInterface(isMobile);
  }, []);

  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const { data: photoPair, refetch: refetchPair } = useQuery<[Photo, Photo]>({
    queryKey: ["/api/photos/random-pair"],
  });

  const voteMutation = useMutation({
    mutationFn: async ({ photoId, winnerPhotoId, loserPhotoId }: { 
      photoId: string; 
      winnerPhotoId: string; 
      loserPhotoId: string; 
    }) => {
      const response = await apiRequest("POST", "/api/votes", { 
        photoId, 
        winnerPhotoId, 
        loserPhotoId 
      });
      return response.json();
    },
    onSuccess: () => {
      setVotesCount(prev => prev + 1);
      refetchPair();
      toast({
        title: "Vote recorded!",
        description: "Thank you for your vote. Here's your next pair!",
      });
    },
    onError: () => {
      toast({
        title: "Vote failed",
        description: "There was an error recording your vote. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleVote = (winnerPhoto: Photo, loserPhoto: Photo) => {
    voteMutation.mutate({
      photoId: winnerPhoto.id,
      winnerPhotoId: winnerPhoto.id,
      loserPhotoId: loserPhoto.id,
    });
  };

  const progressPercentage = Math.min((votesCount / 30) * 100, 100);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo and Title */}
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-lg overflow-hidden">
                <img 
                  src={cascadiaLogoPath} 
                  alt="Cascadia Oceanic Logo" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h1 className="text-2xl font-semibold cascadia-green">Cascadia Oceanic</h1>
                <p className="text-sm text-gray-600">Photo Voting</p>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="hidden md:flex items-center space-x-8">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUseMobileInterface(!useMobileInterface)}
                className="flex items-center gap-2"
              >
                <Smartphone className="w-4 h-4" />
                {useMobileInterface ? "Desktop" : "Mobile"} View
              </Button>
              <a 
                href="https://www.chrismcnulty.net" 
                className="text-gray-700 hover:text-green-700 transition-colors duration-200 font-medium"
              >
                Visit Gallery
              </a>
              <a 
                href="https://www.chrismcnulty.net/subscribe" 
                className="bg-cascadia-green text-white px-6 py-2 rounded-lg hover:bg-opacity-90 transition-all duration-200 font-medium"
              >
                Subscribe
              </a>
            </nav>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-gray-100 py-4">
              <div className="flex flex-col space-y-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUseMobileInterface(!useMobileInterface)}
                  className="flex items-center gap-2 justify-center"
                >
                  <Smartphone className="w-4 h-4" />
                  {useMobileInterface ? "Desktop" : "Mobile"} View
                </Button>
                <a 
                  href="https://www.chrismcnulty.net" 
                  className="text-gray-700 hover:text-green-700 transition-colors duration-200 font-medium"
                >
                  Visit Gallery
                </a>
                <a 
                  href="https://www.chrismcnulty.net/subscribe" 
                  className="bg-cascadia-green text-white px-6 py-2 rounded-lg hover:bg-opacity-90 transition-all duration-200 font-medium text-center"
                >
                  Subscribe
                </a>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        
        {/* Introduction Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Choose Your Favorite</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Help me curate the photos for my next exhibition. I've added some of my classic and newest images to discover here. Click on your preferred photo to vote, then continue with the next pair. Vote as many times as you like!
          </p>
        </div>

        {/* Voting Progress */}
        <Card className="bg-cascadia-light mb-8">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Your Voting Progress</h3>
              <div className="text-sm text-gray-600">
                {votesCount} votes cast
              </div>
            </div>
            <Progress value={progressPercentage} className="h-2" />
            <p className="text-xs text-gray-500 mt-2">Keep voting to help us curate the exhibition!</p>
          </CardContent>
        </Card>

        {/* Voting Interface */}
        {photoPair && (
          useMobileInterface ? (
            <MobileVotingInterface 
              photoPair={photoPair}
              onVote={handleVote}
              isVoting={voteMutation.isPending}
              settings={settings}
            />
          ) : (
            <VotingInterface 
              photoPair={photoPair}
              onVote={handleVote}
              isVoting={voteMutation.isPending}
              settings={settings}
            />
          )
        )}

        {/* Voting Instructions */}
        <div className="text-center mt-8 mb-12">
          <p className="text-gray-600 mb-4">Click on your preferred artwork to vote</p>
          <div className="flex items-center justify-center space-x-4 text-sm text-gray-500">
            <div className="flex items-center">
              <MousePointer className="w-4 h-4 mr-2" />
              Click to vote
            </div>
            <div className="flex items-center">
              <RefreshCw className="w-4 h-4 mr-2" />
              Auto-load next pair
            </div>
            <div className="flex items-center">
              <Infinity className="w-4 h-4 mr-2" />
              Vote unlimited times
            </div>
          </div>
        </div>

        {/* Call to Action Section */}
        <div className="bg-gradient-to-r from-green-700 to-green-600 rounded-2xl p-8 text-white text-center">
          <div className="max-w-3xl mx-auto">
            <h3 className="text-2xl font-bold mb-4">Explore More Photography</h3>
            <p className="text-lg mb-6 opacity-90">
              Discover the complete collection of landscape and nature photography at Chris McNulty's gallery.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a 
                href="https://www.chrismcnulty.net/photography/landscapes" 
                className="bg-white text-green-700 px-8 py-3 rounded-lg font-semibold hover:bg-opacity-90 transition-all duration-200 inline-flex items-center justify-center"
              >
                <Globe className="w-4 h-4 mr-2" />
                View Full Gallery
              </a>
              <a 
                href="https://www.chrismcnulty.net/subscribe" 
                className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-green-700 transition-all duration-200 inline-flex items-center justify-center"
              >
                <Mail className="w-4 h-4 mr-2" />
                Subscribe for Updates
              </a>
            </div>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-3 gap-8">
            
            {/* About Section */}
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-8 h-8 rounded overflow-hidden">
                  <img 
                    src={cascadiaLogoPath} 
                    alt="Cascadia Oceanic" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <h3 className="text-lg font-semibold cascadia-green">Cascadia Oceanic</h3>
              </div>
              <p className="text-gray-600 text-sm mb-4">
                Images of the Pacific & Atlantic coasts, and the land in between.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Explore</h3>
              <ul className="space-y-2">
                <li>
                  <a 
                    href="https://www.chrismcnulty.net/photography/landscapes" 
                    className="text-gray-600 hover:text-green-700 transition-colors duration-200 text-sm"
                  >
                    Landscapes
                  </a>
                </li>
                <li>
                  <a 
                    href="https://www.chrismcnulty.net/photography/seascapes" 
                    className="text-gray-600 hover:text-green-700 transition-colors duration-200 text-sm"
                  >
                    Seascapes  
                  </a>
                </li>
                <li>
                  <a 
                    href="https://www.chrismcnulty.net/photography/cityscapes" 
                    className="text-gray-600 hover:text-green-700 transition-colors duration-200 text-sm"
                  >
                    Cityscapes
                  </a>
                </li>
                <li>
                  <a 
                    href="https://www.chrismcnulty.net/subscribe" 
                    className="text-gray-600 hover:text-green-700 transition-colors duration-200 text-sm"
                  >
                    Subscribe
                  </a>
                </li>
                <li>
                  <a 
                    href="https://www.chrismcnulty.net/store" 
                    className="text-gray-600 hover:text-green-700 transition-colors duration-200 text-sm"
                  >
                    Purchase Prints
                  </a>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Connect</h3>
              <div className="space-y-2">
                <p className="text-gray-600 text-sm">
                  <Globe className="w-4 h-4 mr-2 inline" />
                  <a 
                    href="https://www.chrismcnulty.net" 
                    className="hover:text-green-700 transition-colors duration-200"
                  >
                    chrismcnulty.net
                  </a>
                </p>
                <p className="text-gray-600 text-sm">
                  Bothell, WA
                </p>
              </div>
            </div>
          </div>

          {/* Copyright */}
          <div className="border-t border-gray-200 pt-8 mt-8 text-center">
            <p className="text-gray-500 text-sm">
              © Christopher F. McNulty 2025. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
