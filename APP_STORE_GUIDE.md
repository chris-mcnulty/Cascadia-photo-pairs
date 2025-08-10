# App Store Submission Guide for Cascadia Oceanic Photo Pairs

## ✅ PWA Configuration Complete

Your app is now PWA-ready with:
- Service worker for offline functionality
- Web app manifest with proper metadata
- Install prompt component
- iOS-specific meta tags
- App shortcuts for quick access

## 📱 Next Steps for App Store Submission

### Option 1: PWABuilder (Easiest - No Mac Required)

1. **Visit PWABuilder**
   - Go to https://www.pwabuilder.com
   - Enter your app URL: https://cascadia-oceanic-photo-pairs.replit.app
   - Click "Start" to analyze your PWA

2. **Generate iOS Package**
   - Click on "iOS" in the platform list
   - Choose "Store Package" option
   - Fill in required information:
     - Bundle ID: com.cascadiaoceanic.photopairs (already configured)
     - App Name: Cascadia Oceanic Photo Pairs
     - Version: 1.0.0

3. **Download Package**
   - PWABuilder will generate an Xcode project
   - Download the generated package

4. **Submit to App Store**
   - You'll need a Mac with Xcode to submit
   - Or use a cloud Mac service like MacInCloud

### Option 2: Capacitor (More Control)

If you need more native features, you can use Capacitor:

```bash
# Install Capacitor
npm install @capacitor/core @capacitor/ios @capacitor/cli

# Initialize Capacitor
npx cap init "Cascadia Oceanic Photo Pairs" com.cascadiaoceanic.photopairs

# Add iOS platform
npx cap add ios

# Sync your web app
npx cap sync

# Open in Xcode
npx cap open ios
```

## 📋 App Store Requirements Checklist

### Developer Account
- [ ] Apple Developer Account ($99/year)
- [ ] Accepted latest agreements
- [ ] Tax and banking information completed

### App Assets Needed
- [ ] App Icon (1024x1024px)
- [ ] Screenshots:
  - iPhone 6.7" (1290 x 2796px)
  - iPhone 6.5" (1242 x 2688px)
  - iPhone 5.5" (1242 x 2208px)
  - iPad Pro 12.9" (2048 x 2732px) - optional

### App Information
- [ ] App Name: "Cascadia Oceanic Photo Pairs"
- [ ] Subtitle: "Vote on stunning ocean photography"
- [ ] Keywords: photography, voting, ocean, landscape, art, cascadia
- [ ] Primary Category: Photo & Video
- [ ] Secondary Category: Entertainment
- [ ] Age Rating: 4+
- [ ] Privacy Policy URL (required)
- [ ] Support URL (required)

### App Description Template

**Short Description:**
Vote on stunning oceanic photography pairs and help curate the best landscape images from the Cascadia collection.

**Long Description:**
Cascadia Oceanic Photo Pairs brings you a unique way to engage with breathtaking landscape photography. Vote between carefully curated photo pairs to help identify the most captivating images from the Pacific and Atlantic coasts.

Features:
• Simple voting interface - just tap your favorite
• Mobile-optimized experience with swipe gestures
• Track your voting progress
• View real-time rankings and statistics
• Discover new photographic perspectives
• Works offline after first visit
• Install as an app on your device

Perfect for photography enthusiasts, art lovers, and anyone who appreciates the beauty of nature. Your votes help shape future exhibitions and collections.

## 🔧 Technical Considerations

### Current PWA Features Working on iOS:
✅ Installable to home screen
✅ Full-screen experience
✅ Offline functionality (via service worker)
✅ Custom app icon
✅ Splash screen

### Limitations on iOS (compared to Android):
⚠️ No automatic install prompts
⚠️ Limited background sync
⚠️ No push notifications (through PWA)

### Testing Your PWA

1. **On iOS Device:**
   - Open Safari
   - Navigate to your app
   - Tap Share button
   - Select "Add to Home Screen"
   - Test offline functionality

2. **PWA Checklist:**
   - Run Lighthouse audit in Chrome DevTools
   - Test on real devices
   - Verify offline functionality
   - Check performance metrics

## 🚀 Deployment Recommendations

1. **Custom Domain** (Optional but recommended)
   - Adds professionalism
   - Better for App Store listing
   - Example: photopairs.cascadiaoceanic.com

2. **Analytics** (Recommended)
   - Add Google Analytics or similar
   - Track user engagement
   - Monitor voting patterns

3. **Performance Optimization**
   - Optimize images (currently using base64, consider CDN)
   - Enable compression
   - Implement lazy loading

## 📞 Support Resources

- **PWABuilder Documentation:** https://docs.pwabuilder.com
- **Apple Developer:** https://developer.apple.com/app-store/
- **Capacitor Docs:** https://capacitorjs.com/docs/ios

## 🎯 Ready to Submit?

Your app is now configured as a Progressive Web App with:
- ✅ Manifest file with app metadata
- ✅ Service worker for offline support
- ✅ Install prompt for supported browsers
- ✅ iOS-specific meta tags
- ✅ App shortcuts for quick actions

The next step is to choose your wrapper solution (PWABuilder or Capacitor) and prepare your App Store assets. Good luck with your submission!