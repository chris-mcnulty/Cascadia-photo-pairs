# Cascadia Oceanic Photo Voting App

## Overview
This is a full-stack photo voting application for ranking landscape photography. Users vote between photo pairs in a tournament style, tracking wins, losses, and overall rankings. Key capabilities include an admin dashboard for statistics and settings, purchase link management, real-time voting analytics, and intelligent photo editing. The business vision is to provide a platform for showcasing and ranking photographic talent, with potential for curated contests and integrated sales, expanding into a multi-instance architecture (Synozur) for professional decision-making platforms in both visual and text-based content comparison.

## User Preferences
Preferred communication style: Simple, everyday language.

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
- **Schema**: Includes tables for photos, votes, settings, users, userStats, contestEntries, and userFavorites.
- **Migrations**: Drizzle Kit for schema management.
- **Session Management**: Persistent session storage using connect-pg-simple.

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
- **User Features**: User-specific statistics, contest entry system, favorites, purchase history.
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