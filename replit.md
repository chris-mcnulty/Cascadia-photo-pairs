# Cascadia Oceanic Photo Voting App

## Overview

This is a full-stack photo voting application built for displaying and ranking landscape photography. Users can vote between pairs of photos in a tournament-style system, with the app tracking wins, losses, and overall rankings. The application includes an admin dashboard for viewing statistics and managing settings, plus the ability to enable/disable purchase links for photos.

The app uses a modern React frontend with shadcn/ui components, Express.js backend, and is designed to work with PostgreSQL database through Drizzle ORM. It includes features like real-time voting statistics, photo pair randomization, comprehensive admin analytics, and intelligent inline photo editing.

## Recent Changes (August 2025)

**Mobile-Optimized Voting Interface**
- Implemented comprehensive mobile voting interface with touch/swipe gesture support
- Added automatic mobile device detection with fallback to desktop interface
- Created desktop/mobile view toggle in navigation for user preference control
- Developed clean mobile voting layout with proper photo display and touch-friendly interactions
- Enhanced photo voting with smooth animations and visual feedback
- Fixed mobile interface display issues - photos now render correctly instead of showing placeholder boxes

**Collections System & Database Schema**
- Added complete collections database schema with color themes and organization features
- Implemented collections API endpoints for CRUD operations (create, read, update, delete)
- Enhanced photo queries to support filtering by collection ID
- Prepared infrastructure for themed photo groupings and curated voting experiences

**UI/UX & Branding Enhancements**
- Updated browser title to "Cascadia Oceanic | Photo Pairs" for better branding
- Added custom favicon using provided Cascadia logo for professional appearance
- Implemented dynamic title management system for different application sections
- Enhanced mobile navigation with collection selector integration

**Production Database & Performance Optimization**
- Discovered and configured shared Neon database between development and production environments
- Optimized admin interface with lightweight photo loading to prevent 44MB response timeouts
- Implemented smart base64 image truncation for admin panels while preserving full images for voting
- Enhanced database status reporting to reflect shared environment configuration
- Confirmed seamless data synchronization across development and production instances

**Photo Management Improvements** 
- Implemented inline photo editing with forms appearing directly below selected photos
- Smart differentiation between URL-based and file-based (base64) photos in edit interface
- URL-based photos show editable URL field with live preview
- File-based photos hide URL field and display informative message about database storage
- Enhanced user experience by eliminating need to scroll to top of page for editing

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

**Frontend Architecture**
- React 18 with TypeScript using Vite as the build tool
- Client-side routing implemented with Wouter for lightweight navigation
- State management handled by TanStack Query (React Query) for server state
- UI built with shadcn/ui component library and Radix UI primitives
- Styling using Tailwind CSS with custom CSS variables for theming
- Form handling with React Hook Form and Zod validation

**Backend Architecture**  
- Node.js with Express.js server providing RESTful API endpoints
- TypeScript throughout the entire stack for type safety
- In-memory storage implementation (MemStorage) as a fallback with interface for database integration
- Middleware for request logging, error handling, and JSON parsing
- Development server integrates with Vite for hot module replacement

**Data Storage**
- PostgreSQL database configured through Drizzle ORM with persistent storage
- Database schema includes photos, votes, settings, and sessions tables with proper indexing
- Support for Neon Database serverless PostgreSQL hosting
- Migration system using Drizzle Kit for schema management
- DatabaseStorage class replaces MemStorage for full persistence
- Automatic database seeding with default photos on first startup
- Persistent session storage prevents authentication loss on server restarts

**API Design**
- RESTful endpoints following conventional patterns:
  - GET /api/photos - retrieve all photos
  - GET /api/photos/random-pair - get random photo pair for voting
  - POST /api/votes - submit vote with winner/loser tracking  
  - GET /api/stats - retrieve voting statistics and rankings
  - PUT /api/settings - update application settings
- Proper HTTP status codes and error handling
- Request/response logging middleware

**Authentication & Authorization**
- Authentication temporarily simplified to restore admin panel functionality
- Admin dashboard accessible without authentication for development/testing
- Database-backed session infrastructure ready for future implementation
- Session timeout and cleanup systems prepared for production deployment

**Key Features**
- Photo pair randomization for fair voting comparisons  
- Win/loss ratio tracking with comprehensive statistics
- Admin dashboard with top 20 rankings and advanced analytics
- Date range filtering for trend analysis without losing historical data
- Test data purging functionality for production deployment
- Photo hiding/showing feature to curate voting collection while preserving stats
- Configurable purchase links (can be enabled/disabled per photo or globally)
- Real-time vote counting and statistics updates
- File upload support with drag-and-drop for photos up to 10MB
- Intelligent photo editing with inline forms that appear below selected photos
- Smart handling of URL-based vs. file-based photos in edit interface
- SMS-based two-factor authentication for admin security
- Responsive design optimized for both desktop and mobile voting

**Development Workflow**
- ESM modules throughout the application
- TypeScript compilation with strict mode enabled
- Development server with hot reloading via Vite
- Build process creates optimized production bundle
- Database schema managed through migrations

## External Dependencies

**Database & ORM**
- PostgreSQL as the primary database (configured for Neon Database)
- Drizzle ORM for type-safe database operations and migrations
- connect-pg-simple for PostgreSQL session storage

**UI & Styling**
- Radix UI primitives for accessible component foundation
- Tailwind CSS for utility-first styling approach
- shadcn/ui for pre-built component library
- Lucide React for consistent iconography

**Development & Build Tools**
- Vite for fast development server and optimized production builds
- TypeScript for type safety across frontend and backend
- ESBuild for efficient backend bundling

**State Management & Data Fetching**
- TanStack Query for server state management and caching
- React Hook Form with Zod for form validation
- Wouter for client-side routing

**Runtime & Deployment**
- Node.js runtime environment
- Express.js web server framework
- Support for Replit deployment environment with specific plugins

**Asset Management**
- Static asset handling through Vite
- Image optimization and delivery (currently using Unsplash for sample photos)
- Support for custom photo uploads and URLs