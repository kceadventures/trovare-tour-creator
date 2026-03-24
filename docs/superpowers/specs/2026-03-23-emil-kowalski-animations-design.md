# Emil Kowalski-Style Animations Design

Add spring-based, Emil Kowalski-style animations throughout all shadcn components and screen transitions using `motion/react`.

## Library

**motion/react** (~16kb gzipped) — Emil Kowalski's own animation library. Provides spring physics, layout animations, AnimatePresence exit animations, and gesture support. Import only what's needed: `import { motion, AnimatePresence, useReducedMotion } from "motion/react"`.

## Shared Spring Configs

Defined in `lib/motion.ts`:

```ts
import { useReducedMotion } from "motion/react"

export const spring = {
  snappy: { type: "spring", stiffness: 400, damping: 25 } as const,  // buttons, badges
  smooth: { type: "spring", stiffness: 300, damping: 30 } as const,  // screens, cards, dialogs
  gentle: { type: "spring", stiffness: 200, damping: 24 } as const,  // staggered lists
  exit:   { type: "spring", stiffness: 300, damping: 35 } as const,  // faster exits (dialogs, selects)
}

// Reusable stagger variants for parent/child patterns
export const staggerContainer = (staggerMs = 0.04) => ({
  hidden: {},
  show: { transition: { staggerChildren: staggerMs } },
})

export const staggerChild = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
}

// Hook: returns spring configs that respect prefers-reduced-motion
export function useSpring() {
  const reduced = useReducedMotion()
  if (reduced) {
    const instant = { duration: 0 }
    return {
      snappy: instant, smooth: instant, gentle: instant, exit: instant,
    }
  }
  return spring
}
```

## Base-UI Integration Pattern

All shadcn components use Base-UI primitives (`@base-ui/react`), which accept a `render` prop for custom element rendering. To integrate Motion:

```tsx
// Pattern: use Base-UI's render prop to swap in a motion element
<ButtonPrimitive
  render={
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={spring.snappy}
    />
  }
/>
```

For components that use `useRender` (like Badge), wrap the outer element in `motion()`:

```tsx
// Badge uses useRender — wrap the rendered element
const MotionSpan = motion.create("span")
// Then use MotionSpan in the render function
```

**Existing CSS animations must be removed** from Dialog, Select, and Dropdown components. Their `data-open:animate-in`, `data-closed:animate-out`, `fade-in-0`, `zoom-in-95` etc. classes will conflict with Motion springs. Strip these Tailwind animation classes and replace with Motion props.

## Convention Update

The CLAUDE.md convention states `components/ui/` are "auto-generated, don't edit manually." For this work, we are intentionally modifying shadcn components to add Motion integration. This is a one-time enhancement — future shadcn updates should preserve the motion wrappers. The CLAUDE.md should be updated to note: "shadcn components have been customized with motion/react animations — re-generating will overwrite these."

## Screen Transitions

Wrap each screen in `AnimatePresence mode="wait"` with `motion.div`:
- **Enter:** `opacity: 0 → 1`, `y: 8 → 0`, smooth spring
- **Exit:** `opacity: 1 → 0`, `y: 0 → 4`, exit spring
- Applied in `app/page.tsx` around the screen switch logic
- Key each screen by its name for proper exit/enter sequencing
- Use `initial={false}` on first render to avoid animating on hydration

## Component Animations

### Button (`components/ui/button.tsx`)
- Use Base-UI `render` prop to render `motion.button`
- **Hover:** `scale: 1.02`, snappy spring
- **Tap/Press:** `scale: 0.97`, instant feel
- Focus ring: CSS transition on opacity (no Motion needed)

### Card (`components/ui/card.tsx`)
- **Hover:** `y: -2` + increased `boxShadow`, smooth spring via CSS transitions (no Motion import needed — keep card lightweight)
- Staggered mount animation handled at usage sites via `motion.div` wrappers, not in the component itself

### Dialog (`components/ui/dialog.tsx`)
- **Remove** existing `data-open`/`data-closed` CSS animation classes from overlay and content
- **Overlay:** `motion.div` with `opacity: 0 → 1`, duration 200ms
- **Content:** `motion.div` with `scale: 0.95 → 1`, `opacity: 0 → 1`, smooth spring
- **Exit:** reverse with exit spring config
- Backdrop blur animates via CSS transition on `backdrop-filter`
- Use `AnimatePresence` wrapping the conditional content render

### Select (`components/ui/select.tsx`)
- **Remove** existing CSS animation classes (`animate-in`, `fade-in`, `zoom-in`, `animate-out`, etc.)
- **SelectContent:** `motion.div` with `scale: 0.96 → 1`, `opacity: 0 → 1`, transform-origin from trigger
- **SelectItem:** staggered fade-in via `custom` prop (20ms delay per item)
- **Exit:** fast fade + scale down, exit spring

### Dropdown Menu (`components/ui/dropdown-menu.tsx`)
- **Remove** existing CSS animation classes
- Same pattern as Select: scale + fade from origin point
- Staggered items with 15ms delay
- Sub-menu content slides in from the side

### Tabs (`components/ui/tabs.tsx`)
- **Active indicator:** `motion.div` with scoped `layoutId={`tab-indicator-${id}`}` — sliding pill that follows active tab. Scoped ID prevents conflicts if multiple Tabs instances exist on the same page.
- **Tab content:** crossfade with `AnimatePresence mode="wait"`
- Direction-aware slide: track previous/next tab index, slide content left or right accordingly

### Progress (`components/ui/progress.tsx`)
- **Indicator width:** `motion.div` via Base-UI `render` prop, spring-animated width via `animate={{ width: `${value}%` }}`
- Smooth spring config for satisfying fill animation
- Value label: CSS `transition` on opacity for appear/disappear

### Badge (`components/ui/badge.tsx`)
- Use `motion.create("span")` to create a motion-enabled span, compatible with Base-UI's `useRender`
- **Mount:** `scale: 0 → 1`, snappy spring (pop-in effect)
- **Exit:** `scale: 1 → 0`, `opacity: 1 → 0`
- Wrap usage sites with `AnimatePresence` for exit animations

### Input / Textarea (`components/ui/input.tsx`, `components/ui/textarea.tsx`)
- **Focus border:** CSS `transition: border-color 150ms` (no Motion needed)
- **Error shake:** `motion.div` wrapper at usage sites with `x: [0, -4, 4, -4, 4, 0]` keyframes, snappy spring
- Textarea height: already handled by `field-sizing-content`, no Motion needed

### Sonner (`components/ui/sonner.tsx`)
- Already uses Sonner's built-in Emil Kowalski animations — no changes needed

## App-Specific Animations

### Drop Zone (`app/components/drop-zone.tsx`)
- **Drag-over:** CSS `transition` on border-color + `scale: 1.01` via `motion.div`
- **File badges:** stagger in with `AnimatePresence` + gentle spring
- **Progress bar:** uses the animated Progress component
- **Upload complete:** checkmark SVG with `pathLength: 0 → 1` draw animation

### Processing Log (`app/components/processing-log.tsx`)
- **Log entries:** `motion.div` slide in from left (`x: -12 → 0`) with stagger
- **Progress:** spring-animated via Progress component
- Spinner: CSS `@keyframes` rotation (not Motion — better GPU perf for continuous animation)

### Stop Cards (`app/components/stop-card.tsx`)
- **Mount:** staggered entrance, gentle spring
- **Reorder:** `layout` prop on `motion.div` for smooth position changes (use sparingly — layout animations are expensive)
- **Expand/collapse:** `AnimatePresence` for media sections
- **Media thumbnails:** pop-in with scale spring

### Review Panel (`app/components/review-panel.tsx`)
- Stop card list wrapped in stagger container
- Add/remove stops: `AnimatePresence` with layout animation

### Media Assignment (`app/components/media-assignment.tsx`)
- **Unmatched file list:** staggered entrance with gentle spring
- **Drag-to-assign:** layout animation on items as they move between unmatched and assigned lists
- **Assignment confirmation:** badge pop-in on the target stop card

### Route Preview (`app/components/route-preview.tsx`)
- **Route path:** SVG `pathLength: 0 → 1` draw animation on mount, smooth spring
- **Stop markers:** staggered pop-in along the route (scale 0 → 1, snappy spring)

### Dry Run Output (`app/components/dry-run-output.tsx`)
- **Document cards:** staggered fade-in with gentle spring
- **Badges:** pop-in with snappy spring (reuses badge animation)
- **Expand/collapse sections:** `AnimatePresence` height animation

### History List (in `app/page.tsx`)
- **Items:** staggered slide-in, gentle spring
- **Remove:** shrink (`height: 0`, `opacity: 0`) with layout reflow
- **Resume:** card content crossfades to next screen

### Publish Panel (`app/components/publish-panel.tsx`)
- **Success state:** checkmark SVG draw + badge pop-ins
- **Error state:** shake animation on error card

## Implementation Approach

1. Install `motion` package
2. Create `lib/motion.ts` with shared spring configs, stagger variants, and `useSpring` hook
3. Update CLAUDE.md to note shadcn components are now customized
4. Modify shadcn components: strip existing CSS animations, integrate Motion via Base-UI `render` prop
5. Add screen transition wrapper (`AnimatePresence mode="wait"`) in `app/page.tsx`
6. Enhance app components with entrance/exit/interaction animations
7. Test with `prefers-reduced-motion` to verify graceful degradation

## Constraints

- Use `initial={false}` on screen-level animations to avoid hydration flash
- Respect `prefers-reduced-motion` via `useSpring()` hook — returns `{ duration: 0 }` configs
- Keep continuous animations (spinners, loaders) as CSS keyframes for GPU performance
- Use `layout` prop sparingly (stop card reorder only) — it triggers expensive layout recalculations
- Scope `layoutId` values when multiple instances of the same component can coexist
- Strip existing `data-open`/`data-closed` CSS animations before adding Motion equivalents
