# Responsive Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app fully usable on mobile (< 768px) and iPad portrait (768–1024px) without touching the desktop experience.

**Architecture:** All responsive logic lives in `LandingPage.module.css` (media queries) and `LandingPage.tsx` (drawer state + bottom bar JSX). No new files needed. Desktop breakpoint (> 1024px) is untouched.

**Tech Stack:** Next.js 16, React 19, CSS Modules, TypeScript

---

## Breakpoints

| Name | Range | Strategy |
|---|---|---|
| Mobile | `< 768px` | Sidebar hidden → full drawer via ☰, bottom tab bar |
| iPad Portrait | `768px – 1024px` | Sidebar 56px icon-only, topbar ☰ → overlay drawer, no bottom bar |
| Desktop | `> 1024px` | Unchanged |

---

## Files

- **Modify:** `app/components/LandingPage.tsx` — add `drawerOpen` state, drawer overlay JSX, bottom tab bar JSX, hamburger button in topbar/landing header
- **Modify:** `app/components/LandingPage.module.css` — replace the 14-line existing `@media` block with complete responsive rules

---

## Task 1: Clean Up Existing Responsive CSS

The existing 14-line `@media` block at the bottom of the CSS file is incomplete and will conflict. Replace it.

**Files:**
- Modify: `app/components/LandingPage.module.css` (lines 767–781)

- [ ] **Step 1: Remove existing responsive block**

In `LandingPage.module.css`, find and delete the entire existing responsive section at the bottom of the file:

```css
/* ── Responsive ── */
@media (max-width: 980px) {
  .shell { grid-template-columns: 1fr; }
  .sb { display: none; }
  .kpiGrid { grid-template-columns: 1fr 1fr; }
  .dashGrid { grid-template-columns: 1fr; }
  .teamGrid { grid-template-columns: 1fr; }
  .statGrid3 { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 640px) {
  .kpiGrid { grid-template-columns: 1fr; }
  .fbGrid { grid-template-columns: 1fr; }
  .page { padding: 16px 16px 48px; }
  .statGrid3 { grid-template-columns: 1fr; }
```

Replace with this single comment as a placeholder (the full rules come in later tasks):

```css
/* ── Responsive — see Tasks 2-6 ── */
```

- [ ] **Step 2: Verify dev server compiles**

Run: `npm run dev`
Expected: No compilation errors in terminal.

- [ ] **Step 3: Commit**

```bash
git add app/components/LandingPage.module.css
git commit -m "refactor: remove incomplete responsive CSS block"
```

---

## Task 2: Add Drawer State to LandingPage.tsx

Add `drawerOpen` state and a `toggleDrawer` handler. This state drives the sidebar drawer on mobile and iPad.

**Files:**
- Modify: `app/components/LandingPage.tsx`

- [ ] **Step 1: Add drawerOpen state**

In `LandingPage.tsx`, find the existing state declarations block (around line 192 where `activeTab` is defined). Add immediately after `const [showUserMenu, setShowUserMenu] = useState(false);`:

```tsx
const [drawerOpen, setDrawerOpen] = useState(false);
```

- [ ] **Step 2: Close drawer on tab change**

In the `handleTab` function (around line 345), add `setDrawerOpen(false);` as the first line inside the function body:

```tsx
const handleTab = (tab: string) => {
  setDrawerOpen(false);  // ← add this line
  setActiveTab(tab);
  // ... rest unchanged
```

- [ ] **Step 3: Commit**

```bash
git add app/components/LandingPage.tsx
git commit -m "feat: add drawerOpen state for mobile/iPad sidebar"
```

---

## Task 3: Add Hamburger Button + Drawer Overlay JSX

Add the ☰ hamburger button in two places: the landing header and the app shell topbar. Add a full-screen backdrop overlay that closes the drawer.

**Files:**
- Modify: `app/components/LandingPage.tsx`

- [ ] **Step 1: Add hamburger to landing header**

In the `landingHdr` section (around line 692), find:
```tsx
<header className={styles.landingHdr}>
  <div className={styles.landingHdrInner}>
    {/* Logo */}
    <button className={styles.mark} onClick={() => handleTab("home")}>
```

Add a hamburger button right after the logo button (before `<nav className={styles.landingNav}>`):

```tsx
{/* Hamburger — mobile only, shown via CSS */}
<button
  className={styles.hamburger}
  onClick={() => setDrawerOpen(v => !v)}
  aria-label="Menu"
>
  <span /><span /><span />
</button>
```

- [ ] **Step 2: Add hamburger to app topbar**

In the topbar section (around line 956), find:
```tsx
<div className={styles.tb}>
  <div className={styles.tbSearch}>
```

Add a hamburger button as the first child of `.tb`, before `.tbSearch`:

```tsx
{/* Hamburger — mobile/iPad only, shown via CSS */}
<button
  className={styles.hamburger}
  onClick={() => setDrawerOpen(v => !v)}
  aria-label="Menu"
>
  <span /><span /><span />
</button>
```

- [ ] **Step 3: Add drawer backdrop overlay**

In the shell section (around line 818, just before `<aside className={styles.sb}>`), add a backdrop div:

```tsx
{/* Drawer backdrop — mobile/iPad */}
{drawerOpen && (
  <div
    className={styles.drawerBackdrop}
    onClick={() => setDrawerOpen(false)}
  />
)}
```

- [ ] **Step 4: Apply drawerOpen class to sidebar**

Find `<aside className={styles.sb}>` (line 821) and update it to:

```tsx
<aside className={`${styles.sb}${drawerOpen ? ` ${styles.sbDrawerOpen}` : ""}`}>
```

- [ ] **Step 5: Commit**

```bash
git add app/components/LandingPage.tsx
git commit -m "feat: add hamburger button and drawer backdrop overlay"
```

---

## Task 4: Bottom Tab Bar JSX

Add the role-based bottom tab bar to the app shell. It renders always but is hidden on desktop via CSS.

**Files:**
- Modify: `app/components/LandingPage.tsx`

- [ ] **Step 1: Add bottom tab bar JSX**

In the shell section, find the closing `</div>` of `shellMain` (the last `</div>` before `</div> {/* shell */}`). Add the bottom tab bar just before it:

```tsx
{/* ── Bottom Tab Bar — mobile only (hidden on desktop via CSS) ── */}
{activeTab !== "home" && (() => {
  type BottomTab = { key: string; icon: string; label: string };
  const agentTabs: BottomTab[] = [
    { key: "home",        icon: "home",   label: lang === "tr" ? "Ana"    : "Home" },
    { key: "evaluations", icon: "list",   label: lang === "tr" ? "Değ."   : "Evals" },
    { key: "scores",      icon: "star",   label: lang === "tr" ? "Skor"   : "Scores" },
  ];
  const otherTabs: BottomTab[] = [
    { key: "home",        icon: "home",    label: lang === "tr" ? "Ana"     : "Home" },
    { key: "evaluations", icon: "list",    label: lang === "tr" ? "Değ."    : "Evals" },
    { key: "reports",     icon: "doc",     label: lang === "tr" ? "Rapor"   : "Reports" },
  ];
  const tabs = user.role === "AGENT" ? agentTabs : otherTabs;
  return (
    <nav className={styles.bottomBar}>
      {tabs.map(({ key, icon, label }) => (
        <button
          key={key}
          className={`${styles.bottomBarItem}${activeTab === key ? ` ${styles.bottomBarItemActive}` : ""}`}
          onClick={() => handleTab(key)}
        >
          <Icon name={icon} size={20} />
          <span>{label}</span>
        </button>
      ))}
      <button
        className={styles.bottomBarItem}
        onClick={() => setDrawerOpen(v => !v)}
      >
        <Icon name="list" size={20} />
        <span>{lang === "tr" ? "Menü" : "Menu"}</span>
      </button>
    </nav>
  );
})()}
```

- [ ] **Step 2: Also show bottom bar on home tab for mobile**

The home tab renders in a separate `<div>` outside the shell (no sidebar exists there). Find the closing `</div>` of the home tab section (around line 811, just before the shell section begins) and add a simplified bottom bar there. On home tab the Menü button navigates into the app — no sidebar drawer exists here.

```tsx
{/* Bottom bar on landing home — mobile only, no drawer (sidebar not rendered here) */}
<nav className={styles.bottomBar} style={{ position: "fixed" }}>
  <button
    className={styles.bottomBarItem}
    onClick={() => handleTab("evaluations")}
  >
    <Icon name="list" size={20} />
    <span>{lang === "tr" ? "Değ." : "Evals"}</span>
  </button>
  <button
    className={styles.bottomBarItem}
    onClick={() => handleTab(user.role === "AGENT" ? "scores" : "reports")}
  >
    <Icon name={user.role === "AGENT" ? "star" : "doc"} size={20} />
    <span>{user.role === "AGENT" ? (lang === "tr" ? "Skor" : "Scores") : (lang === "tr" ? "Rapor" : "Reports")}</span>
  </button>
  <button
    className={`${styles.bottomBarItem} ${styles.bottomBarItemActive}`}
    onClick={() => handleTab("home")}
  >
    <Icon name="home" size={20} />
    <span>{lang === "tr" ? "Ana" : "Home"}</span>
  </button>
</nav>
```

- [ ] **Step 3: Commit**

```bash
git add app/components/LandingPage.tsx
git commit -m "feat: add role-based bottom tab bar JSX"
```

---

## Task 5: Responsive CSS — Hamburger, Drawer, Bottom Bar

Add all new CSS classes for the hamburger button, drawer behaviour, backdrop, and bottom tab bar.

**Files:**
- Modify: `app/components/LandingPage.module.css`

- [ ] **Step 1: Add hamburger button styles**

Append to `LandingPage.module.css` (after the light mode section, before the placeholder comment from Task 1):

```css
/* ── Hamburger button ── */
.hamburger {
  display: none; /* shown only on mobile/iPad via media query */
  flex-direction: column; justify-content: center; align-items: center;
  gap: 4px; width: 36px; height: 36px; border-radius: 8px;
  background: rgba(255,255,255,.06); border: 1px solid var(--rule);
  cursor: pointer; padding: 0; flex-shrink: 0;
}
.hamburger span {
  display: block; width: 16px; height: 1.5px;
  background: var(--fg); border-radius: 2px;
  transition: transform 200ms, opacity 200ms;
}

/* ── Drawer backdrop ── */
.drawerBackdrop {
  display: none; /* shown only on mobile/iPad via media query */
  position: fixed; inset: 0; z-index: 39;
  background: rgba(0,0,0,.55);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}

/* ── Bottom tab bar ── */
.bottomBar {
  display: none; /* shown only on mobile via media query */
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 40;
  background: rgba(8,12,22,.92);
  backdrop-filter: blur(16px) saturate(160%);
  -webkit-backdrop-filter: blur(16px) saturate(160%);
  border-top: 1px solid var(--rule);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.bottomBarItem {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 3px; padding: 8px 4px 10px;
  background: none; border: none; cursor: pointer;
  color: var(--fg-faint); font-family: 'Inter', ui-sans-serif, sans-serif;
  font-size: 10px; transition: color 120ms;
}
.bottomBarItem:hover,
.bottomBarItemActive { color: var(--accent); }
.lightMode .bottomBar {
  background: rgba(255,253,248,.94);
  border-top-color: rgba(26,24,20,.1);
}
```

- [ ] **Step 2: Add drawer sidebar styles (shared by mobile + iPad)**

Append:

```css
/* ── Sidebar as overlay drawer (mobile + iPad) ── */
.sbDrawerOpen {
  transform: translateX(0) !important;
  box-shadow: 4px 0 32px rgba(0,0,0,.6);
}
```

- [ ] **Step 3: Commit**

```bash
git add app/components/LandingPage.module.css
git commit -m "feat: add hamburger, drawer backdrop, bottom bar CSS classes"
```

---

## Task 6: Responsive Media Queries — Mobile (< 768px)

Add the full mobile breakpoint rules.

**Files:**
- Modify: `app/components/LandingPage.module.css`

- [ ] **Step 1: Add mobile media query block**

Append to `LandingPage.module.css`:

```css
/* ═══════════════════════════════════════════════════
   MOBILE  < 768px
   ═══════════════════════════════════════════════════ */
@media (max-width: 767px) {

  /* Show hamburger in landing header and topbar */
  .hamburger { display: flex; }

  /* Show drawer backdrop when open */
  .drawerBackdrop { display: block; }

  /* Show bottom tab bar */
  .bottomBar { display: flex; }

  /* Landing header: hide numbered nav */
  .landingNav { display: none; }

  /* Landing header: compact padding */
  .landingHdr { padding: 12px 16px; }
  .landingHdrRight { gap: 6px; }

  /* Hide decorative meta text in header */
  .hdrMetaWrap { display: none; }

  /* Stage: shrink padding */
  .stage { padding: 72px 20px 0; }

  /* Hide MetaRail */
  .metaRail { display: none; }

  /* Hero: smaller font, adjusted bottom padding */
  .hero { padding-bottom: 80px; }
  .heroH1 { font-size: clamp(30px, 9vw, 48px); margin-bottom: 14px; }
  .heroLede { font-size: 13px; margin-bottom: 22px; }
  .heroActions { flex-direction: column; }
  .heroActions .btn { width: 100%; justify-content: center; }

  /* Stats strip: horizontal scroll on very small screens */
  .statsStrip { overflow-x: auto; }
  .statStripItem { min-width: 110px; padding: 14px 16px; }

  /* Hide scroll indicator */
  .scrollInd { display: none; }

  /* Shell: single column, no sidebar column */
  .shell { grid-template-columns: 1fr; }

  /* Sidebar: hidden off-screen, slides in as drawer */
  .sb {
    position: fixed; left: 0; top: 0; height: 100vh; z-index: 40;
    transform: translateX(-100%);
    transition: transform 250ms cubic-bezier(0.4, 0, 0.2, 1),
                box-shadow 250ms;
    width: 240px;
  }

  /* Topbar: hide search bar, show hamburger */
  .tbSearch { display: none; }

  /* Page: bottom padding so content clears bottom bar (~60px) */
  .page { padding: 16px 16px 80px; }

  /* Grids: stack to single column */
  .kpiGrid { grid-template-columns: 1fr 1fr; }
  .dashGrid { grid-template-columns: 1fr; }
  .teamGrid { grid-template-columns: 1fr; }
  .statGrid3 { grid-template-columns: 1fr 1fr; }
  .fbGrid { grid-template-columns: 1fr; }
  .compareGrid { grid-template-columns: 1fr; }
  .compareStatsRow { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 480px) {
  .kpiGrid { grid-template-columns: 1fr; }
  .statGrid3 { grid-template-columns: 1fr; }
}
```

- [ ] **Step 2: Verify visually at 375px (iPhone)**

Start dev server (`npm run dev`), open `http://localhost:3000` in browser.
Open DevTools → Toggle device toolbar → set to 375×812 (iPhone 14).

Home tab checklist:
- [ ] MetaRail not visible
- [ ] Numbered nav not visible
- [ ] Hero text readable, "Konsolu Aç" button full width
- [ ] Bottom bar visible at bottom with 3–4 items
- [ ] ☰ hamburger visible in header

App tab (navigate to Evaluations) checklist:
- [ ] Sidebar not visible
- [ ] Hamburger in topbar visible
- [ ] Tapping hamburger → sidebar slides in from left
- [ ] Tapping backdrop → sidebar closes
- [ ] Bottom bar visible

- [ ] **Step 3: Commit**

```bash
git add app/components/LandingPage.module.css
git commit -m "feat: add mobile responsive rules (< 768px)"
```

---

## Task 7: Responsive Media Queries — iPad Portrait (768–1024px)

Add the iPad portrait breakpoint: icon-only sidebar + overlay drawer via topbar hamburger.

**Files:**
- Modify: `app/components/LandingPage.module.css`

- [ ] **Step 1: Add iPad media query block**

Append to `LandingPage.module.css`:

```css
/* ═══════════════════════════════════════════════════
   iPAD PORTRAIT  768px – 1024px
   ═══════════════════════════════════════════════════ */
@media (min-width: 768px) and (max-width: 1024px) {

  /* Show hamburger in topbar (not in landing header) */
  .shell .hamburger { display: flex; }

  /* Show drawer backdrop when open */
  .drawerBackdrop { display: block; }

  /* Shell: sidebar takes 56px, rest is content */
  .shell { grid-template-columns: 56px 1fr; }

  /* Sidebar: icon-only, 56px wide, clips labels */
  .sb {
    width: 56px;
    overflow: hidden;
    padding: 14px 8px;
    transition: width 250ms cubic-bezier(0.4, 0, 0.2, 1),
                box-shadow 250ms;
  }

  /* Drawer open: full sidebar overlays content */
  .sbDrawerOpen {
    position: fixed; left: 0; top: 0;
    height: 100vh; z-index: 40;
    width: 240px;
    padding: 18px 14px;
  }

  /* Hide text labels and sections in icon-only state */
  .sb:not(.sbDrawerOpen) .sbBrandName,
  .sb:not(.sbDrawerOpen) .sbBrandSub,
  .sb:not(.sbDrawerOpen) .sbSection,
  .sb:not(.sbDrawerOpen) .sbLink span,
  .sb:not(.sbDrawerOpen) .sbUserTxt { display: none; }

  /* Brand mark: center when icon-only */
  .sb:not(.sbDrawerOpen) .sbBrand { justify-content: center; padding: 4px 0 12px; }

  /* Nav links: center icon when no label */
  .sb:not(.sbDrawerOpen) .sbLink { justify-content: center; padding: 8px; }
  .sb:not(.sbDrawerOpen) .sbBottom { align-items: center; }

  /* Hide user avatar text block */
  .sb:not(.sbDrawerOpen) .sbUser { justify-content: center; }

  /* Landing header on iPad: hide numbered nav */
  .landingNav { display: none; }
  .hamburger { display: none; } /* hide hamburger on landing for iPad */

  /* Page padding for iPad */
  .page { padding: 20px 22px 48px; }

  /* Grids: adjust for narrower content area */
  .kpiGrid { grid-template-columns: repeat(3, 1fr); }
  .dashGrid { grid-template-columns: 1fr; }
  .teamGrid { grid-template-columns: 1fr; }
  .statGrid3 { grid-template-columns: 1fr 1fr; }
  .compareStatsRow { grid-template-columns: 1fr 1fr 1fr; }
}
```

- [ ] **Step 2: Verify visually at 768px (iPad portrait)**

In DevTools, set viewport to 768×1024 (iPad).

App tab checklist:
- [ ] Sidebar is visible and narrow (56px), shows only icons
- [ ] Content area takes remaining width
- [ ] Hamburger in topbar visible
- [ ] Tapping hamburger → full sidebar overlays from left
- [ ] Tapping backdrop → sidebar returns to icon-only
- [ ] No bottom bar visible

- [ ] **Step 3: Commit**

```bash
git add app/components/LandingPage.module.css
git commit -m "feat: add iPad portrait responsive rules (768-1024px)"
```

---

## Task 8: Light Mode + Final Polish

Ensure light mode looks correct at mobile/iPad breakpoints, and add any missing small fixes.

**Files:**
- Modify: `app/components/LandingPage.module.css`

- [ ] **Step 1: Light mode bottom bar**

The `.lightMode .bottomBar` rule was already added in Task 5. Verify it looks correct by toggling theme on mobile viewport in DevTools.

Expected: Bottom bar uses ivory background `rgba(255,253,248,.94)` instead of dark.

- [ ] **Step 2: Light mode hamburger**

Append to the light mode section:

```css
.lightMode .hamburger {
  background: rgba(26,24,20,.05);
  border-color: rgba(26,24,20,.12);
}
.lightMode .hamburger span { background: rgba(26,24,20,.8); }
```

- [ ] **Step 3: Final visual check — 3 viewports**

Open `http://localhost:3000`, check these 3 viewports:

**375px (iPhone):**
- Home tab: hero visible, no MetaRail, bottom bar present
- Evaluations tab: sidebar hidden, drawer opens/closes on ☰, bottom bar present
- Light mode: bottom bar ivory coloured

**768px (iPad portrait):**
- Icon-only sidebar visible (56px)
- ☰ in topbar opens full sidebar as overlay
- No bottom bar

**1280px (Desktop):**
- Zero visual changes from before — sidebar full, no hamburger visible, no bottom bar

- [ ] **Step 4: Commit and push**

```bash
git add app/components/LandingPage.module.css app/components/LandingPage.tsx
git commit -m "feat: responsive design — mobile bottom bar, iPad icon sidebar, drawer"
git push origin main
```
