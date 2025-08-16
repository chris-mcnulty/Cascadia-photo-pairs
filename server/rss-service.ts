import Parser from 'rss-parser';

interface RSSItem {
  id: string;
  title: string;
  description: string;
  link: string;
  publishDate: string;
  priority: number;
  imageUrl?: string;
}

interface RSSConfig {
  url: string;
  tag?: string;
  daysLimit: number;
  maxItems: number;
}

export class RSSService {
  private parser: Parser;

  constructor() {
    this.parser = new Parser({
      customFields: {
        item: ['category', 'categories', 'dc:subject', 'tags']
      }
    });
  }

  async fetchRSSFeed(config: RSSConfig): Promise<RSSItem[]> {
    try {
      const feed = await this.parser.parseURL(config.url);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - config.daysLimit);

      let items = feed.items
        .filter(item => {
          // Filter by date
          const publishDate = new Date(item.pubDate || item.isoDate || '');
          if (publishDate < cutoffDate) return false;

          // Filter by tag if specified
          if (config.tag) {
            const hasTag = this.itemHasTag(item, config.tag);
            if (!hasTag) return false;
          }

          return true;
        })
        .slice(0, config.maxItems)
        .map((item, index) => ({
          id: `rss-${item.guid || item.link || Date.now()}-${index}`,
          title: item.title || 'Untitled',
          description: this.cleanDescription(item.contentSnippet || item.content || item.summary || ''),
          link: item.link || '',
          publishDate: item.pubDate || item.isoDate || new Date().toISOString(),
          priority: index + 1, // RSS items get sequential priority
          imageUrl: this.extractImageUrl(item)
        }));

      return items;
    } catch (error) {
      console.error('Error fetching RSS feed:', error);
      return [];
    }
  }

  private itemHasTag(item: any, targetTag: string): boolean {
    const targetLower = targetTag.toLowerCase();
    
    // Check various tag fields
    const tagFields = [
      item.category,
      item.categories,
      item['dc:subject'],
      item.tags
    ];

    for (const field of tagFields) {
      if (!field) continue;
      
      // Handle string
      if (typeof field === 'string') {
        if (field.toLowerCase().includes(targetLower)) return true;
      }
      
      // Handle array
      if (Array.isArray(field)) {
        if (field.some(tag => 
          typeof tag === 'string' && tag.toLowerCase().includes(targetLower)
        )) return true;
      }
    }

    // Also check title and content for tag
    const titleMatch = item.title?.toLowerCase().includes(targetLower);
    const contentMatch = item.content?.toLowerCase().includes(targetLower) || 
                        item.contentSnippet?.toLowerCase().includes(targetLower);
    
    return titleMatch || contentMatch;
  }

  private cleanDescription(description: string): string {
    // Remove HTML tags and limit length
    const clean = description
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    return clean.length > 200 ? clean.substring(0, 200) + '...' : clean;
  }

  private extractImageUrl(item: any): string | undefined {
    // Try to extract image from various RSS fields
    if (item.enclosure?.url && item.enclosure.type?.startsWith('image/')) {
      return item.enclosure.url;
    }
    
    if (item['media:content']?.url) {
      return item['media:content'].url;
    }
    
    if (item['media:thumbnail']?.url) {
      return item['media:thumbnail'].url;
    }

    // Try to extract from content
    if (item.content) {
      const imgMatch = item.content.match(/<img[^>]+src="([^"]+)"/);
      if (imgMatch) return imgMatch[1];
    }

    return undefined;
  }
}

export const rssService = new RSSService();