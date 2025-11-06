# Cascadia Oceanic Photo Voting App

## Overview
This is a full-stack photo voting application for ranking landscape photography. Users vote between photo pairs in a tournament style, tracking wins, losses, and overall rankings. Key capabilities include an admin dashboard for statistics and settings, purchase link management, real-time voting analytics, and intelligent photo editing. The business vision is to provide a platform for showcasing and ranking photographic talent, with potential for curated contests and integrated sales, expanding into a multi-instance architecture (Synozur) for professional decision-making platforms in both visual and text-based content comparison.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes
- **Business Inventory & Sales Management System (Nov 6, 2025)**: Complete inventory tracking and financial management system for photography print sales. Includes 9 new database tables: sales channels, suppliers, product sizes, supplier pricing (with historical versioning), sales records (with full buyer details), inventory items (linked to photo library), drop-ship orders, expense categories, and expenses. SharePoint integration configured for receipt uploads. New "Business" tab in admin panel provides dashboard analytics, inventory management, supplier pricing matrix, and expense tracking. Seeded with 4 sales channels (Website, Art Shows, Amazon, Etsy), 7 expense categories, and 10 standard product sizes. Supports two workflows: online sales (sale → drop-ship order → inventory) and art shows (inventory → sale).
- **Admin Authentication Streamlined (Nov 6, 2025)**: Eliminated deprecated SMS/MFA admin login flow. Admin access now works seamlessly with JWT tokens from regular login - no separate password prompts or SMS verification. Automatic authentication headers added to all API requests (queryClient.ts) for consistent admin feature access including Pairs management. Single authentication at login provides full admin panel access.
- **CRITICAL VOTE TRACKING BUG FIXED (Aug 30, 2025)**: Resolved major issue where authenticated user votes weren't being recorded due to missing JWT token headers in vote requests. Fixed vote tracking for contest integrity and legal compliance. Confirmed working with test user vote successfully recorded.
- **Email Verification FULLY FIXED (Aug 30, 2025)**: Added missing /api/auth/verify-email endpoint and updated all email URLs to use correct SSL-enabled production domain. Email verification now works end-to-end with proper token validation and user status updates.
- **Authentication System Launch (Aug 30, 2025)**: Fixed mobile menu 404 login issue by correcting `/api/login` to `/login` in mobile voting interface. Complete user registration, email verification, and login flow now fully operational for production.
- **Admin Vote Display Bug FIXED (Aug 30, 2025)**: Resolved admin interface showing zero vote counts despite votes being recorded. Fixed query implementation to properly display user vote counts using SQL LEFT JOIN approach for accurate admin dashboard statistics.

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

### Data Storage
- **Database**: PostgreSQL, configured with Drizzle ORM.
- **Hosting**: Supports Neon Database serverless PostgreSQL.
- **Schema**: Includes tables for photos, votes, settings, users, userStats, contestEntries, userFavorites, and business management (inventoryItems, sales, dropShipOrders, salesChannels, suppliers, supplierPrices, productSizes, expenses, expenseCategories).
- **Migrations**: Drizzle Kit for schema management.
- **Session Management**: Persistent session storage using connect-pg-simple.
- **SharePoint Integration**: Receipt storage for business expense tracking.

### API Design
- **Style**: RESTful endpoints with conventional patterns.
- **Error Handling**: Proper HTTP status codes and error handling.

### Authentication & Authorization
- **System**: Complete user authentication with registration, login, password reset, and email verification.
- **Security**: JWT-based authentication, bcrypt for password hashing.
- **Admin**: Admin dashboard for statistics and settings, with an option to enable/disable user login features. SMS-based two-factor authentication for admin security.
- **Master Admin System**: Master admins cannot be downgraded; co-admins can be downgraded.

### Key Features
- **Voting**: Photo pair randomization, win/loss ratio tracking, intelligent photo pair selection algorithm (no duplicates, no consecutive pairs). Includes a "Pairs" feature for direct comparison of related photos (e.g., color vs. B&W versions) configurable for frequency.
- **Admin Dashboard**: Comprehensive analytics, top rankings, date range filtering, test data purging, photo hiding/showing, user management, and bulk category/sale status management.
- **Business Management**: Complete inventory and sales tracking system with supplier pricing (historical versioning), inventory management (individual print tracking), drop-ship order fulfillment, expense tracking with SharePoint receipt uploads, and multi-channel sales tracking (Website, Art Shows, Amazon, Etsy). Supports both online (sale-first) and art show (inventory-first) workflows.
- **User Features**: User-specific statistics, contest entry system, favorites, purchase history, personal leaderboard view (tracks voted photos in browser localStorage for persistent personal collection).
- **Photo Management**: Inline photo editing, file upload support (drag-and-drop), smart handling of URL-based vs. file-based photos.
- **Collections**: System for organizing photos into themed collections.
- **Communication**: Email notification system (welcome, verification, contest winners), customizable admin settings for contest text, support email, and privacy links.
- **Mobile Experience**: Optimized mobile interface with touch/swipe gestures, consistent with PWA experience.
- **RSS News Integration**: Configurable RSS feed system for news section, allowing choice between internal news management or consuming external RSS feeds, with thumbnail extraction and display.

### Platform Evolution Strategy
- **Business Model**: Multi-instance architecture supporting "Visual Mode" (Cascadia Oceanic) for photo voting and "Text Mode" (Synozur) for text-based content comparison, targeting visual artists, conferences, software teams, etc.
- **Rich Text Voting Mode (Planned)**: Future feature enabling voting/comparison of text-based content (proposals, backlog items) with mode switching, dedicated database schema, rich text editor, multi-tenancy, and subscription payment integration.

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