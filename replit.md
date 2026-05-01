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
- **Schema**: Comprehensive, including tables for photos, votes, users, user stats, contest entries, user favorites, and an extensive business management system (orders, orderItems, inventoryItems, sales [legacy], dropShipOrders, salesChannels, suppliers, supplierPrices, productSizes, expenses, expenseCategories, products, productVariants, productSKUs, channelSKUs, retailPrices).
- **Session Management**: Persistent session storage using `connect-pg-simple`.
- **SharePoint Integration**: For receipt storage linked to business expenses.

### Authentication & Authorization
- **User System**: Full user authentication (registration, login, password reset, email verification) secured with JWTs and bcrypt.
- **Admin System**: Admin dashboard with JWT-based authentication. Features include an option to enable/disable user login, and a master admin system with role management for co-admins.

**CRITICAL: Authentication Middleware Pattern**
- **ALWAYS use `isAuthenticated` middleware for ALL admin routes** (routes starting with `/api/admin/`)
- **NEVER use `checkAdminAuth` as middleware** - it is a helper function, not Express middleware
- `checkAdminAuth` should ONLY be called inside route handlers to get admin status (e.g., `const adminStatus = await checkAdminAuth(req);`)
- **Pattern to follow:**
  ```typescript
  // ✅ CORRECT: Use isAuthenticated as middleware
  app.get("/api/admin/some-route", isAuthenticated, async (req, res) => {
    // Inside handler, you can optionally call checkAdminAuth if you need admin status
    const adminStatus = await checkAdminAuth(req);
    // ...
  });
  
  // ❌ WRONG: Using checkAdminAuth as middleware
  app.get("/api/admin/some-route", checkAdminAuth, async (req, res) => {
    // This will cause 401 authentication errors
  });
  ```
- **Routes requiring this pattern:** All CRUD operations on sales, sales channels, suppliers, products, inventory, expenses, etc.

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

### Admin Navigation
- **Hierarchical Menu Structure**: Top-level navigation includes Analytics, Photos, Pairs, Users, Communication, Business (dropdown), and Settings
- **Business Dropdown**: Clicking the Business button reveals a dropdown menu with:
  - Dashboard: Business overview and statistics
  - Products: Product management with photos and descriptions
  - SKUs: Master SKU and Channel SKU management with CSV import/export
  - Inventory: Individual print tracking with acquisition/sale dates
  - Sales: Multi-channel sales tracking and management
  - Suppliers: Supplier management with pricing history
  - Sizes: Product size definitions with aspect ratios
  - Expenses: Expense tracking with SharePoint receipt integration
  - Import Data: CSV import utility for Wix historical data

### Key Features
- **Voting System**: Tournament-style photo pairing, intelligent pair selection (no duplicates, no consecutive pairs), and tracking of wins/losses. Supports "Pairs" for direct comparison of related photos.
- **Admin Dashboard**: Analytics, ranking displays, data filtering, user/photo management, and bulk operations.
- **Business Management**: Integrated system for inventory, sales, and financial tracking. Includes:
  - **Orders System**: Multi-item order support with orders and order_items tables. Each order can contain multiple line items (products/SKUs), with order-level totals and per-item pricing/tax. Optional order numbers for external platform integration (Etsy, Amazon, etc.)
  - **SKU Management**: Master SKU system (product + media + size) with channel-specific SKUs for each sales platform. Auto-generate SKU codes from product data. Search and filter across all SKUs.
  - **Supplier Pricing**: Historical versioning with effective dates
  - **Inventory Tracking**: Individual print tracking (acquisition/sale dates), linked to order items
  - **Drop-ship Orders**: Fulfillment tracking, linked to specific order items
  - **Expense Tracking**: SharePoint integration for receipt storage
  - **Sales Tax Calculation**: Automated tax calculations at order and line-item levels
  - **Multi-channel Sales**: Support for Website, Art Shows, Amazon, Etsy
  - **Dual Workflows**: Both online sales (sale-first) and art show (inventory-first) workflows
  - **CSV Import**: Wix historical data import with UTF-8 BOM handling
  - **Product Architecture**: Comprehensive system separating products from photos, with variants, SKUs, and channel SKUs
  - **Data Migration**: Legacy sales table preserved for backward compatibility; existing sales migrated to orders+order_items structure
  - **Auto-fill List Price**: Inventory form automatically fetches and populates list price from retail_prices table based on selected product size and media type. Features manual override detection, loading states, and helper messages. Preserves intentional manual price overrides when editing existing items.
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

## Backlog Items

### High Priority
1. **Multi-item Order Management System**: Build dedicated orders workflow using the orders/order_items tables to replace the legacy single-item sales form. Features needed:
   - Order header with order number, customer info, totals
   - Dynamic list of order items with add/remove capability
   - Integration with existing inventory and product systems
   - Migration plan for legacy sales data to orders structure
   - Support for external platform order numbers (Etsy, Amazon, etc.)

### Medium Priority
2. **Separate Production/Development Databases**: Currently production and development share the same DATABASE_URL. Need separate database instances to prevent data corruption during testing.

### Completed
- ✅ Auto-fill list price feature for inventory items (completed 2024-11)
- ✅ Multi-aspect-ratio products (completed 2026-05): Products now support multiple aspect ratios via `aspectRatios: text[]` column on `products` table while keeping singular `aspectRatio` as the "primary". Product management UI uses a checkbox grid with a "Set primary" toggle per ratio. SKU management and inventory-form-dialog filter eligible product sizes by ANY of the product's allowed aspect ratios (with normalization handling `3x2`, `3:2`, `3X2`, `3×2`). POST/PATCH `/api/products` auto-include the primary ratio in the array. Existing products were backfilled with `aspect_ratios = ARRAY[aspect_ratio]`.