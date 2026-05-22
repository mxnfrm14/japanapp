# 幸 日本語 - Design System Guidelines

This document defines the design system for our Japanese language learning application. These guidelines ensure consistency across all features and provide a cohesive, elegant user experience.

---

## Color System

### Brand Colors
Our primary accent color is a deep Japanese red that embodies elegance and tradition:

- **Primary Accent**: `--accent-red: #8f0020` (Deep Japanese Red)
- **Accent Light**: `--accent-red-light: #b91437` (Lighter Red for gradients)
- Use these colors for:
  - Active states in navigation
  - Primary action buttons
  - Important highlights
  - Brand elements (logo, AI Chat emphasis)
  - Mastered/completed states

### Background Colors
- **Primary Background**: `--bg-primary: #f6f6f6` (Light gray, main app background)
- **Secondary Background**: `--bg-secondary: #eee` (Medium gray, elevated surfaces)
- **Card Background**: `--bg-card: #ffffff` (Pure white for content cards)
- **Hover State**: `--bg-hover: #f3f3f3` (Subtle hover feedback)

### Text Colors
- **Primary Text**: `--text-primary: #1c1c1c` (Nearly black, main content)
- **Secondary Text**: `--text-secondary: #828383` (Gray, supporting text)

### Border & Dividers
- **Border**: `--border-color: #e5e5e5` (Subtle borders and dividers)

### Dark Mode
Dark mode variants exist for all colors. The system automatically applies them when `.dark` class is present.

**Color Usage Rules**:
- Never hardcode colors - always use CSS variables
- Use accent red sparingly for emphasis and importance
- Gradients should always use `linear-gradient(to right, var(--accent-red), var(--accent-red-light))`
- For subtle accent hints, use `color-mix(in srgb, var(--accent-red) 10%, transparent)`

---

## Typography

### Font Families
The app uses three primary font families:

1. **Plus Jakarta Sans** (Bold/SemiBold): Headings and important UI elements
   - Example: `font-['Plus_Jakarta_Sans:Bold',sans-serif]`
   - Use for: Page titles, section headers, emphasis

2. **Work Sans** (Regular/Medium/SemiBold): Body text and UI labels
   - Example: `font-['Work_Sans:Medium',sans-serif]`
   - Use for: Buttons, labels, supporting text

3. **Noto Sans JP** (Regular/Medium/Bold): All Japanese text
   - Example: `font-['Noto_Sans_JP:Bold',sans-serif]`
   - Use for: Japanese characters, hiragana, katakana, kanji
   - **CRITICAL**: Always include Japanese fonts when displaying Japanese characters

### Font Size Scale (Responsive)
- **Mobile**: text-2xl (h1), text-xl (h2), text-base (body)
- **Tablet**: text-3xl (h1), text-2xl (h2), text-lg (body)
- **Desktop**: text-4xl (h1), text-2xl+ (h2), text-lg (body)

**Typography Rules**:
- Always pair English and Japanese fonts: `font-['Work_Sans:Medium','Noto_Sans_JP:Medium',sans-serif]`
- Japanese text should be larger than Latin text for readability
- Use font-bold (700) for primary Japanese characters
- Romaji (romanized Japanese) should be smaller and secondary in color

---

## Layout & Spacing

### Responsive Breakpoints
- **Mobile**: < 768px (md)
- **Tablet**: 768px - 1024px (md - lg)
- **Desktop**: ≥ 1024px (lg+)

### Navigation Structure

#### Desktop (lg+)
- **Sidebar**: Fixed left, 200px (tablet) to 256px (desktop) wide
- **Top Bar**: Fixed, contains search, notifications, profile
- **Main Content**: Left margin of sidebar width, top margin for header

#### Mobile (< md)
- **Top Bar**: Logo center, essential controls (notifications, profile)
- **Bottom Navigation**: Fixed, 5 items centered
  - Order: Home, Flashcards, AI (emphasized), Alphabet (menu), User
  - AI Chat is elevated with gradient background and larger icon
- **Main Content**: Full width with bottom padding for nav bar

### Container & Content Spacing
- **Page Container**: `space-y-6 md:space-y-8` (vertical spacing between sections)
- **Card Padding**: `p-4 md:p-6 lg:p-8` (responsive padding)
- **Section Gaps**: `gap-4 md:gap-6` (spacing between items)
- **Component Gaps**: `gap-2 md:gap-3` (tight spacing)

**Layout Rules**:
- Mobile-first responsive design
- Content should breathe - avoid cramped layouts
- Cards and sections need clear separation
- Use `max-w-4xl` or `max-w-7xl` for wide content centering

---

## Border Radius

### Standard Radii
- **Small elements**: `rounded-lg` (8px) - badges, small buttons
- **Medium elements**: `rounded-xl` (12px) - buttons, inputs, cards
- **Large containers**: `rounded-2xl` (16px) - major sections, modals

**Radius Rules**:
- Consistency is key - use the same radius for similar elements
- Larger containers get larger radii
- Never use sharp corners (rounded-none) unless intentional (borders, dividers)

---

## Components

### Buttons

#### Primary Button (Accent Red)
```tsx
<button className="px-6 py-3 rounded-xl text-white hover:shadow-lg transition-all"
  style={{ background: 'linear-gradient(to right, var(--accent-red), var(--accent-red-light))' }}>
  Action Text
</button>
```
- Use for: Primary actions, CTAs, important flows

#### Secondary Button
```tsx
<button className="px-6 py-3 rounded-xl transition-colors"
  style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}>
  Action Text
</button>
```
- Use for: Secondary actions, cancel buttons, supporting actions

#### Icon Button
```tsx
<button className="p-3 rounded-xl transition-colors"
  style={{ backgroundColor: 'var(--bg-secondary)' }}>
  <Icon className="size-5" />
</button>
```
- Use for: Toolbar actions, quick actions, icon-only interactions

### Cards

#### Standard Card
```tsx
<div className="rounded-xl md:rounded-2xl p-4 md:p-6 lg:p-8 shadow-sm"
  style={{ backgroundColor: 'var(--bg-card)' }}>
  {/* Content */}
</div>
```

#### Interactive Card (Hover)
```tsx
<div className="rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
  style={{ backgroundColor: 'var(--bg-card)' }}>
  {/* Content */}
</div>
```

### Navigation Links

#### Sidebar Link (Active State)
```tsx
<Link className={`flex gap-2 items-center px-3 py-2 rounded-xl ${isActive ? 'shadow-sm' : ''}`}
  style={{ backgroundColor: isActive ? 'var(--bg-card)' : 'transparent' }}>
  <Icon className="size-5" style={{ color: isActive ? 'var(--accent-red)' : 'var(--text-primary)' }} />
  <span style={{ color: isActive ? 'var(--accent-red)' : 'var(--text-primary)' }}>Label</span>
</Link>
```

### Input Fields

#### Search Bar
```tsx
<div className="flex items-center gap-3 px-4 py-3 rounded-xl"
  style={{ backgroundColor: 'var(--bg-card)' }}>
  <Search className="size-5" style={{ color: 'var(--text-secondary)' }} />
  <input
    type="text"
    placeholder="Search anything"
    className="flex-1 bg-transparent outline-none"
    style={{ color: 'var(--text-primary)' }}
  />
</div>
```

### Toggle Switches
```tsx
<button
  className="relative w-12 h-6 rounded-full transition-colors"
  style={{ backgroundColor: isOn ? 'var(--accent-red)' : '#d1d5db' }}>
  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
    isOn ? 'translate-x-6' : 'translate-x-0'
  }`} />
</button>
```

---

## Interaction & Animation

### Transitions
- **Standard**: `transition-colors` or `transition-all` (200-300ms)
- **Hover states**: Always provide visual feedback
- **Shadows**: `hover:shadow-md` or `hover:shadow-lg`
- **Scale**: Subtle scale on click for buttons

### Interactive States
1. **Default**: Base styles applied
2. **Hover**: Lighter/darker background, shadow increase
3. **Active**: Accent red color, filled background, bold text
4. **Disabled**: Reduced opacity, cursor-not-allowed

**Animation Rules**:
- Keep animations subtle and smooth
- Use `animate-pulse` sparingly for important indicators (AI badge)
- Transitions should feel instant but polished
- Never animate layout shifts

---

## Responsive Design Patterns

### Grid Layouts
```tsx
// 1 column mobile, 2 tablet, 4 desktop
<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">

// 1 column mobile, 3 desktop
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">

// 2 columns mobile, expand on desktop
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <div className="lg:col-span-2">{/* Main content */}</div>
  <div>{/* Sidebar */}</div>
</div>
```

### Text Sizing
```tsx
// Responsive headings
<h1 className="text-2xl md:text-3xl lg:text-4xl">

// Responsive body text
<p className="text-sm md:text-base lg:text-lg">

// Responsive spacing
<div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6 lg:space-y-8">
```

### Visibility Control
```tsx
// Hide on mobile, show on desktop
<div className="hidden lg:block">

// Show on mobile, hide on desktop
<div className="lg:hidden">

// Different layouts per breakpoint
<div className="flex-col lg:flex-row">
```

---

## Japanese Learning-Specific Guidelines

### Character Display
- **Large Display (Detail Pages)**: text-7xl to text-8xl for main character
- **Grid Items**: text-2xl for characters in lists/grids
- **Reading (Furigana)**: text-xs to text-sm, secondary color
- **Romaji**: text-xs, lowest hierarchy

### Japanese Charts (Kana/Kanji)
- **Mobile**: Horizontal rows, left to right, compact (w-20 h-20)
- **Desktop**: Can use traditional vertical columns (right to left) with more space (w-24 h-24)
- **Spacing**: gap-2 mobile, gap-4 tablet, gap-6 desktop
- Allow breathing room for study materials

### Status Indicators
- **Mastered**: Accent red fill with checkmark
- **In Progress**: Outlined in accent red
- **Not Started**: Neutral background

### Audio/Pronunciation Buttons
- Always include volume icon
- Use accent red for icon color
- Place prominently near character displays

---

## Special Components

### AI Chat Emphasis
The AI Chat feature is highlighted throughout the app:
- **Gradient background**: Uses both accent colors
- **Filled Sparkles icon**: With animated pulse indicator
- **Elevated position**: Center in bottom nav on mobile
- **Larger touch target**: More prominent than other nav items

### Bottom Navigation (Mobile)
- **5 items**: Home, Flashcards, AI (center), Alphabet (dropdown), User
- **Center emphasis**: AI Chat is raised and colorful
- **Safe area support**: Uses `safe-area-bottom` class for notch support
- **Backdrop blur**: `backdrop-blur-xl` with semi-transparent background

### Search Bar
- **Desktop**: Always visible in top navigation
- **Mobile/Tablet**: Shown on home screen below welcome section
- Includes keyboard shortcut indicator (⌘K)

---

## Accessibility & Best Practices

### Touch Targets
- **Minimum size**: 44x44px (w-11 h-11) for all interactive elements
- **Mobile buttons**: Larger padding than desktop
- **Bottom nav icons**: size-7 for center (AI), size-5 for others

### Safe Areas
- Apply `safe-area-bottom` class to bottom navigation
- Account for notches and home indicators on mobile devices

### Color Contrast
- All text meets WCAG AA standards
- Primary text on white: #1c1c1c on #ffffff
- Accent red used intentionally for visibility

### Loading & Empty States
- Use consistent placeholder patterns
- Provide clear feedback for async actions
- Empty states should guide users to take action

---

## Code Organization

### File Structure
```
src/
  app/
    components/
      Layout.tsx          # Main layout with sidebar/bottom nav
      BottomNav.tsx       # Mobile bottom navigation
      [Feature]/*.tsx     # Feature-specific components
    pages/
      Home.tsx            # Dashboard
      Kana.tsx            # Hiragana/Katakana
      Kanji.tsx           # Kanji learning
      Vocabulary.tsx      # Vocabulary lists
      Flashcards.tsx      # Flashcard practice
      AIChat.tsx          # AI conversation tutor
      Settings.tsx        # App settings
    contexts/
      ThemeContext.tsx    # Dark mode toggle
  styles/
    globals.css           # Color variables, utilities
    theme.css             # Tailwind theme configuration
    fonts.css             # Font imports
```

### Component Patterns
- Extract repeated components into `/components`
- Use inline styles for CSS variable references
- Keep responsive breakpoints consistent (md, lg)
- Prefer composition over prop drilling

---

## Don'ts

❌ **Never**:
- Hardcode colors - always use CSS variables
- Mix font families incorrectly (missing Japanese fonts)
- Forget responsive breakpoints for layout changes
- Use inconsistent border radii
- Skip hover states on interactive elements
- Override accent red with arbitrary colors
- Create layouts without mobile consideration first
- Use absolute positioning without responsive fallbacks
- Ignore dark mode color variants
- Apply animations without user benefit

---

## Summary Checklist

When creating new features, ensure:
- ✅ Colors use CSS variables from globals.css
- ✅ Typography includes Japanese font support
- ✅ Layout is mobile-first responsive (sm, md, lg breakpoints)
- ✅ Border radius follows standard scale (lg, xl, 2xl)
- ✅ Buttons have appropriate hover/active states
- ✅ Interactive elements meet 44px minimum touch target
- ✅ Spacing is consistent with existing patterns
- ✅ Accent red used purposefully for emphasis
- ✅ Dark mode variants considered
- ✅ Component matches existing design system style

---

*Last Updated: Built through iterative design sessions focusing on Japanese language learning, responsive mobile-first design, and elegant user experience.*
