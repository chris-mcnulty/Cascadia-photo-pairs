import { storage } from "./storage";
import { InsertPhoto, InsertSettings } from "@shared/schema";

/**
 * Production data migration - copies development data to production database
 */
export async function migrateToProduction() {
  try {
    console.log('🚀 Starting production database migration...');
    
    // Check if production database is empty
    const existingPhotos = await storage.getAllPhotos();
    const existingSettings = await storage.getSettings();
    
    console.log(`📊 Current state: ${existingPhotos.length} photos`);
    
    if (existingPhotos.length > 0) {
      console.log('⚠️  Production database already has photos. Skipping photo migration.');
      return {
        success: true,
        message: `Database already initialized with ${existingPhotos.length} photos`,
        photosCreated: 0,
        settingsUpdated: true
      };
    }
    
    console.log('📸 Migrating development photos to production...');
    
    // Production photo data - curated collection from development
    const productionPhotos: InsertPhoto[] = [
      {
        title: "Laurel Falls Morning",
        description: "Early morning mist over cascading waterfall surrounded by autumn foliage",
        imageUrl: "https://images.squarespace-cdn.com/content/v1/676f25fb3159124b1950ee6a/f9313e6c-8745-48dc-a6d8-e77ab926af02/August+2002+Labor+Day+010A.jpg",
        customPurchaseUrl: ""
      },
      {
        title: "Oregon Coast Vista", 
        description: "Dramatic coastline with weathered rock formations and crashing waves",
        imageUrl: "https://images.squarespace-cdn.com/content/v1/676f25fb3159124b1950ee6a/1737094773742-ZDL4VC3D97ZRGDQ3ZFZM/Oregon2024_013.jpg?format=1500w",
        customPurchaseUrl: ""
      },
      {
        title: "Trulocks Pond Reflection",
        description: "Serene pond perfectly reflecting the surrounding forest in golden light",
        imageUrl: "https://images.squarespace-cdn.com/content/v1/676f25fb3159124b1950ee6a/1737094740461-AV3DIWQBZ9RMJ4K03G3P/Trulocks2024_004.jpg?format=1500w",
        customPurchaseUrl: ""
      },
      {
        title: "Coupeville Harbor",
        description: "Historic wharf with weathered pilings extending into calm harbor waters", 
        imageUrl: "https://images.squarespace-cdn.com/content/v1/676f25fb3159124b1950ee6a/1737094729633-YGVH7IEA4K0NXQK3MS0C/Coupeville2024_020.jpg?format=1500w",
        customPurchaseUrl: ""
      },
      {
        title: "Laurel Lane Forest Path",
        description: "Moss-covered trail winding through old-growth Pacific Northwest forest",
        imageUrl: "https://images.squarespace-cdn.com/content/v1/676f25fb3159124b1950ee6a/1737094773759-A22JYI7IPRQ8IXWUQRG8/Laurel2024_072.jpg?format=1500w",
        customPurchaseUrl: ""
      },
      {
        title: "Mountain Lake Serenity",
        description: "Alpine lake surrounded by snow-capped peaks in pristine wilderness",
        imageUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop",
        customPurchaseUrl: ""
      },
      {
        title: "Misty Forest Cathedral", 
        description: "Towering trees creating natural cathedral with filtered morning light",
        imageUrl: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&h=600&fit=crop",
        customPurchaseUrl: ""
      },
      {
        title: "Desert Canyon Majesty",
        description: "Dramatic red rock formations carved by millennia of wind and water",
        imageUrl: "https://images.unsplash.com/photo-1511593358241-7eea1f3c84e5?w=800&h=600&fit=crop",
        customPurchaseUrl: ""
      },
      {
        title: "Golden Hour Coastline",
        description: "Waves meeting sandy shore under spectacular sunset sky",
        imageUrl: "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=800&h=600&fit=crop",
        customPurchaseUrl: ""
      },
      {
        title: "Alpine Vista Peak",
        description: "Panoramic view from mountain summit across endless ranges",
        imageUrl: "https://images.unsplash.com/photo-1464822759356-8d6106e78f86?w=800&h=600&fit=crop",
        customPurchaseUrl: ""
      }
    ];
    
    console.log(`📤 Creating ${productionPhotos.length} photos...`);
    
    let photosCreated = 0;
    for (let i = 0; i < productionPhotos.length; i++) {
      const photoData = productionPhotos[i];
      try {
        await storage.createPhoto(photoData);
        photosCreated++;
        console.log(`✅ Created: ${photoData.title} (${i + 1}/${productionPhotos.length})`);
      } catch (error) {
        console.error(`❌ Failed to create ${photoData.title}:`, error);
      }
    }
    
    // Ensure production settings are set
    const productionSettings: InsertSettings = {
      purchaseEnabled: true,
      defaultPurchaseUrl: "https://chrismcnulty.net/store",
      adminPassword: "BradyBunch12!",
      mfaPhoneNumber: "+16179809810"
    };
    
    console.log('⚙️  Updating production settings...');
    await storage.updateSettings(productionSettings);
    
    const finalPhotos = await storage.getAllPhotos();
    console.log(`🎉 Migration completed successfully!`);
    console.log(`   Photos created: ${photosCreated}`);
    console.log(`   Total photos: ${finalPhotos.length}`);
    console.log(`   Settings updated: ✅`);
    
    return {
      success: true,
      message: `Successfully migrated ${photosCreated} photos to production`,
      photosCreated,
      finalPhotoCount: finalPhotos.length,
      settingsUpdated: true
    };
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}