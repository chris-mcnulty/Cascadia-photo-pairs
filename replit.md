# Cascadia Oceanic Photo Voting App + Public Site

## Overview
A full-stack web application integrating a public-facing photographer site (chrismcnulty.net) with an e-commerce store (ChromaLuxe metal prints), a tournament-style photo voting tool ("Photo Pairs"), and a comprehensive admin/business backend. The platform aims to showcase and rank photographic talent, with future potential for curated contests, integrated sales, and evolution into a multi-instance architecture (Synozur) for content comparison.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite.
- **Routing**: Wouter for client-side navigation.
- **State Management**: TanStack Query (React Query) for server state.
- **UI/UX**: shadcn/ui components built on Radix UI primitives, styled with Tailwind CSS and custom CSS variables. Full Progressive Web App (PWA) functionality.
- **Forms**: React Hook Form with Zod for validation.
- **Public Site Layout**: Features a consistent layout with hero image, wordmark, top navigation, and footer. Includes specific routes for Home, Portfolio, Store, Cart, Checkout, Biography, Calendar, and News.
- **SEO**: Dynamic `<title>` and OpenGraph/Twitter meta tags.

### Backend Architecture
- **Server**: Node.js with Express.js for RESTful APIs.
- **Language**: TypeScript for end-to-end type safety.
- **Storage**: PostgreSQL with Drizzle ORM, with an in-memory option for development.
- **Session Management**: Persistent session storage using `connect-pg-simple`.

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM, compatible with Neon Database.
- **Schema**: Extensive schema for photos, votes, users, user stats, contest entries, and a comprehensive business management system including orders, inventory, products, suppliers, expenses, and sales.
- **SharePoint Integration**: For receipt storage linked to business expenses.

### Authentication & Authorization
- **User System**: Full user authentication (registration, login, password reset, email verification) secured with JWTs and bcrypt.
- **Admin System**: JWT-based admin dashboard with optional user login disablement and master admin role management.
- **Critical Authentication Middleware**: All admin routes (`/api/admin/`) **MUST** use `isAuthenticated` middleware. `checkAdminAuth` is a helper function and **MUST NOT** be used as middleware.

### Key Features
- **Voting System**: Tournament-style photo pairing with intelligent selection and win/loss tracking.
- **Admin Dashboard**: Analytics, ranking displays, data filtering, user/photo management, and bulk operations.
- **Business Management**: Integrated system for multi-item orders, Master and Channel SKU management (with auto-generation and CSV import/export), individual print inventory tracking (acquisition/sale dates), historical supplier pricing, drop-ship order fulfillment, expense tracking (with SharePoint integration), automated sales tax calculation, and multi-channel sales support (Website, Art Shows, Amazon, Etsy). Supports both online (sale-first) and art show (inventory-first) workflows. Features an auto-fill list price for inventory items with manual override detection. Comprehensive product architecture supporting multiple aspect ratios.
- **User Features**: Personalized statistics, contest entry, favorites, purchase history, and client-side leaderboard.
- **Photo Management**: Inline editing, drag-and-drop uploads, smart photo source handling, and collection organization.
- **Communication**: Email notifications (welcome, verification, contest).
- **Email Marketing**: Centralized contacts (`contacts`, `contact_lists`, `email_campaigns`) with branded HTML shell, SendGrid send pipeline (separate from transactional, click-tracking off), tokenized one-click unsubscribe at `/unsubscribe?t=<token>`, idempotent backfill from users + customers (dedup by lower(email)), and admin UI under Communication → Email Marketing tab. Configure defaults under Settings → Email Marketing Defaults. Public routes: `GET/POST /api/unsubscribe/:token`. Admin routes (auth required): `/api/admin/contacts`, `/api/admin/contact-lists`, `/api/admin/campaigns`.
- **Mobile Experience**: Optimized UI with touch/swipe gestures, consistent with PWA.
- **RSS News Integration**: Configurable system for news feeds.
- **Social Publisher**: System for scheduling and publishing posts to Instagram & Facebook via CSV import, tracking clicks, and managing social accounts. It includes token management and a scheduler with exponential backoff for retries.

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

### Third-Party Services
- **Stripe**: Payment processing for e-commerce checkouts.
- **SharePoint**: For receipt storage linked to business expenses.
- **Meta (Facebook/Instagram) Graph API**: For social media publishing.