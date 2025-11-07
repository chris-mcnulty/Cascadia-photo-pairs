import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { storage } from './storage';
import { db } from './db';
import { products, inventoryItems, sales, customers } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Wix Products CSV Schema
const wixProductSchema = z.object({
  handleId: z.string(),
  name: z.string(),
  fieldType: z.enum(['Product', 'Variant']),
  description: z.string().optional(),
  sku: z.string().optional(),
  price: z.string().transform(val => parseFloat(val) || 0),
  discount: z.string().optional(),
  visible: z.string().transform(val => val === 'TRUE'),
  inventory: z.string().optional().transform(val => parseInt(val || '0')),
  weight: z.string().optional(),
  ribbon: z.string().optional(),
  optionChoices: z.string().optional(),
  productImageUrl: z.string().optional(),
  additionalImageUrls: z.string().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  collections: z.string().optional(),
  tags: z.string().optional(),
  shipping: z.string().optional(),
  tax: z.string().optional(),
  customTextFields: z.string().optional(),
});

// Wix Orders CSV Schema (Item-level)
const wixOrderSchema = z.object({
  'Order ID': z.string(),
  'Order Number': z.string(),
  'Order Date': z.string(),
  'Order Status': z.string(),
  'Payment Status': z.string(),
  'Payment Method': z.string().optional(),
  'Currency': z.string(),
  'Subtotal': z.string().transform(val => parseFloat(val) || 0),
  'Tax': z.string().transform(val => parseFloat(val) || 0),
  'Shipping': z.string().transform(val => parseFloat(val) || 0),
  'Discount': z.string().transform(val => parseFloat(val) || 0),
  'Total': z.string().transform(val => parseFloat(val) || 0),
  'Channel': z.string().optional(),
  'Product Name': z.string(),
  'SKU': z.string().optional(),
  'Quantity': z.string().transform(val => parseInt(val) || 1),
  'Price': z.string().transform(val => parseFloat(val) || 0),
  'Line Total': z.string().transform(val => parseFloat(val) || 0),
  'Variant Options': z.string().optional(),
  'Product ID': z.string().optional(),
  'Customer Name': z.string(),
  'Email': z.string().optional(),
  'Phone': z.string().optional(),
  'Billing Address': z.string().optional(),
  'Shipping Address': z.string().optional(),
  'Notes': z.string().optional(),
  'Tracking Number': z.string().optional(),
  'Fulfillment Status': z.string().optional(),
  'Refund Status': z.string().optional(),
});

type WixProduct = z.infer<typeof wixProductSchema>;
type WixOrder = z.infer<typeof wixOrderSchema>;

// Parse variant options string (e.g., "Size:24x36;Media:Metal")
function parseVariantOptions(optionChoices?: string): { size?: string; media?: string } {
  if (!optionChoices) return {};
  
  const options: Record<string, string> = {};
  const pairs = optionChoices.split(';');
  
  for (const pair of pairs) {
    const [key, value] = pair.split(':');
    if (key && value) {
      options[key.trim().toLowerCase()] = value.trim();
    }
  }
  
  return {
    size: options.size,
    media: options.media || options.medium,
  };
}

// Determine aspect ratio from size string
function getAspectRatioFromSize(size: string): string {
  // Common photo print sizes and their aspect ratios
  const sizeToAspectRatio: Record<string, string> = {
    // 3:2 ratio (landscape)
    '4x6': '3x2',
    '6x4': '2x3',
    '8x12': '3x2',
    '12x8': '2x3',
    '12x18': '3x2',
    '18x12': '2x3',
    '16x24': '3x2',
    '24x16': '2x3',
    '20x30': '3x2',
    '30x20': '2x3',
    '24x36': '3x2',
    '36x24': '2x3',
    
    // 4:3 ratio
    '8x6': '4x3',
    '6x8': '3x4',
    '12x9': '4x3',
    '9x12': '3x4',
    '16x12': '4x3',
    '12x16': '3x4',
    '20x15': '4x3',
    '15x20': '3x4',
    
    // 5:7 ratio
    '5x7': '5x7',
    '7x5': '7x5',
    
    // 16:9 ratio (wide)
    '16x9': '16x9',
    '9x16': '9x16',
    
    // 1:1 ratio (square)
    '8x8': '1x1',
    '10x10': '1x1',
    '12x12': '1x1',
    '16x16': '1x1',
    '20x20': '1x1',
  };
  
  // Check direct match
  const normalizedSize = size.toLowerCase().replace(/\s/g, '');
  if (sizeToAspectRatio[normalizedSize]) {
    return sizeToAspectRatio[normalizedSize];
  }
  
  // Try to extract dimensions and calculate
  const match = normalizedSize.match(/(\d+)x(\d+)/);
  if (match) {
    const width = parseInt(match[1]);
    const height = parseInt(match[2]);
    const isLandscape = width > height;
    
    // Determine common ratios
    const ratio = width / height;
    const inverseRatio = height / width;
    
    if (Math.abs(ratio - 1.5) < 0.1 || Math.abs(inverseRatio - 1.5) < 0.1) {
      return isLandscape ? '3x2' : '2x3';
    }
    if (Math.abs(ratio - 1.33) < 0.1 || Math.abs(inverseRatio - 1.33) < 0.1) {
      return isLandscape ? '4x3' : '3x4';
    }
    if (Math.abs(ratio - 1.4) < 0.1 || Math.abs(inverseRatio - 1.4) < 0.1) {
      return isLandscape ? '7x5' : '5x7';
    }
    if (Math.abs(ratio - 1) < 0.1) {
      return '1x1';
    }
  }
  
  // Default to 3x2 landscape
  return '3x2';
}

export async function importWixProducts(csvContent: string): Promise<{
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;
  
  try {
    // Parse CSV
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
    
    // Process each record
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      try {
        const wixProduct = wixProductSchema.parse(record);
        
        // Skip variants for now (we'll handle them separately if needed)
        if (wixProduct.fieldType === 'Variant') {
          console.log(`Skipping variant: ${wixProduct.name}`);
          skipped++;
          continue;
        }
        
        // Check if product already exists by name or SKU
        const existingProducts = await storage.getAllProducts();
        const existing = existingProducts.find(
          p => p.title === wixProduct.name || 
              (wixProduct.sku && p.title.includes(wixProduct.sku))
        );
        
        if (existing) {
          console.log(`Product already exists: ${wixProduct.name}`);
          skipped++;
          continue;
        }
        
        // Parse variant options to determine aspect ratio
        const options = parseVariantOptions(wixProduct.optionChoices);
        const aspectRatio = options.size ? getAspectRatioFromSize(options.size) : '3x2';
        
        // Create product
        const product = await storage.createProduct({
          title: wixProduct.name,
          photoId: null, // Will need manual linking to photos
          aspectRatio,
          description: wixProduct.description || null,
          isActive: wixProduct.visible,
        });
        
        console.log(`Imported product: ${product.title}`);
        imported++;
        
      } catch (error) {
        const errorMsg = `Failed to import product at row ${i + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }
    
    return {
      success: errors.length === 0,
      imported,
      skipped,
      errors,
    };
    
  } catch (error) {
    const errorMsg = `CSV parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(errorMsg);
    return {
      success: false,
      imported: 0,
      skipped: 0,
      errors: [errorMsg],
    };
  }
}

export async function importWixOrders(csvContent: string): Promise<{
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;
  const processedOrders = new Set<string>();
  
  try {
    // Parse CSV
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
    
    // Group records by Order ID (since it's item-level export)
    const orderGroups = new Map<string, WixOrder[]>();
    for (const record of records) {
      try {
        const wixOrder = wixOrderSchema.parse(record);
        const orderId = wixOrder['Order ID'];
        
        if (!orderGroups.has(orderId)) {
          orderGroups.set(orderId, []);
        }
        orderGroups.get(orderId)!.push(wixOrder);
      } catch (error) {
        const errorMsg = `Failed to parse order record: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }
    
    // Process each order
    const orderEntries = Array.from(orderGroups.entries());
    for (let i = 0; i < orderEntries.length; i++) {
      const [orderId, orderItems] = orderEntries[i];
      try {
        if (processedOrders.has(orderId)) {
          continue;
        }
        
        const firstItem = orderItems[0];
        
        // Determine sales channel
        const channelMap: Record<string, string> = {
          'Website': '1', // Assuming ID 1 is Website
          'POS': '2', // Assuming ID 2 is Art Shows
          'Art Show': '2',
          'Amazon': '3',
          'Etsy': '4',
        };
        
        const salesChannelId = channelMap[firstItem.Channel || 'Website'] || '1';
        
        // Check or create customer
        let customerId: string | null = null;
        if (firstItem.Email) {
          const existingCustomers = await db.select().from(customers).where(eq(customers.email, firstItem.Email));
          
          if (existingCustomers.length > 0) {
            customerId = existingCustomers[0].id;
          } else {
            // Create new customer
            const [newCustomer] = await db.insert(customers).values({
              name: firstItem['Customer Name'],
              email: firstItem.Email || null,
              phone: firstItem.Phone || null,
              address: firstItem['Billing Address'] || null,
              notes: null,
            }).returning();
            customerId = newCustomer.id;
          }
        }
        
        // Process each item in the order
        for (const item of orderItems) {
          // Try to find matching product by name
          const products = await storage.getAllProducts();
          const matchingProduct = products.find(p => 
            p.title === item['Product Name'] || 
            (item.SKU && p.title.includes(item.SKU))
          );
          
          if (!matchingProduct) {
            console.warn(`No matching product found for: ${item['Product Name']}`);
            continue;
          }
          
          // Parse variant options
          const options = parseVariantOptions(item['Variant Options']);
          
          // Create sale record
          await storage.createSale({
            productId: matchingProduct.id,
            channelId: salesChannelId,
            customerId,
            saleDate: new Date(item['Order Date']),
            soldPrice: Math.round(item['Line Total'] * 100), // Convert to cents
            taxCollected: Math.round(item.Tax * 100),
            buyerName: item['Customer Name'],
            buyerEmail: item.Email || null,
            buyerPhone: item.Phone || null,
            shippingAddress: item['Shipping Address'] || null,
            notes: item.Notes || null,
          });
          
          imported++;
        }
        
        processedOrders.add(orderId);
        
      } catch (error) {
        const errorMsg = `Failed to import order ${orderId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }
    
    return {
      success: errors.length === 0,
      imported,
      skipped,
      errors,
    };
    
  } catch (error) {
    const errorMsg = `CSV parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(errorMsg);
    return {
      success: false,
      imported: 0,
      skipped: 0,
      errors: [errorMsg],
    };
  }
}