# Photography Admin Panel Design Guidelines

## Design Approach

**System-Based with Creative Overlay**: Combining Linear's clean data presentation + Notion's intuitive forms with photography-inspired aesthetics. Prioritizing scanability, efficient workflows, and professional polish for business management tasks.

**Core Principle**: Information clarity with photographic sensibility - let data breathe while maintaining visual sophistication.

---

## Typography Hierarchy

**Font Stack**:
- Primary: Inter (Google Fonts) - UI elements, tables, forms
- Accent: DM Serif Display - Section headers only

**Scale**:
- Page Headers: text-3xl font-medium
- Section Titles: text-xl font-semibold  
- Table Headers: text-sm font-semibold uppercase tracking-wide
- Body/Data: text-sm
- Labels: text-xs font-medium uppercase tracking-wider
- Metadata: text-xs text-gray-500

---

## Layout System

**Spacing Units**: Consistently use 4, 6, 8, 12, 16, 24 (p-4, gap-6, space-y-8, etc.)

**Container Strategy**:
- Sidebar: Fixed 280px width
- Main Content: max-w-7xl mx-auto with px-8
- Cards/Panels: p-6 to p-8
- Tables: Full width within container
- Forms: max-w-4xl for readability

**Grid Patterns**:
- Dashboard Stats: 4 columns (grid-cols-4)
- Product Grid: 3 columns (grid-cols-3)  
- Form Layouts: 2 columns (grid-cols-2) for efficiency

---

## Component Library

### Navigation
**Sidebar (Fixed Left)**:
- Logo/business name top (py-8)
- Navigation groups with headings
- Icons from Heroicons (via CDN)
- Active state: subtle background + border-left accent
- Badge counts for pending items

### Data Tables
**Inventory/Sales Tables**:
- Sticky headers (position-sticky top-0)
- Alternating row backgrounds for scanability
- Right-aligned numerical columns
- Sortable column headers with arrow indicators
- Action buttons (Edit, Delete) right-aligned in row
- Pagination controls bottom-right
- Search/filter bar above table with multi-select dropdowns

### Forms
**Add/Edit Inventory Forms**:
- Two-column layout for related fields
- Grouped sections with subtle dividers
- Input groups: Label above, helper text below
- Image upload zones: Dashed border, centered icon + text
- Price fields: Currency symbol prefix, right-aligned input
- Supplier dropdowns: Searchable select with autocomplete
- Save/Cancel buttons: Fixed bottom bar or top-right

### Cards & Panels
**Dashboard Stats Cards**:
- Icon + metric + label vertical stack
- Large numbers (text-4xl font-bold)
- Percentage change indicators (up/down arrows + color)
- Minimal borders, generous padding (p-8)

**Expense Receipt Cards**:
- Thumbnail preview left
- Metadata stack (date, vendor, amount) right
- Upload drop zone: Drag-and-drop visual cues
- PDF/image preview modal on click

### Supplier Price Matrix
**Interactive Grid Table**:
- Product names in left column (sticky)
- Supplier columns across top
- Editable cells with focus states
- Best price highlighting per row
- Bulk edit mode toggle

---

## Visual Treatment

**Borders**: 1px, subtle gray tones throughout
**Shadows**: Minimal - card elevations only (shadow-sm, shadow-md)
**Rounded Corners**: rounded-lg for cards, rounded for buttons/inputs
**Backgrounds**: Light neutral base, white cards for content hierarchy

---

## Animations

**Minimal & Purposeful**:
- Table row hover: Subtle background shift
- Button states: Default hover/active (no custom needed)
- Dropdown menus: Quick slide-in (150ms)
- Toast notifications: Slide from top-right
- NO scroll-triggered animations
- NO loading spinners beyond necessity

---

## Images

**Hero Image**: NO traditional hero - Admin panels lead with functionality, not imagery

**Product Thumbnails**: 
- In inventory tables (64px square)
- In edit forms (larger preview 200px)
- Grid view option: 300px cards with image prominence

**Receipt/Document Previews**:
- Thumbnail grid in expense tracker (120px)
- Full preview in modal overlay

**Empty States**:
- Illustration or icon for "No inventory items yet" states
- Call-to-action button to add first item

---

## Page Structure

**Dashboard** (Landing):
- Stats row (4 cards: Total Inventory Value, Monthly Sales, Pending Orders, Low Stock Alert)
- Recent sales table (compact, 5 rows)
- Quick actions panel (Add Product, Record Sale, Log Expense)

**Inventory Management**:
- Search + Filters bar
- Table view (default) / Grid view toggle top-right  
- Add New Item button prominent top-right
- Table columns: Thumbnail, SKU, Title, Category, Stock, Cost, Retail Price, Actions

**Supplier Price Matrix**:
- Supplier selector multi-dropdown
- Editable grid with inline updates
- Export to CSV button
- Last updated timestamp

**Expense Tracker**:
- Month selector + category filter
- Upload receipt button prominent
- List view: Receipt thumb + details + amount
- Monthly total summary top

**Forms (Modal or Dedicated Page)**:
- Breadcrumb navigation
- Form title with icon
- Field groupings: Product Info / Pricing / Inventory / Images
- Validation messaging inline
- Success confirmation toast after save