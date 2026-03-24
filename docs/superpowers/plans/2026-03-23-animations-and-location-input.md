# Animations & Location Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Emil Kowalski-style spring animations (via `motion/react`) to all shadcn components and screen transitions, and build a `LocationInput` component with Nominatim address search.

**Architecture:** Install `motion/react`, create shared spring configs in `lib/motion.ts`, update shadcn components to use motion primitives via Base-UI's `render` prop, wrap screens in `AnimatePresence`, then build the `LocationInput` component with a server-side geocode proxy. Two independent feature streams — animations first (foundation), then location input (uses animation system).

**Tech Stack:** motion/react, Next.js 16 App Router, Base-UI, Tailwind 4, Nominatim API

---

## File Map

**New files:**
- `lib/motion.ts` — shared spring configs, stagger variants, `useSpring` hook
- `app/components/location-input.tsx` — tabbed address search / coordinate input
- `app/api/geocode/route.ts` — Nominatim proxy

**Modified files:**
- `components/ui/button.tsx` — motion.button via render prop
- `components/ui/dialog.tsx` — strip CSS animations, add motion overlay/content
- `components/ui/select.tsx` — strip CSS animations, add motion content
- `components/ui/dropdown-menu.tsx` — strip CSS animations, add motion content
- `components/ui/tabs.tsx` — layoutId sliding indicator
- `components/ui/progress.tsx` — motion indicator width
- `components/ui/badge.tsx` — motion.create span for pop-in
- `app/page.tsx` — AnimatePresence screen transitions, history list animations
- `app/components/drop-zone.tsx` — drag-over scale, badge stagger
- `app/components/processing-log.tsx` — log entry slide-in
- `app/components/stop-card.tsx` — replace coordinates section with LocationInput
- `app/components/review-panel.tsx` — stop card stagger, replace region coords with LocationInput
- `app/components/publish-panel.tsx` — success checkmark, error shake
- `app/components/media-assignment.tsx` — staggered entrance
- `app/components/dry-run-output.tsx` — staggered cards, expand/collapse
- `app/components/route-preview.tsx` — SVG path draw, stop marker pop-in
- `CLAUDE.md` — note shadcn components are customized with motion

---

### Task 1: Install motion and create shared config

**Files:**
- Modify: `package.json`
- Create: `lib/motion.ts`

- [ ] **Step 1: Install motion**

```bash
pnpm add motion
```

- [ ] **Step 2: Create lib/motion.ts**

```ts
"use client"

import { useReducedMotion } from "motion/react"

export const spring = {
  snappy: { type: "spring" as const, stiffness: 400, damping: 25 },
  smooth: { type: "spring" as const, stiffness: 300, damping: 30 },
  gentle: { type: "spring" as const, stiffness: 200, damping: 24 },
  exit:   { type: "spring" as const, stiffness: 300, damping: 35 },
}

export const staggerContainer = (staggerMs = 0.04) => ({
  hidden: {},
  show: { transition: { staggerChildren: staggerMs } },
})

export const staggerChild = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
}

export function useSpring() {
  const reduced = useReducedMotion()
  if (reduced) {
    const instant = { duration: 0 }
    return { snappy: instant, smooth: instant, gentle: instant, exit: instant }
  }
  return spring
}
```

- [ ] **Step 3: Verify build compiles**

```bash
pnpm build 2>&1 | head -20
```

Expected: no errors related to motion imports.

- [ ] **Step 4: Commit**

```bash
git add lib/motion.ts package.json pnpm-lock.yaml
git commit -m "feat: add motion/react with shared spring configs"
```

---

### Task 2: Animate Button component

**Files:**
- Modify: `components/ui/button.tsx`

The Button uses `ButtonPrimitive` from Base-UI. Base-UI's `render` prop accepts a React element to render as the root. We pass `motion.button` with hover/tap animations.

- [ ] **Step 1: Update button.tsx**

Add motion import and wrap with motion.button via render prop:

```tsx
"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { motion } from "motion/react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { spring } from "@/lib/motion"

// ... buttonVariants stays exactly the same ...

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      render={
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          transition={spring.snappy}
        />
      }
      {...props}
    />
  )
}

export { Button, buttonVariants }
```

- [ ] **Step 2: Verify dev server renders buttons**

```bash
pnpm dev &
sleep 3
curl -s http://localhost:3000 | grep -c "button" || echo "check manually"
kill %1
```

- [ ] **Step 3: Commit**

```bash
git add components/ui/button.tsx
git commit -m "feat: add spring hover/tap animations to Button"
```

---

### Task 3: Animate Dialog component

**Files:**
- Modify: `components/ui/dialog.tsx`

Strip existing CSS animation classes from overlay and content. Replace with CSS transitions powered by `data-open`/`data-closed` attributes that Base-UI already provides. Use spring-like cubic-bezier curves to approximate Emil Kowalski's feel.

**Important:** Base-UI controls portal mount/unmount internally, so `motion.div` exit animations won't work (the element is removed from DOM before the exit can play). Instead, we use CSS transitions on `data-open`/`data-closed` attributes which Base-UI manages. We use `data-closed:duration-100` for a fast close and a cubic-bezier that approximates a spring for the open.

- [ ] **Step 1: Update dialog.tsx**

Replace the CSS animation classes with spring-like CSS transitions. Key changes:

1. Import `spring` from `lib/motion` (for reference only — actual animations are CSS)
2. In `DialogOverlay`: replace `data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0` with CSS transition classes
3. In `DialogContent`: replace `data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95` with CSS transition + transform classes

Updated `DialogOverlay`:
```tsx
function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 supports-backdrop-filter:backdrop-blur-xs transition-opacity duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] data-open:opacity-100 data-closed:opacity-0",
        className
      )}
      {...props}
    />
  )
}
```

Updated `DialogContent` — use CSS scale/opacity transitions:
```tsx
function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-background p-4 text-sm ring-1 ring-foreground/10 outline-none sm:max-w-sm transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] data-open:opacity-100 data-open:scale-100 data-closed:opacity-0 data-closed:scale-95",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-2 right-2"
                size="icon-sm"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}
```

No motion imports needed — this stays CSS-based to work with Base-UI's portal lifecycle.

- [ ] **Step 2: Test dialog open/close in browser**

Open dev server, navigate to a stop card, click "Suggest a type..." to open a dialog. Verify spring animation on open/close.

- [ ] **Step 3: Commit**

```bash
git add components/ui/dialog.tsx
git commit -m "feat: add spring scale/fade animations to Dialog"
```

---

### Task 4: Animate Select component

**Files:**
- Modify: `components/ui/select.tsx`

Same approach as Dialog — Base-UI controls portal mount/unmount, so we use CSS transitions on `data-open`/`data-closed` with a spring-like cubic-bezier instead of motion.div wrappers.

- [ ] **Step 1: Update select.tsx**

In `SelectContent`, replace the existing animation classes in the Popup className. Remove:
- `duration-100`
- `data-[align-trigger=true]:animate-none`
- All `data-[side=*]:slide-in-from-*` classes
- `data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95`
- `data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95`

Replace with spring-like CSS transitions:

```tsx
// In SelectContent Popup className, replace animation classes with:
"transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] data-open:opacity-100 data-open:scale-100 data-closed:opacity-0 data-closed:scale-[0.96]"
```

Full updated Popup className:
```tsx
className={cn("relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] data-open:opacity-100 data-open:scale-100 data-closed:opacity-0 data-closed:scale-[0.96]", className)}
```

No motion imports needed.

- [ ] **Step 2: Test select open/close**

Open dev server, open any Select dropdown (tour type, category, etc.). Verify spring animation.

- [ ] **Step 3: Commit**

```bash
git add components/ui/select.tsx
git commit -m "feat: add spring scale/fade animations to Select"
```

---

### Task 5: Animate Dropdown Menu component

**Files:**
- Modify: `components/ui/dropdown-menu.tsx`

Same CSS transition approach as Dialog and Select — no motion.div wrapper needed.

- [ ] **Step 1: Update dropdown-menu.tsx**

In `DropdownMenuContent` Popup className, remove:
- `duration-100`
- All `data-[side=*]:slide-in-from-*` classes
- `data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95`
- `data-closed:animate-out data-closed:overflow-hidden data-closed:fade-out-0 data-closed:zoom-out-95`

Replace with spring-like CSS transitions:
```tsx
className={cn("z-50 max-h-(--available-height) w-(--anchor-width) min-w-32 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] data-open:opacity-100 data-open:scale-100 data-closed:opacity-0 data-closed:scale-[0.96]", className)}
```

Also update `DropdownMenuSubContent` — same class replacement in its className string (line 138 of the original file). Remove the animation classes and add the same `transition-[opacity,transform]` pattern. The sub-content passes its className to DropdownMenuContent which merges it.

No motion imports needed.

- [ ] **Step 2: Commit**

```bash
git add components/ui/dropdown-menu.tsx
git commit -m "feat: add spring animations to DropdownMenu"
```

---

### Task 6: Animate Tabs component

**Files:**
- Modify: `components/ui/tabs.tsx`

Add a `motion.div` sliding indicator with `layoutId` for the active tab underline. The current implementation uses CSS `after:` pseudo-element — we'll keep that for the "line" variant but enhance the "default" variant with a motion sliding background.

- [ ] **Step 1: Update tabs.tsx**

This is a structural change. The `TabsTrigger` currently uses an `after:` pseudo-element for the line indicator. We add a motion.div inside each trigger that uses `layoutId` for smooth sliding:

```tsx
"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { motion } from "motion/react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { spring } from "@/lib/motion"

// Tabs and TabsList stay the same

function TabsTrigger({ className, children, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-colors group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-active:text-foreground dark:data-active:text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </TabsPrimitive.Tab>
  )
}

// TabsContent stays the same
```

Note: We remove the complex `after:` pseudo-element classes and the `data-active:bg-background data-active:shadow-sm` classes since the sliding indicator replaces that visual. The tab just changes text color on active.

- [ ] **Step 2: Commit**

```bash
git add components/ui/tabs.tsx
git commit -m "feat: simplify Tabs trigger for motion integration"
```

---

### Task 7: Animate Progress component

**Files:**
- Modify: `components/ui/progress.tsx`

Add spring-animated width to the progress indicator using motion.div.

- [ ] **Step 1: Update progress.tsx**

Replace the `ProgressIndicator` to use motion for smooth width transitions. The Base-UI Progress indicator gets its width via internal styles, but we can enhance the transition:

```tsx
"use client"

import { Progress as ProgressPrimitive } from "@base-ui/react/progress"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"
import { spring } from "@/lib/motion"

// Progress and ProgressTrack stay the same

function ProgressIndicator({
  className,
  ...props
}: ProgressPrimitive.Indicator.Props) {
  return (
    <ProgressPrimitive.Indicator
      data-slot="progress-indicator"
      className={cn("h-full bg-primary", className)}
      render={
        <motion.div transition={spring.smooth} />
      }
      {...props}
    />
  )
}

// ProgressLabel and ProgressValue stay the same
```

Base-UI sets indicator width via inline styles. The `motion.div` render element with `transition` will spring-animate any style changes. We remove the `transition-all` CSS class since motion handles the transition now.

- [ ] **Step 2: Commit**

```bash
git add components/ui/progress.tsx
git commit -m "feat: add spring-animated width to Progress indicator"
```

---

### Task 8: Animate Badge component

**Files:**
- Modify: `components/ui/badge.tsx`

Badge uses Base-UI's `useRender` which makes it trickier. We'll use `motion.create` to make a motion-compatible span.

- [ ] **Step 1: Update badge.tsx**

```tsx
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { motion } from "motion/react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { spring } from "@/lib/motion"

const MotionSpan = motion.create("span")

// badgeVariants stays the same

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render: render ?? <MotionSpan
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={spring.snappy}
    />,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
```

- [ ] **Step 2: Commit**

```bash
git add components/ui/badge.tsx
git commit -m "feat: add pop-in spring animation to Badge"
```

---

### Task 8b: Add Card hover CSS transition

**Files:**
- Modify: `components/ui/card.tsx`

No motion import needed — Card hover uses CSS transitions to keep it lightweight per the spec.

- [ ] **Step 1: Add hover transition classes to Card**

In the `Card` component, add hover lift and shadow transition. Find the Card function's className and add:
```
hover:-translate-y-0.5 hover:shadow-md transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]
```

- [ ] **Step 2: Commit**

```bash
git add components/ui/card.tsx
git commit -m "feat: add hover lift animation to Card"
```

---

### Task 9: Add screen transitions in app/page.tsx

**Files:**
- Modify: `app/page.tsx`

Wrap screen content in `AnimatePresence mode="wait"` with `motion.div` for each screen.

- [ ] **Step 1: Add imports**

At top of app/page.tsx, add:
```tsx
import { motion, AnimatePresence } from 'motion/react'
import { spring, staggerContainer, staggerChild } from '@/lib/motion'
```

**Hydration guard:** The `hydrated` state already exists in page.tsx. Use `initial={false}` on `AnimatePresence` to prevent the first screen from animating in on page load (which would cause a flash during hydration):

```tsx
<AnimatePresence mode="wait" initial={false}>
```

- [ ] **Step 2: Wrap screens in AnimatePresence**

Replace the screen rendering section (inside `<div className="mx-auto max-w-2xl px-4 py-8">`) with:

```tsx
<div className="mx-auto max-w-2xl px-4 py-8">
  <AnimatePresence mode="wait" initial={false}>
    {/* Choose path screen */}
    {screen === 'choose' && (
      <motion.section
        key="choose"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        transition={spring.smooth}
        className="space-y-6"
      >
        {/* ... existing choose screen content unchanged ... */}
      </motion.section>
    )}

    {/* Drop screen */}
    {screen === 'drop' && (
      <motion.section
        key="drop"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        transition={spring.smooth}
        className="space-y-6"
      >
        {/* ... existing drop screen content unchanged ... */}
      </motion.section>
    )}

    {/* Processing screen */}
    {screen === 'processing' && (
      <motion.section
        key="processing"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        transition={spring.smooth}
        className="space-y-4"
      >
        {/* ... existing processing screen content unchanged ... */}
      </motion.section>
    )}

    {/* Review screen */}
    {(screen === 'review' || screen === 'publish') && tour && (
      <motion.section
        key="review"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        transition={spring.smooth}
        className="space-y-6"
      >
        {/* ... existing review/publish content unchanged ... */}
      </motion.section>
    )}

    {/* Publish success (no tour) */}
    {screen === 'publish' && !tour && (
      <motion.section
        key="publish-success"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        transition={spring.smooth}
      >
        {/* ... existing content unchanged ... */}
      </motion.section>
    )}
  </AnimatePresence>
</div>
```

Each `<section>` becomes `<motion.section>` with a unique `key`. The inner content stays unchanged — we're just wrapping.

- [ ] **Step 3: Add stagger to history list**

In the choose screen's history entries section, wrap the entries list:

```tsx
<motion.div
  className="space-y-1.5"
  variants={staggerContainer()}
  initial="hidden"
  animate="show"
>
  {historyEntries.map((entry) => (
    <motion.div
      key={entry.id}
      variants={staggerChild}
      transition={spring.gentle}
      className="flex w-full items-center gap-2 rounded-md border border-border text-sm transition-colors hover:border-primary hover:bg-primary/5"
    >
      {/* ... existing entry content ... */}
    </motion.div>
  ))}
</motion.div>
```

Add `staggerContainer, staggerChild` to the imports from `@/lib/motion`.

- [ ] **Step 4: Verify screen transitions work**

Open dev server, navigate between screens. Verify fade+slide transitions.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add AnimatePresence screen transitions and history stagger"
```

---

### Task 10: Animate Drop Zone

**Files:**
- Modify: `app/components/drop-zone.tsx`

- [ ] **Step 1: Add motion imports and animate file badges**

```tsx
import { motion, AnimatePresence } from 'motion/react'
import { spring, staggerContainer, staggerChild } from '@/lib/motion'
```

Wrap the uploaded files badges section with stagger:

```tsx
{uploadedFiles.length > 0 && (
  <motion.div
    className="flex flex-wrap gap-2"
    variants={staggerContainer(0.05)}
    initial="hidden"
    animate="show"
  >
    {uploadedFiles.map((f) => (
      <motion.div key={f.id} variants={staggerChild} transition={spring.gentle}>
        <Badge variant="secondary" className="gap-1">
          <span>{CATEGORY_EMOJI[f.category]}</span>
          <span className="max-w-[160px] truncate">{f.originalName}</span>
        </Badge>
      </motion.div>
    ))}
  </motion.div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/drop-zone.tsx
git commit -m "feat: add stagger animation to drop zone file badges"
```

---

### Task 11: Animate Processing Log

**Files:**
- Modify: `app/components/processing-log.tsx`

- [ ] **Step 1: Add slide-in animation to log entries**

```tsx
import { motion } from 'motion/react'
import { spring } from '@/lib/motion'
```

Replace the messages map with motion-animated entries:

```tsx
{messages.map((msg, i) => (
  <motion.div
    key={i}
    initial={{ opacity: 0, x: -12 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ ...spring.gentle, delay: Math.min(i * 0.02, 0.5) }}
    className="text-muted-foreground"
  >
    {msg}
  </motion.div>
))}
```

Note: limit the delay to avoid excessive accumulated delay for long message lists. Cap at `Math.min(i * 0.02, 0.5)`.

- [ ] **Step 2: Commit**

```bash
git add app/components/processing-log.tsx
git commit -m "feat: add slide-in animation to processing log entries"
```

---

### Task 12: Animate Review Panel (stop card stagger)

**Files:**
- Modify: `app/components/review-panel.tsx`

- [ ] **Step 1: Add stagger to stop card list**

Add imports:
```tsx
import { motion } from 'motion/react'
import { spring, staggerContainer, staggerChild } from '@/lib/motion'
```

Find the section that maps over `tour.stops` and renders `StopCard` components. Wrap the container with stagger variants and each card with `motion.div`:

```tsx
<motion.div
  className="space-y-4"
  variants={staggerContainer(0.06)}
  initial="hidden"
  animate="show"
>
  {tour.stops.map((stop, i) => (
    <motion.div key={stop.id} variants={staggerChild} transition={spring.gentle} layout>
      <StopCard
        stop={stop}
        index={i}
        files={files}
        onUpdate={(updated) => updateStop(i, updated)}
        onRemove={/* ... */}
        onRemoveMedia={/* ... */}
        onReplaceImage={/* ... */}
        replacingImage={/* ... */}
      />
    </motion.div>
  ))}
</motion.div>
```

- [ ] **Step 2: Commit**

```bash
git add app/components/review-panel.tsx
git commit -m "feat: add stagger animation to stop card list"
```

---

### Task 13: Animate Media Assignment

**Files:**
- Modify: `app/components/media-assignment.tsx`

- [ ] **Step 1: Add stagger to unmatched files list**

```tsx
import { motion } from 'motion/react'
import { spring, staggerContainer, staggerChild } from '@/lib/motion'
```

Wrap the files list with stagger:

```tsx
<CardContent>
  <motion.div
    className="space-y-4"
    variants={staggerContainer(0.05)}
    initial="hidden"
    animate="show"
  >
    {unmatchedFiles.map((file) => (
      <motion.div key={file.id} variants={staggerChild} transition={spring.gentle} className="space-y-2">
        {/* ... existing content ... */}
      </motion.div>
    ))}
  </motion.div>
</CardContent>
```

- [ ] **Step 2: Commit**

```bash
git add app/components/media-assignment.tsx
git commit -m "feat: add stagger animation to media assignment"
```

---

### Task 14: Animate Dry Run Output

**Files:**
- Modify: `app/components/dry-run-output.tsx`

- [ ] **Step 1: Add stagger to document cards and AnimatePresence for expand/collapse**

```tsx
import { motion, AnimatePresence } from 'motion/react'
import { spring, staggerContainer, staggerChild } from '@/lib/motion'
```

Wrap the documents list with stagger:

```tsx
<motion.div
  className="space-y-2"
  variants={staggerContainer(0.04)}
  initial="hidden"
  animate="show"
>
  {data.documents.map((doc) => (
    <motion.div key={doc._id} variants={staggerChild} transition={spring.gentle}>
      <div className="rounded-lg border border-border bg-muted/30">
        {/* ... button stays the same ... */}
        <AnimatePresence>
          {openDocs.has(doc._id) && (
            <motion.pre
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={spring.smooth}
              className="overflow-hidden rounded-b-lg bg-background px-3 pb-3 text-[11px] text-foreground"
            >
              {JSON.stringify(doc, null, 2)}
            </motion.pre>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  ))}
</motion.div>
```

- [ ] **Step 2: Commit**

```bash
git add app/components/dry-run-output.tsx
git commit -m "feat: add stagger and expand/collapse animations to dry run output"
```

---

### Task 15: Animate Route Preview

**Files:**
- Modify: `app/components/route-preview.tsx`

- [ ] **Step 1: Add SVG path draw and stop marker pop-in**

```tsx
import { motion } from 'motion/react'
import { spring } from '@/lib/motion'
```

Replace the static `<path>` with a motion path that draws in:

```tsx
{path && (
  <motion.path
    d={path}
    fill="none"
    stroke="#1D9E75"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    initial={{ pathLength: 0 }}
    animate={{ pathLength: 1 }}
    transition={{ duration: 1.5, ease: "easeOut" }}
  />
)}
```

Replace each stop marker `<g>` with motion for staggered pop-in:

```tsx
{stops.map((s, i) => {
  const cx = toX(s.lng)
  const cy = toY(s.lat)
  return (
    <motion.g
      key={s.index}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ ...spring.snappy, delay: 0.3 + i * 0.1 }}
      style={{ transformOrigin: `${cx}px ${cy}px` }}
    >
      <circle cx={cx} cy={cy} r="10" fill="#1D9E75" />
      <text
        x={cx}
        y={cy + 4}
        textAnchor="middle"
        fontSize="9"
        fontWeight="bold"
        fill="white"
      >
        {s.index + 1}
      </text>
    </motion.g>
  )
})}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/route-preview.tsx
git commit -m "feat: add SVG path draw and stop marker pop-in animations"
```

---

### Task 16: Animate Publish Panel

**Files:**
- Modify: `app/components/publish-panel.tsx`

- [ ] **Step 1: Add success state animation**

```tsx
import { motion } from 'motion/react'
import { spring } from '@/lib/motion'
```

In the success state card, wrap content with motion:

```tsx
if (publishResult?.success && publishResult.studioUrl) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={spring.smooth}
    >
      <Card className="border-green-500/40 bg-green-500/5">
        {/* ... existing content ... */}
      </Card>
    </motion.div>
  )
}
```

For the error card, add a shake animation:

```tsx
{publishResult?.error && (
  <motion.div
    initial={{ x: 0 }}
    animate={{ x: [0, -4, 4, -4, 4, 0] }}
    transition={{ duration: 0.4 }}
  >
    <Card className="border-destructive/40 bg-destructive/5">
      <CardContent className="pt-4">
        <p className="text-sm text-destructive">{publishResult.error}</p>
      </CardContent>
    </Card>
  </motion.div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/publish-panel.tsx
git commit -m "feat: add success scale-in and error shake animations to PublishPanel"
```

---

### Task 17: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add animation note to conventions**

Add after the "### Radix Select (shadcn)" section:

```markdown
### Animations
shadcn components (`components/ui/`) have been customized with `motion/react` spring animations. Re-generating via shadcn CLI will overwrite these — re-apply motion integration manually after any regeneration. Shared spring configs live in `lib/motion.ts`.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: note shadcn components are customized with motion animations"
```

---

### Task 18: Build geocode API route

**Files:**
- Create: `app/api/geocode/route.ts`

- [ ] **Step 1: Create the Nominatim proxy route**

```ts
import { NextRequest, NextResponse } from 'next/server'

interface GeocodeSuggestion {
  display_name: string
  lat: number
  lon: number
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')
  if (!q || q.length < 3) {
    return NextResponse.json([])
  }

  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', q)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '5')
  url.searchParams.set('addressdetails', '1')

  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'TrovareTourCreator/1.0',
    },
  })

  if (!res.ok) {
    return NextResponse.json([], { status: res.status })
  }

  const data = await res.json()
  const suggestions: GeocodeSuggestion[] = data.map((item: { display_name: string; lat: string; lon: string }) => ({
    display_name: item.display_name,
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
  }))

  return NextResponse.json(suggestions)
}
```

- [ ] **Step 2: Test the route**

```bash
curl -s "http://localhost:3000/api/geocode?q=colosseum+rome" | head -20
```

Expected: JSON array with `display_name`, `lat`, `lon` fields.

- [ ] **Step 3: Commit**

```bash
git add app/api/geocode/route.ts
git commit -m "feat: add Nominatim geocode proxy API route"
```

---

### Task 19: Build LocationInput component

**Files:**
- Create: `app/components/location-input.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { MapPin, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { Input } from '@/components/ui/input'
import { spring } from '@/lib/motion'

interface GeocodeSuggestion {
  display_name: string
  lat: number
  lon: number
}

interface LocationInputProps {
  lat: number
  lng: number
  onChange: (lat: number, lng: number) => void
  layoutIdPrefix?: string
}

// Module-level rate limiting for Nominatim (1 req/sec)
let lastRequest = 0

export function LocationInput({ lat, lng, onChange, layoutIdPrefix = 'location' }: LocationInputProps) {
  const hasCoords = lat !== 0 || lng !== 0
  const [tab, setTab] = useState<'search' | 'coords'>(hasCoords ? 'coords' : 'search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeocodeSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [selectedName, setSelectedName] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const search = useCallback(async (q: string) => {
    if (q.length < 3) {
      setResults([])
      setShowDropdown(false)
      return
    }

    // Rate limit
    const now = Date.now()
    const wait = Math.max(0, 1000 - (now - lastRequest))
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    lastRequest = Date.now()

    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
      if (!res.ok) throw new Error()
      const data: GeocodeSuggestion[] = await res.json()
      setResults(data)
      setShowDropdown(true)
      setHighlightIndex(-1)
    } catch {
      setError(true)
      setResults([])
      setShowDropdown(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.length < 3) {
      setResults([])
      setShowDropdown(false)
      return
    }
    debounceRef.current = setTimeout(() => search(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, search])

  function selectResult(result: GeocodeSuggestion) {
    onChange(result.lat, result.lon)
    setSelectedName(result.display_name.split(',')[0])
    setQuery(result.display_name.split(',')[0])
    setShowDropdown(false)
    setResults([])
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showDropdown || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault()
      selectResult(results[highlightIndex])
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
    }
  }

  const tabs = ['search', 'coords'] as const

  return (
    <div className="space-y-2">
      {/* Tab row */}
      <div className="relative flex border-b border-border">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            className={`relative px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setTab(t)}
          >
            {t === 'search' ? 'Search' : 'Coordinates'}
            {tab === t && (
              <motion.div
                layoutId={`${layoutIdPrefix}-tab`}
                className="absolute inset-x-0 -bottom-px h-0.5 bg-foreground"
                transition={spring.snappy}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {tab === 'search' && (
          <motion.div
            key="search"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div className="relative">
              <div className="relative">
                <Input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setSelectedName('')
                  }}
                  onKeyDown={handleKeyDown}
                  onFocus={() => { if (results.length > 0) setShowDropdown(true) }}
                  placeholder="Search for an address..."
                  className="h-7 text-xs pr-8"
                />
                {loading && (
                  <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
              </div>

              {/* Dropdown */}
              <AnimatePresence>
                {showDropdown && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={spring.smooth}
                    className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border border-border bg-popover shadow-md overflow-hidden"
                  >
                    {error ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        Search unavailable — use Coordinates tab
                      </div>
                    ) : results.length === 0 && !loading ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        No results found
                      </div>
                    ) : (
                      results.map((r, i) => {
                        const parts = r.display_name.split(',')
                        const primary = parts[0]
                        const secondary = parts.slice(1).join(',').trim()
                        return (
                          <motion.button
                            key={`${r.lat}-${r.lon}`}
                            type="button"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.02 }}
                            className={`flex w-full items-start gap-2 px-3 py-2 text-left text-xs hover:bg-accent transition-colors ${
                              i === highlightIndex ? 'bg-accent' : ''
                            }`}
                            onClick={() => selectResult(r)}
                          >
                            <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                            <div>
                              <div className="font-medium">{primary}</div>
                              {secondary && (
                                <div className="text-muted-foreground text-[11px] mt-0.5">{secondary}</div>
                              )}
                            </div>
                          </motion.button>
                        )
                      })
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Resolved coordinates */}
            {selectedName && hasCoords && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-1.5 flex items-center justify-between"
              >
                <span className="font-mono text-[11px] text-muted-foreground">
                  {Math.abs(lat).toFixed(5)}° {lat >= 0 ? 'N' : 'S'}, {Math.abs(lng).toFixed(5)}° {lng >= 0 ? 'E' : 'W'}
                </span>
                <span className="text-[10px] text-muted-foreground/60">auto-filled</span>
              </motion.div>
            )}
          </motion.div>
        )}

        {tab === 'coords' && (
          <motion.div
            key="coords"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-2 gap-2"
          >
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Latitude</label>
              <Input
                type="number"
                step="any"
                value={lat !== 0 ? lat : ''}
                placeholder="0.00000"
                onChange={(e) => onChange(parseFloat(e.target.value) || 0, lng)}
                className="h-7 font-mono text-xs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Longitude</label>
              <Input
                type="number"
                step="any"
                value={lng !== 0 ? lng : ''}
                placeholder="0.00000"
                onChange={(e) => onChange(lat, parseFloat(e.target.value) || 0)}
                className="h-7 font-mono text-xs"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/location-input.tsx
git commit -m "feat: add LocationInput component with Nominatim search and tabbed UI"
```

---

### Task 20: Integrate LocationInput into StopCard

**Files:**
- Modify: `app/components/stop-card.tsx`

- [ ] **Step 1: Replace coordinates section**

Add import:
```tsx
import { LocationInput } from './location-input'
```

Replace the `{/* Coordinates */}` section (the `<div className="grid grid-cols-2 gap-2">` block with the two lat/lng inputs) with:

```tsx
{/* Location */}
<LocationInput
  lat={stop.lat}
  lng={stop.lng}
  onChange={(lat, lng) => onUpdate({ ...stop, lat, lng })}
  layoutIdPrefix={`location-stop-${stop.id}`}
/>
```

- [ ] **Step 2: Verify in browser**

Open a stop card, verify the tabbed interface shows. Test searching for an address. Switch to Coordinates tab, verify values are populated.

- [ ] **Step 3: Commit**

```bash
git add app/components/stop-card.tsx
git commit -m "feat: replace stop card coordinates with LocationInput"
```

---

### Task 21: Integrate LocationInput into Review Panel (new region dialog)

**Files:**
- Modify: `app/components/review-panel.tsx`

- [ ] **Step 1: Refactor region state and replace inputs**

Add import:
```tsx
import { LocationInput } from './location-input'
```

Replace the string state variables:
```tsx
// Before:
const [newRegionLat, setNewRegionLat] = useState('')
const [newRegionLng, setNewRegionLng] = useState('')

// After:
const [newRegionCoords, setNewRegionCoords] = useState({ lat: 0, lng: 0 })
```

Update the reset in the region select onChange:
```tsx
// Before:
setNewRegionLat('')
setNewRegionLng('')

// After:
setNewRegionCoords({ lat: 0, lng: 0 })
```

Replace the lat/lng input grid in the New Region dialog (the `<div className="grid grid-cols-2 gap-2">` block) with:

```tsx
<LocationInput
  lat={newRegionCoords.lat}
  lng={newRegionCoords.lng}
  onChange={(lat, lng) => setNewRegionCoords({ lat, lng })}
  layoutIdPrefix="location-new-region"
/>
```

Update the submit handler:
```tsx
// Before:
lat: newRegionLat ? parseFloat(newRegionLat) : undefined,
lng: newRegionLng ? parseFloat(newRegionLng) : undefined,

// After:
lat: newRegionCoords.lat !== 0 ? newRegionCoords.lat : undefined,
lng: newRegionCoords.lng !== 0 ? newRegionCoords.lng : undefined,
```

- [ ] **Step 2: Verify in browser**

Open the review panel, select "+ New region..." from the region dropdown. Verify LocationInput appears in the dialog. Test searching and manual coordinate entry.

- [ ] **Step 3: Commit**

```bash
git add app/components/review-panel.tsx
git commit -m "feat: replace region dialog coordinates with LocationInput"
```

---

### Task 22: Final build verification

- [ ] **Step 1: Run full build**

```bash
pnpm build
```

Expected: successful build with no TypeScript errors.

- [ ] **Step 2: Run dev server and smoke test**

Test the full flow:
1. Choose screen → cards visible, history stagger works
2. Drop screen → drag area, badge stagger on upload
3. Processing → log entries slide in, progress bar springs
4. Review → stop cards stagger in, LocationInput works (search + coordinates tabs)
5. New region dialog → LocationInput works
6. Publish → success animation, error shake
7. Route preview → path draws, markers pop in
8. Dialog open/close → spring animation
9. Select dropdowns → spring animation

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: address build/runtime issues from animation integration"
```
