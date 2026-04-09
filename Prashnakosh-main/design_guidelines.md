# School SAFAL Question Bank Design Guidelines

## Design Approach
**Hybrid Approach**: Material Design principles for data-dense educational interfaces + custom brand identity with olive green theme and colorful interactive elements.

## Core Brand Identity
- **Primary Background**: Olive green (#708238) for all main page backgrounds
- **Card System**: White rounded cards with subtle shadows floating on olive background
- **Accent Philosophy**: Bold, colorful buttons inspired by currency coins - each action category has distinct color coding

## Typography System
- **Headings**: Bold, clear hierarchy
  - H1: 2xl-3xl for page titles
  - H2: xl-2xl for section headers
  - H3: lg-xl for card titles
- **Body**: Base-lg for readability in educational content
- **Use Tailwind units**: Primarily 2, 4, 6, 8, 12, 16, 20, 24 for consistent spacing

## Layout Architecture

### Dashboard Structure
Role-based dashboards (Teacher/Student/Parent/Admin) with:
- Top navigation bar (white card, full-width)
- Main content area (olive background)
- Grid of white rounded cards (2-3 columns on desktop, stack on mobile)
- Each card contains specific functionality with colored action buttons

### Content Cards
- White background, rounded-xl corners
- p-6 to p-8 padding
- Shadow-lg for elevation
- Grid layout: grid-cols-1 md:grid-cols-2 lg:grid-cols-3

### Forms & Data Entry
- Question upload/editor: Full-width white cards
- Multi-step workflows with progress indicators
- Inline validation with clear error states
- File upload zones with drag-drop visual feedback

## Button System (Critical - Exact Implementation)

### Coin-Style Buttons
Three variants (all with icons + text):
- **Rectangle**: Default for primary actions
- **Square**: Icon-only for toolbars
- **Round**: Floating action buttons

### Color Coding by Function:
- **Blue (#2563EB)**: Login, Create Paper, Set Deadline, View items
- **Gold (#EAB308)**: Upload Questions, Premium actions
- **Green (#16A34A)**: Unlock, Approve, Start, Success actions
- **Red (#DC2626)**: End, Delete, Lock
- **Orange/Indigo/Teal/Pink**: Specialized actions per spec

All buttons: Bold font, generous padding (px-6 py-3), hover glow effect, smooth transitions

## Component Library

### Navigation
- Horizontal tabs for role switching
- Breadcrumb trails for deep navigation
- Sidebar for admin tenant management

### Data Display
- Tables for question banks, student lists, test results
- Cards for test/chapter previews
- Progress bars for test completion
- Badges for status (Draft/Locked/Unlocked/Completed)

### Interactive Elements
- Chapter unlock manager: Timeline view with lock/unlock states
- Question parser: Split view (raw upload vs parsed preview)
- Practice zone: Topic tree navigation
- Mock exam: Full-screen timed interface with timer overlay

### Modals & Overlays
- Confirmation dialogs for critical actions (Reveal Scores, Lock Again)
- Full-screen editor for question creation
- Toast notifications (top-right) for all API responses

## Page-Specific Layouts

### Login
Centered card on olive background, school code + email + password fields, single blue login button

### Teacher Dashboard
Grid of action cards: Upload Questions, Create Paper, Unlock Chapter, View Reports, Portion Planner

### Question Upload
Two-column: File upload zone (left) + Extracted preview list (right), action buttons at top

### Chapter Unlock Manager
Vertical timeline showing all chapters with lock icons, status badges, unlock/deadline buttons per chapter

### Practice/Mock
Clean exam interface: White content area, minimal distractions, question navigation sidebar, submit button fixed bottom

### Reports
PDF preview with Download + Send to Parent buttons, score summary cards, topic-wise breakdown charts

## Accessibility
- High contrast text on olive background (use white/light text when needed)
- Clear focus states on all interactive elements
- Keyboard navigation for exam interfaces
- Screen reader labels for icon-only buttons

## Images
**Minimal decorative imagery** - This is a utility-focused platform. Use icons liberally but avoid large hero images. Focus on:
- Icon sets for subjects/topics (use Font Awesome or Material Icons)
- Small illustrations for empty states
- Avatar placeholders for students/teachers

## Responsive Behavior
- Mobile: Single column, hamburger menu, stacked cards
- Tablet: 2-column grids, collapsible sidebar
- Desktop: 3-column grids, persistent navigation