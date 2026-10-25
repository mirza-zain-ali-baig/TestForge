---
name: ExamForge AI
description: Enterprise Examination Paper Generation and Blueprint Studio
colors:
  primary: "#059669"
  primary-dark: "#10b981"
  accent: "#ecfdf5"
  neutral-bg: "#f8fafc"
  neutral-dark: "#09090b"
  card-bg: "#ffffff"
  card-dark: "#121217"
  border: "#e2e8f0"
  border-dark: "#26262f"
  text-primary: "#0f172a"
  text-muted: "#64748b"
  print-ink: "#000000"
  neutral-subtle: "#555555"
  neutral-mid: "#666666"
  neutral-light: "#888888"
  neutral-muted: "#999999"
  neutral-divider: "#cccccc"
typography:
  display:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 5vw, 2.5rem)"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "clamp(1.25rem, 3.5vw, 1.75rem)"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.05em"
  caption:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
  micro:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 600
  nano:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "9px"
    fontWeight: 600
  print-serif:
    fontFamily: "Georgia, Times New Roman, serif"
  print-sans:
    fontFamily: "Calibri, Arial, sans-serif"
rounded:
  sm: "4px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "#047857"
  card:
    backgroundColor: "{colors.card-bg}"
    rounded: "{rounded.xl}"
    padding: "16px"
---

# Design System: ExamForge AI

## Overview

**Creative North Star: "The Academic Printmaster"**

ExamForge AI is an authoritative, clean, and highly functional assessment studio designed for modern educators. The aesthetic combines the crisp precision of Swiss typographic layouts with the operational reliability of enterprise institutional software. Interfaces prioritize high scanability, tactile feedback, and seamless transitions between mobile handheld devices and desktop A4 print workflows.

Every surface is designed with clear visual hierarchy, authentic materials, and zero decorative noise. On mobile viewports, the interface behaves like a first-class native handheld utility: bottom thumb-zone navigation, single-column vertical flows, safe-area compliance, 44px minimum touch targets, and resilient typography that prevents mobile browser zooming.

**Key Characteristics:**
- Authoritative Emerald brand identity with calm Slate neutral foundations
- Mobile-first thumb ergonomics with fixed bottom navigation and adaptive sticky action drawers
- High information density without visual crowding
- True WYSIWYG paper representation with pagination parity for DOCX and PDF export
- Full dark and light theme fidelity with carefully calibrated contrast ratios (≥4.5:1)

## Colors

The color palette centers on an authoritative, institutional Emerald green paired with cool Slate neutrals, delivering high contrast, academic gravitas, and fatigue-free prolonged use.

### Primary
- **Emerald Authority** (`#059669` light / `#10b981` dark): The cornerstone accent. Applied deliberately to primary actions, active navigation states, confirmed status indicators, and brand marks.

### Secondary
- **Deep Slate Foreground** (`#0f172a` light / `#f8fafc` dark): Used for high-priority headings, question stems, and primary text to ensure absolute legibility.

### Tertiary
- **Teal Accent** (`#0d9488` light / `#14b8a6` dark): Supporting color for secondary actions, export utilities, and blueprint visualizers.

### Neutral
- **Canvas White / Deep Zinc** (`#f8fafc` background / `#ffffff` card in light; `#09090b` background / `#121217` card in dark): Structural surfaces that provide calm contrast.
- **Cool Muted Slate** (`#64748b` light / `#94a3b8` dark): Used for secondary metadata, instructions, marks tags, and helper copy.
- **Structural Border** (`#e2e8f0` light / `#26262f` dark): Subtle, crisp boundary definition.

### Named Rules
**The Emerald Restraint Rule.** Emerald is reserved for active selection, completion, and primary confirmation. No more than 10% of any viewport may be tinted green.
**The No-Gradient Text Rule.** Gradient text is forbidden. Headings and metrics derive emphasis from typographic scale and weight, not decorative color washes.

## Typography

**Display Font:** Geist Sans (fallback: system-ui, -apple-system, sans-serif)
**Body Font:** Geist Sans (fallback: system-ui, -apple-system, sans-serif)
**Label/Mono Font:** Geist Mono (fallback: ui-monospace, monospace), KaTeX for mathematical formulas

**Character:** Technical, crisp, modern, and mathematically rigorous.

### Hierarchy
- **Display** (800 weight, `clamp(1.75rem, 5vw, 2.5rem)`, 1.15 line-height): Top hero headlines and major section entrances.
- **Headline** (700 weight, `clamp(1.25rem, 3.5vw, 1.75rem)`, 1.25 line-height): Wizard steps, paper titles, and analytics titles.
- **Title** (600 weight, `1rem` / 16px, 1.4 line-height): Question headers, card titles, dialog titles.
- **Body** (400 weight, `0.875rem` / 14px, 1.5 line-height, max measure 70ch): Question text, options, instructions, and notes.
- **Label** (600 weight, `0.75rem` / 12px, tracking 0.05em): Badges, category tags, marks badges, and metadata pills.

### Named Rules
**The 16px Mobile Form Rule.** All text inputs, textareas, and select triggers on mobile must render with a base font size of 16px (`text-base sm:text-sm`) to prevent iOS Safari auto-zoom.
**The Math Weight Rule.** KaTeX math expressions inside questions must harmonize with surrounding font weights and stay strictly inline without line breaks.

## Layout

ExamForge uses a responsive multi-device layout architecture:
- **Mobile (< 768px):** Fixed bottom navigation bar (`h-14` + `safe-area-bottom`), sticky continuation bars offset by `bottom-[4.5rem]` to prevent overlay clipping, single-column vertical cards, full-width inputs, and horizontal swipeable chip strips.
- **Tablet (768px - 1024px):** 2-column cards, collapsible side panels, compact horizontal navigation.
- **Desktop (1024px+):** Full 12-column layouts, sticky sidebar summary columns, multi-column question grids, and maximum 7xl centered containers (`max-w-7xl mx-auto`).

## Elevation & Depth

Surfaces rely on subtle tonal layering and crisp 1px borders rather than exaggerated drop shadows. Depth indicates interactivity or elevated priority.

### Shadow Vocabulary
- **Subtle Surface** (`box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05)`): Default resting state for cards and list items.
- **Interactive Lift** (`box-shadow: 0 8px 24px -12px rgba(0, 0, 0, 0.15)`): Applied on card hover and active state changes.
- **Modal Overlay** (`box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2)`): Used on dialogs, drawers, and floating assistants.

### Named Rules
**The Flat-At-Rest Rule.** All cards and containers rest flat against their canvas with 1px border definition; shadows only appear to indicate active elevation or drag states.

## Shapes

- **Base Radius:** 10px (`rounded-xl`) for cards, modal dialogs, and panels.
- **Control Radius:** 8px (`rounded-lg`) for buttons, text inputs, and select triggers.
- **Pill Radius:** 9999px (`rounded-full`) for status badges, tags, and progress bars.
- **No Chamfers or Unmotivated Shapes:** All containers use consistent circular corner radii matching their internal content nesting hierarchy.

## Components

### Buttons
- **Shape:** Rounded-lg (8px) for controls, rounded-xl (10px) for prominent wizard buttons.
- **Primary:** Solid Emerald (`#059669`), white text, font-bold, `min-h-[44px]` on mobile touch.
- **Hover / Focus:** Emerald 700 (`#047857`), 2px ring with 2px offset.
- **Secondary / Outline:** 1px border (`#e2e8f0` / `#26262f`), background transparent or subtle muted tint.

### Bottom Navigation Bar (Mobile)
- **Shape:** Full width, fixed bottom, `border-t border-border`, `bg-card/95 backdrop-blur-md`.
- **Items:** 5 primary thumb-zone tabs with 48px minimum hit target, active tab highlighted with emerald tint and bold label.

### Cards / Containers
- **Shape:** 12px - 16px radius, 1px border definition, clean padding (`p-3.5` on mobile, `p-5` on desktop).

### Inputs / Fields
- **Shape:** 8px radius, border border-input, `min-h-[40px]`, `text-base sm:text-sm` for iOS compliance.

## Do's and Don'ts

### Do:
- **Do** provide at least 44x44px touch targets on all interactive mobile buttons and links.
- **Do** offset mobile sticky action bars (`bottom-[4.5rem]`) so they never hide behind the bottom navigation bar.
- **Do** use responsive typography (`text-base sm:text-sm`) on form inputs to prevent mobile browser viewport jumping.
- **Do** preserve 100% feature parity between mobile and desktop experiences.
- **Do** handle safe areas on modern mobile devices using `safe-area-bottom`.

### Don't:
- **Don't** use decorative gradient text or linear-gradient font fills.
- **Don't** add artificial background grid overlays that mimic wireframes or blueprint paper.
- **Don't** allow horizontal scroll on the viewport at any mobile screen width down to 320px.
- **Don't** place floating widgets where they obstruct primary submit buttons or sticky action bars.
- **Don't** rely on hover tooltips for essential functionality on touch devices.
