#!/usr/bin/env node

/**
 * Export development database data for production deployment
 * This script exports photos, settings, and sample votes from development to production
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "../shared/schema.js";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL must be set");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

async function exportData() {
  try {
    console.log('🔍 Exporting development database data...');
    
    // Export photos
    const photos = await db.select().from(schema.photos);
    console.log(`📸 Found ${photos.length} photos`);
    
    // Export settings
    const settings = await db.select().from(schema.settings);
    console.log(`⚙️  Found ${settings.length} settings records`);
    
    // Export recent votes (sample)
    const votes = await db.select().from(schema.votes).limit(50);
    console.log(`🗳️  Found ${votes.length} recent votes`);
    
    const exportData = {
      timestamp: new Date().toISOString(),
      photos,
      settings,
      sampleVotes: votes,
      metadata: {
        totalPhotos: photos.length,
        totalSettings: settings.length,
        sampleVotesCount: votes.length
      }
    };
    
    // Write to file
    const fs = await import('fs');
    const filename = `production-data-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(exportData, null, 2));
    
    console.log(`✅ Data exported to ${filename}`);
    console.log('\n📊 Export Summary:');
    console.log(`   Photos: ${photos.length}`);
    console.log(`   Settings: ${settings.length}`);
    console.log(`   Sample Votes: ${votes.length}`);
    
    return exportData;
    
  } catch (error) {
    console.error('❌ Export failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Only run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  exportData().catch(console.error);
}

export { exportData };