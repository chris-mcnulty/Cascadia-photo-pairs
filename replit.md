# Cascadia Oceanic Photo Voting App

## Overview
This is a full-stack photo voting application designed for ranking landscape photography. Users vote between photo pairs in a tournament style, tracking wins, losses, and overall rankings. Key capabilities include an admin dashboard for statistics and settings, purchase link management, real-time voting analytics, and intelligent photo editing. The business vision is to provide a platform for showcasing and ranking photographic talent, with potential for curated contests and integrated sales.

## User Preferences
Preferred communication style: Simple, everyday language.

## Site Owner Information
- **Primary Owner**: Chris McNulty (cmcnulty2000@yahoo.com)
- **Site Launch Date**: August 5, 2025
- **Owner Role**: Photographer and site owner, master admin with full privileges
- **Admin Hierarchy**: Master admins (protected) > Co-admins (can be downgraded) > Standard users
- **Current Admins**: cmcnulty2000@yahoo.com (master admin), chris.mcnulty@synozur.com (co-admin)
- **Voting History**: All admin votes belong to Chris McNulty starting from August 5, 2025
- **Email Service**: SendGrid integration ready but API key pending due to SendGrid login issue (ticket open)
- **Critical Mobile Fix**: Added missing authentication components (UserProfile, AuthenticationButtons) and announcements to mobile PWA interface
- **Production Data Fix**: Corrected admin vote tracking - 388 admin votes now properly linked to Chris McNulty's user account with accurate last vote timestamps and personal statistics
- **Profile Security Enhancement**: Added URL validation to prevent malicious code injection via profile image URLs, restricting to HTTP/HTTPS protocols only
- **User Statistics Integration**: Connected voting system to track user stats in real-time, enabling proper achievement level calculations and personal leaderboards
- **Admin Authentication Fix**: Updated user endpoints to recognize admin sessions automatically, enabling seamless profile editing and statistics access for master admins without requiring separate login flows
- **PWA Purchase Integration**: Added purchase buttons to mobile voting interface, displaying "Purchase Print" buttons under photos that are available for sale, matching desktop functionality
- **Achievement System Fix**: Corrected user achievement calculation to properly display Expert level for users with 100+ votes (fixed from incorrectly showing Beginner for high vote counts)
- **Leaderboard Label Fix**: Fixed swapped labels in photo leaderboard where "Total Votes" was showing win rate percentages and vice versa - now correctly displays statistics with proper labels
- **RSS News Integration**: Added configurable RSS feed system for news section, allowing choice between internal news management or consuming from external RSS feeds (chrismcnulty.net creative writing blog with photography posts), with enhanced styling for better visibility. Successfully integrated with https://www.chrismcnulty.net/creative-writing?format=rss
- **RSS Thumbnail Support**: Enhanced RSS system to extract and display thumbnail images from feed items when available, supporting multiple image formats including media enclosures, media content tags, iTunes images, and embedded images in content

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, Vite build tool.
- **Routing**: Wouter for lightweight client-side navigation.
- **State Management**: TanStack Query (React Query) for server state.
- **UI/UX**: shadcn/ui components and Radix UI primitives.
- **Styling**: Tailwind CSS with custom CSS variables for theming.
- **Forms**: React Hook Form with Zod validation.
- **PWA**: Fully functional Progressive Web App with service worker, offline caching, web app manifest, and install prompt.

### Backend Architecture
- **Server**: Node.js with Express.js for RESTful API endpoints.
- **Language**: TypeScript throughout for type safety.
- **Storage**: In-memory (MemStorage) with an interface for database integration; primarily uses PostgreSQL.
- **Middleware**: For request logging, error handling, and JSON parsing.

### Data Storage
- **Database**: PostgreSQL, configured with Drizzle ORM.
- **Hosting**: Supports Neon Database serverless PostgreSQL.
- **Schema**: Includes tables for photos, votes, settings, users, userStats, contestEntries, and userFavorites.
- **Migrations**: Drizzle Kit for schema management.
- **Session Management**: Persistent session storage using connect-pg-simple.

### API Design
- **Style**: RESTful endpoints with conventional patterns.
- **Endpoints**: Examples include `/api/photos`, `/api/photos/random-pair`, `/api/votes`, `/api/stats`, `/api/settings`.
- **Error Handling**: Proper HTTP status codes and error handling.

### Authentication & Authorization
- **System**: Complete user authentication with registration, login, password reset, and email verification.
- **Security**: JWT-based authentication (7-day expiry), bcrypt for password hashing.
- **Admin**: Admin dashboard for statistics and settings, with an option to enable/disable user login features. SMS-based two-factor authentication for admin security.
- **Master Admin System**: cmcnulty2000@yahoo.com (Chris McNulty) is the primary master admin with MFA backdoor (121365). Master admins cannot be downgraded, co-admins can be downgraded to standard users.
- **Analytics**: Both admins and master admins count as "admins" for tabulation purposes.

### Key Features
- **Voting**: Photo pair randomization, win/loss ratio tracking, intelligent photo pair selection algorithm (no duplicates, no consecutive pairs).
- **Admin Dashboard**: Comprehensive analytics, top 20 rankings, date range filtering, test data purging, photo hiding/showing, user management, and bulk category/sale status management.
- **User Features**: User-specific statistics, contest entry system, favorites, purchase history.
- **Photo Management**: Inline photo editing, file upload support (drag-and-drop), smart handling of URL-based vs. file-based photos.
- **Collections**: System for organizing photos into themed collections.
- **Communication**: Email notification system (welcome, verification, contest winners), customizable admin settings for contest text, support email, and privacy links.
- **Mobile Experience**: Optimized mobile interface with touch/swipe gestures, consistent with PWA experience.

## Backlog Features

### RSS News System Configuration (Admin Panel) ✓ COMPLETED
- **Feature Name**: RSS News Management Interface  
- **Status**: Fully implemented in Communication section of admin dashboard
- **Configuration Options**:
  - Toggle between internal news and RSS feed mode
  - RSS feed URL configuration
  - Tag filtering (default: photography)
  - Days limit (default: 90 days)
  - Maximum items to display (default: 3)
  - Automatic thumbnail image extraction and display
- **Image Support**: Extracts thumbnails from media enclosures, media:content, media:thumbnail, iTunes images, and embedded HTML images
- **Multi-tenant Support**: Configurable per tenant for future multi-photographer deployments
- **Admin Interface**: Located in Communication section alongside contest settings
- **Fallback**: Automatic fallback to internal news if RSS fails
- **Mobile Responsive**: Displays 20x20 pixel thumbnails with error handling

### Pairs Feature (Photo Comparison System) ✓ IMPLEMENTED
- **Feature Name**: Pairs - Special photo comparison system
- **Status**: Core functionality complete, ready for production use
- **Purpose**: Allow configuration of photo pairs (twins) for direct comparison (e.g., black & white vs color versions)
- **Frequency**: Show a pair every 10-15 voting rounds (configurable, default 5-15)
- **Pair Selection**: Random selection when it's time, checking both photos are eligible
- **Fallback**: If no eligible pairs, show regular photos
- **Admin Requirements**:
  - Interface to set up and manage pairs ✓
  - Alert system if half of a pair is missing/hidden ✓
  - Special pair comparison report for head-to-head analytics ✓
- **Database**: New table for photo_pairs with photo1_id, photo2_id, frequency settings ✓
- **Voting**: Track pair comparisons separately for detailed analytics ✓

### Rich Text Voting Mode (Multi-Purpose Comparison System) - PLANNED
- **Feature Name**: Rich Text Voting Mode
- **Target Launch**: Q2 2025 (after 2-month stability period)
- **Business Model**: Paid subscription offering for business clients
- **Purpose**: Enable voting/comparison of text-based content instead of photos
- **Use Cases**:
  - Conference session proposal evaluation
  - Software development backlog prioritization
  - Product feature voting
  - Content curation and ranking
  - Grant proposal evaluation
  - Creative writing competitions

#### Technical Architecture
- **Mode Switching**: Global toggle between Photo Mode and Rich Text Mode
- **Database Schema**:
  - `content_items` table: id, title, description, full_text, category, metadata (JSON), created_by, status
  - `content_votes` table: Similar to photo votes but for text content
  - `content_pairs` table: For paired comparisons of related proposals
  - `content_collections` table: Organize items into projects/conferences/sprints
- **Content Types**:
  - Short form: Title + brief description (280 chars)
  - Medium form: Title + abstract (500 words)
  - Long form: Full proposals with rich text formatting
  - Structured: Template-based forms with custom fields

#### User Interface Design
- **Voting Interface**:
  - Side-by-side card layout for comparisons
  - Expandable sections for full text reading
  - Quick preview vs detailed view toggle
  - Markdown/rich text rendering support
  - Metadata badges (category, author, word count)
- **Admin Features**:
  - Bulk import from CSV/JSON
  - Template designer for structured content
  - Custom evaluation criteria configuration
  - Export results to various formats
  - Multi-round voting support (qualifying rounds, finals)
- **Mobile Experience**:
  - Swipe gestures for voting
  - Collapsible cards for space efficiency
  - Reading mode with adjustable font size

#### Multi-Tenancy Requirements
- **Tenant Isolation**:
  - Separate database schemas or tenant_id column strategy
  - Independent admin panels per tenant
  - Custom branding per tenant (logo, colors, domain)
  - Isolated user bases with optional cross-tenant accounts
- **Configuration per Tenant**:
  - Custom categories and tags
  - Voting rules (single elimination, round robin, weighted)
  - Permission levels (public voting, member-only, invite-only)
  - Custom fields and metadata structures
- **Branding System**:
  - White-label support with custom domains
  - Tenant-specific CSS variables
  - Custom email templates
  - Branded PWA manifests

#### Payment & Subscription System
- **Pricing Tiers**:
  - Starter: Up to 100 items, 500 voters/month
  - Professional: Up to 1000 items, 5000 voters/month
  - Enterprise: Unlimited items and voters, API access
- **Payment Integration**:
  - Stripe for subscription management
  - Usage-based billing options
  - Team/organization billing
  - Annual discount offerings
- **Feature Gates**:
  - Advanced analytics (Professional+)
  - API access (Enterprise)
  - Custom branding (Professional+)
  - Priority support (Enterprise)

#### API & Integration Layer
- **RESTful API Endpoints**:
  - CRUD operations for content items
  - Voting submission and retrieval
  - Analytics and reporting
  - Webhook notifications
- **Third-Party Integrations**:
  - Import from Google Forms, Typeform
  - Export to Sheets, Airtable
  - Slack/Teams notifications
  - Calendar integration for deadlines
- **Embeddable Widgets**:
  - Voting widget for external sites
  - Results display widget
  - Submission form widget

#### Analytics & Reporting
- **Voting Analytics**:
  - Consensus metrics (agreement scores)
  - Demographic breakdowns (if collected)
  - Time-based voting patterns
  - Comparative analysis between items
- **Export Formats**:
  - PDF reports with visualizations
  - Excel workbooks with raw data
  - API endpoints for BI tools
  - Real-time dashboards

#### Implementation Phases
1. **Phase 1 (Month 1-2)**: Core rich text voting with basic admin
2. **Phase 2 (Month 3)**: Multi-tenancy and branding system
3. **Phase 3 (Month 4)**: Payment integration and subscription management
4. **Phase 4 (Month 5-6)**: Advanced analytics and API layer
5. **Phase 5 (Ongoing)**: Third-party integrations and enhancements

#### Technical Considerations
- **Performance**: Pagination for large text content, caching strategies
- **Security**: Rate limiting, CAPTCHA for public voting, data encryption
- **Accessibility**: Screen reader support, keyboard navigation, WCAG compliance
- **Scalability**: Database indexing, CDN for static content, queue system for batch operations
- **Data Privacy**: GDPR compliance, data retention policies, export/delete capabilities

## External Dependencies

### Database & ORM
- **PostgreSQL**: Primary database.
- **Drizzle ORM**: For type-safe database operations and migrations.
- **connect-pg-simple**: For PostgreSQL session storage.

### UI & Styling
- **Radix UI**: For accessible component foundation.
- **Tailwind CSS**: For utility-first styling.
- **shadcn/ui**: For pre-built component library.
- **Lucide React**: For iconography.

### Development & Build Tools
- **Vite**: Fast development server and optimized production builds.
- **TypeScript**: For type safety.
- **ESBuild**: For efficient backend bundling.

### State Management & Data Fetching
- **TanStack Query**: For server state management and caching.
- **React Hook Form**: With Zod for form validation.
- **Wouter**: For client-side routing.

### Runtime & Deployment
- **Node.js**: Runtime environment.
- **Express.js**: Web server framework.
- **Replit**: Supported deployment environment.