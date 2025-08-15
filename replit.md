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

### Pairs Feature (Photo Comparison System)
- **Feature Name**: Pairs - Special photo comparison system
- **Purpose**: Allow configuration of photo pairs (twins) for direct comparison (e.g., black & white vs color versions)
- **Frequency**: Show a pair every 10-15 voting rounds (configurable, default 5-15)
- **Pair Selection**: Random selection when it's time, checking both photos are eligible
- **Fallback**: If no eligible pairs, show regular photos
- **Admin Requirements**:
  - Interface to set up and manage pairs
  - Alert system if half of a pair is missing/hidden
  - Special pair comparison report for head-to-head analytics
- **Database**: New table for photo_pairs with photo1_id, photo2_id, frequency settings
- **Voting**: Track pair comparisons separately for detailed analytics

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