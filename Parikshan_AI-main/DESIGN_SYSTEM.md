# 🎨 Parikshan AI - Design System Documentation

## Overview
Modern, premium design system with vibrant gradients, glassmorphism effects, and smooth animations.

---

## 🎨 Color Palette

### Primary Colors
- **Primary**: Vibrant Purple (`hsl(250 90% 60%)`) - Main brand color
- **Accent**: Cyan-Teal (`hsl(180 80% 50%)`) - Secondary highlights  
- **Success**: Emerald Green (`hsl(142 76% 45%)`) - Success states
- **Warning**: Amber (`hsl(38 92% 50%)`) - Warning states
- **Destructive**: Red (`hsl(0 72% 51%)`) - Error states

### Neutral Colors
- **Background**: Soft Light Gray (`hsl(220 15% 97%)`)
- **Foreground**: Dark Gray (`hsl(222 47% 11%)`)
- **Muted**: Soft Gray (`hsl(220 14% 96%)`)
- **Border**: Light Gray (`hsl(220 13% 91%)`)

### Gradient Colors
```css
--gradient-primary: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%);
--gradient-accent: linear-gradient(135deg, #06b6d4 0%, #14b8a6 100%);
--gradient-success: linear-gradient(135deg, #10b981 0%, #34d399 100%);
--gradient-warning: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
--gradient-destructive: linear-gradient(135deg, #ef4444 0%, #f87171 100%);
```

---

## 🔤 Typography

### Fonts
- **Sans**: Inter (primary text)
- **Display**: Outfit (headings)
- **Mono**: JetBrains Mono (code)

### Font Sizes
| Size | Value | Usage |
|------|-------|-------|
| xs | 0.75rem | Small labels |
| sm | 0.875rem | Body text small |
| base | 1rem | Body text |
| lg | 1.125rem | Large text |
| xl | 1.25rem | Subheadings |
| 2xl | 1.5rem | Section headings |
| 3xl | 1.875rem | Page headings |
| 4xl+ | 2.25rem+ | Hero text |

### Font Weights
- **Regular**: 400
- **Medium**: 500
- **Semibold**: 600
- **Bold**: 700
- **Extrabold**: 800

---

## 🎯 Components

### Buttons

#### Variants
```tsx
<Button variant="default">Primary Action</Button>
<Button variant="success">Success Action</Button>
<Button variant="destructive">Delete</Button>
<Button variant="warning">Warning</Button>
<Button variant="info">Info</Button>
<Button variant="outline">Outlined</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
```

#### Sizes
```tsx
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="xl">Extra Large</Button>
<Button size="icon"><Icon /></Button>
```

#### Features
- Gradient backgrounds
- Glow effects on hover
- Smooth scale animation on click
- Shadow transitions

### Cards

```tsx
<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description text</CardDescription>
  </CardHeader>
  <CardContent>
    Card content goes here
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

#### Features
- Rounded corners (xl)
- Soft shadows
- Hover shadow elevation
- Smooth transitions

---

## ✨ Effects & Animations

### Glass Effect
```tsx
<div className="glass-card">
  Glassmorphism content
</div>
```

Creates frosted glass effect with blur and transparency.

### Gradient Text
```tsx
<h1 className="gradient-text">
  Beautiful Gradient Text
</h1>
```

### Gradient Buttons
```tsx
<button className="btn-gradient-primary">
  Primary Gradient
</button>

<button className="btn-gradient-accent">
  Accent Gradient
</button>
```

### Animations

#### Float Animation
```tsx
<div className="float-animation">
  Floating element
</div>
```

#### Glow Pulse
```tsx
<div className="glow-pulse">
  Pulsing glow effect
</div>
```

#### Shimmer Effect
```tsx
<div className="shimmer">
  Shimmer loading state
</div>
```

#### Entrance Animations
```tsx
<div className="slide-up">Slides up on mount</div>
<div className="fade-in">Fades in</div>
<div className="scale-in">Scales in</div>
```

---

## 🎭 Shadows

### Shadow Utilities
```css
shadow-soft      /* Soft, subtle shadow */
shadow-soft-lg   /* Larger soft shadow */
shadow-glow      /* Glowing shadow */
shadow-glow-sm   /* Small glow */
shadow-glow-lg   /* Large glow */
shadow-glass     /* Glass effect shadow */
```

---

## 📐 Spacing & Layout

### Border Radius
```css
rounded-sm     /* 0.25rem */
rounded-md     /* 0.5rem */
rounded-lg     /* 0.75rem */
rounded-xl     /* 1rem */
rounded-2xl    /* 1.5rem */
rounded-3xl    /* 2rem */
```

### Padding & Margins
Use Tailwind's standard spacing scale:
```tsx
p-4    /* padding: 1rem */
px-6   /* padding-x: 1.5rem */
py-8   /* padding-y: 2rem */
gap-4  /* gap: 1rem */
```

---

## 🌈 Mesh Gradient Background

The application features an automatic mesh gradient background created with radial gradients:

```css
--mesh-gradient: 
  radial-gradient(at 0% 0%, hsla(250, 90%, 60%, 0.1) 0px, transparent 50%),
  radial-gradient(at 100% 0%, hsla(180, 80%, 50%, 0.08) 0px, transparent 50%),
  radial-gradient(at 100% 100%, hsla(280, 90%, 65%, 0.1) 0px, transparent 50%),
  radial-gradient(at 0% 100%, hsla(142, 76%, 45%, 0.08) 0px, transparent 50%);
```

Applied automatically to the `body` element.

---

## 🎨 Usage Examples

### Dashboard Cards
```tsx
<Card className="hover:shadow-glow-lg transition-all">
  <CardHeader>
    <CardTitle className="gradient-text">Statistics</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      {/* Content */}
    </div>
  </CardContent>
</Card>
```

### Action Buttons
```tsx
<div className="flex gap-3">
  <Button size="lg" className="shadow-glow">
    Primary Action
  </Button>
  <Button variant="outline" size="lg">
    Secondary
  </Button>
</div>
```

### Loading States
```tsx
<div className="shimmer rounded-lg bg-muted h-20 w-full" />
```

### Status Badges
```tsx
<Badge className="bg-gradient-to-r from-green-500 to-emerald-500">
  Active
</Badge>
```

---

## 🌓 Dark Mode

The design system fully supports dark mode:

```tsx
<button onClick={() => setTheme('dark')}>
  Toggle Dark Mode
</button>
```

Dark mode automatically adjusts:
- Color values
- Shadow intensities  
- Glass effects
- Glow intensities
- Mesh gradients

---

## 🎯 Best Practices

### Do's ✅
- Use gradient buttons for primary actions
- Apply hover effects to interactive elements
- Use soft shadows for depth
- Maintain consistent spacing
- Use animations for visual feedback

### Don'ts ❌
- Don't overuse gradients
- Don't combine too many glow effects
- Don't use tiny font sizes (<12px)
- Don't ignore color contrast ratios
- Don't disable transitions unnecessarily

---

## 🚀 Component Examples

### Feature Card
```tsx
<Card className="glass-card border-2 hover:shadow-glow-lg transition-all">
  <CardHeader>
    <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center mb-4">
      <Icon className="w-6 h-6 text-white" />
    </div>
    <CardTitle>Feature Title</CardTitle>
    <CardDescription>Feature description goes here</CardDescription>
  </CardHeader>
  <CardContent>
    <ul className="space-y-2">
      <li className="flex items-center gap-2">
        <Check className="w-4 h-4 text-green-500" />
        <span>Benefit one</span>
      </li>
    </ul>
  </CardContent>
  <CardFooter>
    <Button className="w-full">Learn More</Button>
  </CardFooter>
</Card>
```

### Stats Card
```tsx
<Card className="border-l-4 border-l-primary">
  <CardContent className="pt-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-muted-foreground">Total Users</p>
        <h3 className="text-3xl font-bold mt-1 gradient-text">1,234</h3>
      </div>
      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
        <Users className="w-6 h-6 text-primary" />
      </div>
    </div>
    <div className="mt-4 flex items-center text-sm">
      <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
      <span className="text-green-500">+12.5%</span>
      <span className="text-muted-foreground ml-2">from last month</span>
    </div>
  </CardContent>
</Card>
```

---

## 📦 Installation

The design system is already configured! Just use the components:

```tsx
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
```

---

## 🎓 Design Principles

1. **Modern & Clean**: Embrace whitespace and clear hierarchy
2. **Vibrant & Professional**: Balance bold colors with sophistication
3. **Smooth Interactions**: Animate state changes naturally
4. **Accessible**: Maintain WCAG AA contrast ratios
5. **Responsive**: Mobile-first, scales beautifully
6. **Performant**: CSS-based animations, optimized for 60fps

---

## 🔄 Updates & Changelog

### Version 2.0 (Current)
- ✅ New purple-cyan gradient color scheme
- ✅ Enhanced button variants with gradients
- ✅ Glassmorphism effects
- ✅ Mesh gradient backgrounds
- ✅ Advanced animations library
- ✅ Improved shadows and depth
- ✅ Better dark mode support

---

**Design System Status**: ✅ Production Ready

For questions or suggestions, see the design team! 🎨
