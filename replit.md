# Cascadia Oceanic Photo Voting App

## Overview
This is a full-stack photo voting application designed to rank landscape photography through a tournament-style voting system. It tracks user votes, wins, losses, and overall photo rankings. Key features include an admin dashboard for statistics and settings, purchase link management, real-time voting analytics, and intelligent photo editing. The business vision is to establish a platform for showcasing and ranking photographic talent, with future potential for curated contests, integrated sales, and evolution into a multi-instance architecture (Synozur) to support professional decision-making across visual and text-based content comparison.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, using Vite for building.
- **Routing**: Wouter for client-side navigation.
- **State Management**: TanStack Query (React Query) for server state.
- **UI/UX**: shadcn/ui components built on Radix UI primitives, styled with Tailwind CSS and custom CSS variables.
- **Forms**: React Hook Form with Zod for validation.
- **PWA**: Full Progressive Web App functionality including service worker, offline caching, and install prompt.

### Backend Architecture
- **Server**: Node.js with Express.js for RESTful APIs.
- **Language**: TypeScript for end-to-end type safety.
- **Storage**: Primarily PostgreSQL with Drizzle ORM, with an in-memory (MemStorage) option for development.

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM for schema management (migrations via Drizzle Kit).
- **Hosting**: Compatible with Neon Database serverless PostgreSQL.
- **Schema**: Comprehensive, including tables for photos, votes, users, user stats, contest entries, user favorites, and an extensive business management system (inventoryItems, sales, dropShipOrders, salesChannels, suppliers, supplierPrices, productSizes, expenses, expenseCategories, products, productVariants, productSKUs, channelSKUs, retailPrices).
- **Session Management**: Persistent session storage using `connect-pg-simple`.
- **SharePoint Integration**: For receipt storage linked to business expenses.

### Authentication & Authorization
- **User System**: Full user authentication (registration, login, password reset, email verification) secured with JWTs and bcrypt.
- **Admin System**: Admin dashboard with JWT-based authentication. Features include an option to enable/disable user login, and a master admin system with role management for co-admins.

### Admin Login Instructions
**How to Access Admin Features:**
1. **Register/Login**: Create an account at `/register` or login at `/login` with your email and password
2. **Set Admin Status**: Admin privileges must be set directly in the database:
   - Connect to the PostgreSQL database
   - Run: `UPDATE users SET is_admin = true WHERE email = 'your-email@example.com';`
   - For master admin (cannot be downgraded): `UPDATE users SET is_master_admin = true WHERE email = 'your-email@example.com';`
3. **Access Admin Panel**: After setting admin status, refresh the page and click "Admin" in the navigation to access:
   - Photo management and analytics
   - User management
   - Business management (inventory, sales, expenses, products, suppliers, etc.)
   - Settings and configuration
4. **Authentication**: Admin features use the same JWT token from your login - no separate admin login required

### Key Features
- **Voting System**: Tournament-style photo pairing, intelligent pair selection (no duplicates, no consecutive pairs), and tracking of wins/losses. Supports "Pairs" for direct comparison of related photos.
- **Admin Dashboard**: Analytics, ranking displays, data filtering, user/photo management, and bulk operations.
- **Business Management**: Integrated system for inventory, sales, and financial tracking. Includes supplier pricing (with historical versioning), individual print tracking (acquisition/sale dates), drop-ship order fulfillment, expense tracking (with SharePoint integration), sales tax calculation, and multi-channel sales support (Website, Art Shows, Amazon, Etsy). Supports both online sales (sale-first) and art show (inventory-first) workflows. Features CSV import for Wix data and comprehensive product architecture separating products from photos.
- **User Features**: Personalized statistics, contest entry, favorites, purchase history, and client-side personal leaderboard.
- **Photo Management**: Inline editing, drag-and-drop uploads, and smart handling of photo sources.
- **Collections**: Organization of photos into themed groups.
- **Communication**: Email notifications (welcome, verification, contest).
- **Mobile Experience**: Optimized UI with touch/swipe gestures, consistent with PWA.
- **RSS News Integration**: Configurable system for internal or external news feeds.
- **Platform Evolution**: Strategy to expand into a multi-instance architecture (Synozur) supporting "Visual Mode" (Cascadia Oceanic) for photos and a planned "Rich Text Voting Mode" for text-based content comparison, targeting various professional use cases.

## External Dependencies

### Database & ORM
- **PostgreSQL**: Primary database solution.
- **Drizzle ORM**: For database interactions and schema management.
- **connect-pg-simple**: For PostgreSQL-based session storage.

### UI & Styling
- **Radix UI**: Core accessible UI component primitives.
- **Tailwind CSS**: Utility-first CSS framework.
- **shadcn/ui**: Pre-built, customizable UI components.
- **Lucide React**: Icon library.

### Development & Build Tools
- **Vite**: Frontend build tool and development server.
- **TypeScript**: Language for type-safe code.
- **ESBuild**: Backend bundling.

### State Management & Data Fetching
- **TanStack Query**: Server state management and data fetching.
- **React Hook Form**: Form management with Zod for validation.
- **Wouter**: Lightweight client-side router.

### Runtime & Deployment
- **Node.js**: JavaScript runtime environment.
- **Express.js**: Web application framework for backend.
- **Replit**: Supported deployment platform.