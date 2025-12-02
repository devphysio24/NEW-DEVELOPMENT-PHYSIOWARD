# Frontend Design Rules & Guidelines

**Purpose:** This document outlines design standards to ensure consistent, clean, and optimized UI across all frontend pages and components. Follow these rules when creating new pages, components, or styles.

**Last Updated:** 2024

---

## 📋 Table of Contents

1. [Design System Overview](#design-system-overview)
2. [Color System](#color-system)
3. [Typography](#typography)
4. [Spacing System](#spacing-system)
5. [Component Patterns](#component-patterns)
6. [Layout Standards](#layout-standards)
7. [CSS Organization](#css-organization)
8. [Responsive Design](#responsive-design)
9. [Animations & Transitions](#animations--transitions)
10. [Icons & Images](#icons--images)
11. [Before Creating New Design Checklist](#before-creating-new-design-checklist)
12. [Common Patterns & Examples](#common-patterns--examples)

---

## 🎨 Design System Overview

### Core Principles

1. **Consistency First**: Use standardized colors, spacing, and components
2. **Clean & Minimal**: Avoid unnecessary visual clutter
3. **Accessibility**: Ensure sufficient contrast and readable text
4. **Performance**: Optimize CSS, avoid heavy animations
5. **Mobile-First**: Design for mobile, enhance for desktop

### Design Tokens

All design values should use standardized tokens (colors, spacing, typography) defined in this document.

---

## 🎨 Color System

### Primary Colors

**✅ ALWAYS use these color values:**

```css
/* Text Colors */
--color-text-primary: #0F172A;      /* Main text, headings */
--color-text-secondary: #64748B;    /* Secondary text, labels */
--color-text-tertiary: #94A3B8;     /* Tertiary text, placeholders */
--color-text-inverse: #FFFFFF;        /* Text on dark backgrounds */

/* Background Colors */
--color-bg-primary: #FFFFFF;         /* Main background */
--color-bg-secondary: #F8FAFC;      /* Secondary background, cards */
--color-bg-tertiary: #F1F5F9;        /* Tertiary background, hover states */
--color-bg-dark: #0F172A;            /* Dark backgrounds */

/* Border Colors */
--color-border-light: #E2E8F0;       /* Default borders */
--color-border-medium: #CBD5E1;      /* Hover borders */
--color-border-dark: #94A3B8;         /* Active borders */

/* Primary Action Colors */
--color-primary: #3B82F6;            /* Primary buttons, links */
--color-primary-hover: #2563EB;      /* Primary hover state */
--color-primary-dark: #1E40AF;        /* Primary active state */

/* Status Colors */
--color-success: #10B981;             /* Success states */
--color-success-bg: #D1FAE5;          /* Success backgrounds */
--color-error: #EF4444;                /* Error states */
--color-error-bg: #FEE2E2;            /* Error backgrounds */
--color-warning: #F59E0B;             /* Warning states */
--color-warning-bg: #FEF3C7;           /* Warning backgrounds */
--color-info: #3B82F6;                /* Info states */
--color-info-bg: #DBEAFE;              /* Info backgrounds */
```

### Color Usage Rules

**✅ DO:**
- Use `#0F172A` for primary text and headings
- Use `#64748B` for secondary text and labels
- Use `#E2E8F0` for borders
- Use `#3B82F6` for primary actions
- Use `#FFFFFF` for card backgrounds

**❌ DON'T:**
- Create new color values without adding to design system
- Use colors that don't match the palette
- Use low contrast combinations (text must be readable)

### Example Usage

```css
/* ✅ GOOD: Using standard colors */
.page-title {
  color: #0F172A;
  font-size: 28px;
  font-weight: 600;
}

.page-subtitle {
  color: #64748B;
  font-size: 14px;
}

.card {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
}

/* ❌ BAD: Using arbitrary colors */
.page-title {
  color: #333333;  /* Not in design system */
}
```

---

## 📝 Typography

### Font Family

**✅ Standard font stack:**

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Inter', 
             'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
```

### Font Sizes

**✅ Standard font sizes:**

```css
/* Headings */
--font-size-h1: 32px;        /* Page titles */
--font-size-h2: 28px;        /* Section titles */
--font-size-h3: 24px;        /* Subsection titles */
--font-size-h4: 20px;        /* Card titles */
--font-size-h5: 18px;        /* Small headings */

/* Body Text */
--font-size-body-large: 16px;    /* Large body text */
--font-size-body: 15px;           /* Default body text */
--font-size-body-small: 14px;    /* Small body text */
--font-size-caption: 13px;        /* Captions, labels */
--font-size-tiny: 12px;           /* Tiny text, badges */
--font-size-micro: 11px;          /* Micro text, group headers */
```

### Font Weights

**✅ Standard font weights:**

```css
--font-weight-normal: 400;    /* Body text */
--font-weight-medium: 500;   /* Labels, buttons */
--font-weight-semibold: 600; /* Headings, emphasis */
--font-weight-bold: 700;      /* Strong emphasis */
```

### Typography Patterns

**✅ Standard text patterns:**

```css
/* Page Title */
.page-title {
  font-size: 28px;
  font-weight: 600;
  color: #0F172A;
  margin: 0 0 4px 0;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

/* Page Subtitle */
.page-subtitle {
  font-size: 14px;
  color: #64748B;
  margin: 0;
  font-weight: 400;
}

/* Section Title */
.section-title {
  font-size: 20px;
  font-weight: 600;
  color: #0F172A;
  margin: 0 0 4px 0;
}

/* Section Subtitle */
.section-subtitle {
  font-size: 13px;
  color: #64748B;
  margin: 0;
}

/* Body Text */
.body-text {
  font-size: 15px;
  color: #0F172A;
  line-height: 1.6;
}

/* Label */
.label {
  font-size: 13px;
  color: #64748B;
  font-weight: 500;
  margin: 0 0 6px 0;
}
```

---

## 📏 Spacing System

### Spacing Scale

**✅ Use 4px base unit (all spacing should be multiples of 4px):**

```css
--spacing-xs: 4px;      /* Tiny gaps */
--spacing-sm: 8px;      /* Small gaps */
--spacing-md: 12px;    /* Medium gaps */
--spacing-lg: 16px;     /* Large gaps */
--spacing-xl: 20px;     /* Extra large gaps */
--spacing-2xl: 24px;    /* 2x large gaps */
--spacing-3xl: 32px;    /* 3x large gaps */
--spacing-4xl: 40px;    /* 4x large gaps */
--spacing-5xl: 48px;    /* 5x large gaps */
```

### Spacing Usage

**✅ Standard spacing patterns:**

```css
/* Page Padding */
.page-container {
  padding: 24px;              /* Standard page padding */
  max-width: 1200px;         /* Or 1600px for wide pages */
  margin: 0 auto;
}

/* Card Padding */
.card {
  padding: 20px;             /* Standard card padding */
  /* or */
  padding: 24px;              /* Large card padding */
}

/* Section Spacing */
.section {
  margin-bottom: 32px;        /* Standard section spacing */
}

/* Element Gaps */
.element-group {
  display: flex;
  gap: 12px;                  /* Standard gap between elements */
  /* or */
  gap: 16px;                  /* Large gap */
  /* or */
  gap: 8px;                   /* Small gap */
}

/* Header Spacing */
.page-header {
  margin-bottom: 24px;        /* Standard header spacing */
  padding-bottom: 20px;
  border-bottom: 1px solid #E2E8F0;
}
```

---

## 🧩 Component Patterns

### Buttons

**✅ Standard button patterns:**

```css
/* Primary Button */
.btn-primary {
  padding: 10px 20px;
  background: #3B82F6;
  color: #FFFFFF;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  letter-spacing: -0.01em;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.btn-primary:hover:not(:disabled) {
  background: #2563EB;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.btn-primary:active:not(:disabled) {
  transform: translateY(0);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* Secondary Button */
.btn-secondary {
  padding: 10px 20px;
  background: #FFFFFF;
  color: #64748B;
  border: 1.5px solid #E2E8F0;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-secondary:hover:not(:disabled) {
  background: #F8FAFC;
  border-color: #CBD5E1;
  color: #475569;
}

/* Button Sizes */
.btn-small {
  padding: 8px 16px;
  font-size: 13px;
}

.btn-large {
  padding: 12px 24px;
  font-size: 15px;
}
```

### Cards

**✅ Standard card patterns:**

```css
/* Standard Card */
.card {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  padding: 24px;
  transition: all 0.15s ease;
}

.card:hover {
  border-color: #CBD5E1;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

/* Card Header */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #E2E8F0;
}

.card-title {
  font-size: 20px;
  font-weight: 600;
  color: #0F172A;
  margin: 0 0 4px 0;
}

.card-subtitle {
  font-size: 13px;
  color: #64748B;
  margin: 0;
}
```

### Input Fields

**✅ Standard input patterns:**

```css
/* Input Container */
.input-group {
  position: relative;
  margin-bottom: 16px;
}

/* Input Label */
.input-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #64748B;
  margin: 0 0 6px 0;
}

/* Input Field */
.input {
  width: 100%;
  padding: 14px 16px;
  font-size: 14px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  background: #FFFFFF;
  transition: all 0.2s ease;
  box-sizing: border-box;
  color: #0F172A;
}

.input:focus {
  outline: none;
  border-color: #3B82F6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.input::placeholder {
  color: #94A3B8;
}

.input:disabled {
  background: #F8FAFC;
  cursor: not-allowed;
  opacity: 0.6;
}

/* Input Error State */
.input.error {
  border-color: #EF4444;
}

.input-error-message {
  font-size: 12px;
  color: #EF4444;
  margin-top: 4px;
}
```

### Badges & Tags

**✅ Standard badge patterns:**

```css
/* Badge */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

/* Badge Variants */
.badge-primary {
  background: #DBEAFE;
  color: #1E40AF;
}

.badge-success {
  background: #D1FAE5;
  color: #059669;
}

.badge-error {
  background: #FEE2E2;
  color: #DC2626;
}

.badge-warning {
  background: #FEF3C7;
  color: #D97706;
}

.badge-neutral {
  background: #F1F5F9;
  color: #475569;
}
```

### Tables

**✅ Standard table patterns:**

```css
.table-container {
  overflow-x: auto;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
}

.table {
  width: 100%;
  border-collapse: collapse;
  background: #FFFFFF;
}

.table th {
  padding: 12px 16px;
  text-align: left;
  font-size: 13px;
  font-weight: 600;
  color: #64748B;
  background: #F8FAFC;
  border-bottom: 1px solid #E2E8F0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.table td {
  padding: 12px 16px;
  font-size: 14px;
  color: #0F172A;
  border-bottom: 1px solid #E2E8F0;
}

.table tr:hover {
  background: #F8FAFC;
}

.table tr:last-child td {
  border-bottom: none;
}
```

---

## 📐 Layout Standards

### Page Structure

**✅ Standard page layout:**

```css
.page-container {
  padding: 24px;
  max-width: 1200px;        /* Standard width */
  /* or */
  max-width: 1600px;         /* Wide pages (dashboards) */
  margin: 0 auto;
  min-height: calc(100vh - 64px);
  background: #FFFFFF;
}

/* Page Header */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid #E2E8F0;
}

.page-title {
  font-size: 28px;
  font-weight: 600;
  color: #0F172A;
  margin: 0 0 6px 0;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.page-subtitle {
  font-size: 15px;
  color: #64748B;
  margin: 0;
  font-weight: 500;
}
```

### Grid Layouts

**✅ Standard grid patterns:**

```css
/* Card Grid */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

/* Two Column Layout */
.two-column {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

/* Three Column Layout */
.three-column {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}
```

### Section Spacing

**✅ Standard section patterns:**

```css
.section {
  margin-bottom: 32px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.section-title {
  font-size: 20px;
  font-weight: 600;
  color: #0F172A;
  margin: 0 0 4px 0;
}

.section-subtitle {
  font-size: 13px;
  color: #64748B;
  margin: 0;
}
```

---

## 📁 CSS Organization

### File Naming

**✅ DO:**
- Use **component name** for CSS files: `ComponentName.css`
- Match CSS file name to component file name
- Use **kebab-case**: `clinician-dashboard.css`

**Example:**
```
ComponentName.tsx → ComponentName.css
ClinicianDashboard.tsx → ClinicianDashboard.css
```

### CSS Structure

**✅ Organize CSS in this order:**

```css
/* 1. Container/Page Styles */
.page-container { }

/* 2. Header Styles */
.page-header { }
.page-title { }

/* 3. Section Styles */
.section { }

/* 4. Card Styles */
.card { }

/* 5. Form/Input Styles */
.input-group { }

/* 6. Button Styles */
.btn { }

/* 7. Table Styles */
.table { }

/* 8. Utility Classes */
.loading { }
.error { }

/* 9. Responsive Styles */
@media (max-width: 768px) { }
```

### CSS Class Naming

**✅ Use BEM-like naming convention:**

```css
/* Block */
.page-container { }

/* Block Element */
.page-header { }
.page-title { }
.page-subtitle { }

/* Block Modifier */
.btn-primary { }
.btn-secondary { }
.btn-small { }

/* Element Modifier */
.card-header-large { }
```

### CSS Variables

**✅ Use CSS variables for repeated values:**

```css
:root {
  --page-max-width: 1200px;
  --card-padding: 24px;
  --border-radius: 8px;
  --transition-speed: 0.2s;
}

.page-container {
  max-width: var(--page-max-width);
}

.card {
  padding: var(--card-padding);
  border-radius: var(--border-radius);
}
```

---

## 📱 Responsive Design

### Breakpoints

**✅ Standard breakpoints:**

```css
/* Mobile */
@media (max-width: 768px) {
  .page-container {
    padding: 16px;
  }
  
  .card-grid {
    grid-template-columns: 1fr;
  }
  
  .two-column {
    grid-template-columns: 1fr;
  }
}

/* Tablet */
@media (min-width: 769px) and (max-width: 1024px) {
  .card-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Desktop */
@media (min-width: 1025px) {
  /* Desktop styles */
}
```

### Mobile-First Approach

**✅ DO:**
- Design for mobile first
- Use `min-width` media queries
- Test on mobile devices

**Example:**
```css
/* Mobile (default) */
.page-container {
  padding: 16px;
}

/* Tablet and up */
@media (min-width: 769px) {
  .page-container {
    padding: 24px;
  }
}
```

---

## 🎬 Animations & Transitions

### Transition Standards

**✅ Standard transition values:**

```css
/* Fast transitions */
transition: all 0.15s ease;

/* Standard transitions */
transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

/* Slow transitions */
transition: all 0.3s ease;
```

### Common Transitions

**✅ Standard transition patterns:**

```css
/* Button hover */
.btn {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.btn:active {
  transform: translateY(0);
}

/* Card hover */
.card {
  transition: all 0.15s ease;
}

.card:hover {
  border-color: #CBD5E1;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

/* Input focus */
.input {
  transition: all 0.2s ease;
}

.input:focus {
  border-color: #3B82F6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}
```

### Animation Rules

**✅ DO:**
- Keep animations subtle and fast (0.15s - 0.3s)
- Use `transform` and `opacity` for performance
- Avoid animating `width`, `height`, `margin`, `padding`

**❌ DON'T:**
- Use heavy animations that slow down the page
- Animate too many properties at once
- Use animations that distract from content

---

## 🎨 Icons & Images

### Icons

**✅ Icon standards:**

```css
/* Icon sizes */
.icon-small { width: 16px; height: 16px; }
.icon-medium { width: 20px; height: 20px; }
.icon-large { width: 24px; height: 24px; }

/* Icon colors */
.icon-primary { color: #3B82F6; }
.icon-secondary { color: #64748B; }
.icon-success { color: #10B981; }
```

---

## 📄 Before Creating New Design Checklist

1. **Design System Check:**
   - Does the new design follow the established color, spacing, and typography patterns?
   - Are all components and states covered by existing patterns?
   - Are there any new color values or typography scales needed?

2. **Accessibility Check:**
   - Does the new design meet WCAG 2.1 AA contrast requirements?
   - Are all text elements easily readable?
   - Are interactive elements clearly distinguishable?

3. **Performance Check:**
   - Are CSS files optimized for performance?
   - Are heavy animations avoided?
   - Are CSS variables used for repeated values?

4. **Responsive Check:**
   - Does the new design look good on all screen sizes?
   - Are mobile-first considerations met?
   - Are breakpoints correctly defined?

5. **Consistency Check:**
   - Does the new design maintain the overall design language?
   - Are there any conflicting styles?
   - Are all components and layouts consistent?

---

## 📚 Common Patterns & Examples

### Button Patterns

```css
/* Primary Button */
.btn-primary {
  padding: 10px 20px;
  background: #3B82F6;
  color: #FFFFFF;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  letter-spacing: -0.01em;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.btn-primary:hover:not(:disabled) {
  background: #2563EB;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.btn-primary:active:not(:disabled) {
  transform: translateY(0);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* Secondary Button */
.btn-secondary {
  padding: 10px 20px;
  background: #FFFFFF;
  color: #64748B;
  border: 1.5px solid #E2E8F0;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-secondary:hover:not(:disabled) {
  background: #F8FAFC;
  border-color: #CBD5E1;
  color: #475569;
}

/* Button Sizes */
.btn-small {
  padding: 8px 16px;
  font-size: 13px;
}

.btn-large {
  padding: 12px 24px;
  font-size: 15px;
}
```

### Card Patterns

```css
/* Standard Card */
.card {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  padding: 24px;
  transition: all 0.15s ease;
}

.card:hover {
  border-color: #CBD5E1;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

/* Card Header */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #E2E8F0;
}

.card-title {
  font-size: 20px;
  font-weight: 600;
  color: #0F172A;
  margin: 0 0 4px 0;
}

.card-subtitle {
  font-size: 13px;
  color: #64748B;
  margin: 0;
}
```

### Input Field Patterns

```css
/* Input Container */
.input-group {
  position: relative;
  margin-bottom: 16px;
}

/* Input Label */
.input-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #64748B;
  margin: 0 0 6px 0;
}

/* Input Field */
.input {
  width: 100%;
  padding: 14px 16px;
  font-size: 14px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  background: #FFFFFF;
  transition: all 0.2s ease;
  box-sizing: border-box;
  color: #0F172A;
}

.input:focus {
  outline: none;
  border-color: #3B82F6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.input::placeholder {
  color: #94A3B8;
}

.input:disabled {
  background: #F8FAFC;
  cursor: not-allowed;
  opacity: 0.6;
}

/* Input Error State */
.input.error {
  border-color: #EF4444;
}

.input-error-message {
  font-size: 12px;
  color: #EF4444;
  margin-top: 4px;
}
```

### Badge & Tag Patterns

```css
/* Badge */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

/* Badge Variants */
.badge-primary {
  background: #DBEAFE;
  color: #1E40AF;
}

.badge-success {
  background: #D1FAE5;
  color: #059669;
}

.badge-error {
  background: #FEE2E2;
  color: #DC2626;
}

.badge-warning {
  background: #FEF3C7;
  color: #D97706;
}

.badge-neutral {
  background: #F1F5F9;
  color: #475569;
}
```

### Table Patterns

```css
.table-container {
  overflow-x: auto;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
}

.table {
  width: 100%;
  border-collapse: collapse;
  background: #FFFFFF;
}

.table th {
  padding: 12px 16px;
  text-align: left;
  font-size: 13px;
  font-weight: 600;
  color: #64748B;
  background: #F8FAFC;
  border-bottom: 1px solid #E2E8F0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.table td {
  padding: 12px 16px;
  font-size: 14px;
  color: #0F172A;
  border-bottom: 1px solid #E2E8F0;
}

.table tr:hover {
  background: #F8FAFC;
}

.table tr:last-child td {
  border-bottom: none;
}
```
