# Flowdeck

A workflow tracker — Vercel-style overview, agile board, and a feature map.
Vite + React + TypeScript.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build into /dist
npm run preview  # serve the built /dist locally
```

## What's inside

- **Overview** — project cards + workspace snapshot, search, grid/list toggle.
- **Personal / Professional** workspaces (top-left switcher). Professional projects carry a client.
- **Board** — agile kanban with sprints, drag-and-drop (`@dnd-kit`), and tasks split into checkable "pieces" with a segmented progress bar.
- **Map** — a feature canvas (`@xyflow/react`): drag nodes, wire them together, pan/zoom.
- **Backlog** — a lightweight personal to-do board.

## Structure

```
src/
  types.ts                 data model
  lib/helpers.ts           constants + derived stats (progress, status)
  store/
    storage.ts             persistence (localStorage; Supabase-ready)
    seed.ts                first-run data + migration
    AppContext.tsx         app state + the mutate() helper, persisted on change
  components/
    TopBar.tsx             logo, workspace switcher, nav, clock
    Overview.tsx           landing grid + sidebar
    ProjectDetail.tsx      rail + header + Board/Map tabs
    Board.tsx              sprint bar, pipeline, dnd-kit kanban
    FlowMap.tsx            xyflow feature canvas + custom node
    Backlog.tsx            personal board
    Modals.tsx             project / sprint / task / node / backlog forms
  index.css                all styling + xyflow dark theme
```

## Persistence

The app works two ways, decided automatically by whether the Supabase env vars are set:

- **No env vars** → `localStorage` (single device, no login). Good for `npm run dev` right away.
- **Env vars set** → Supabase Postgres + auth, synced across devices, scoped per user.

All reads/writes go through `src/store/storage.ts`. Your whole app state is stored as one
JSONB row per user in a `workspaces` table — simple, and it preserves the app's data shape.
(If you ever outgrow it, you can normalise into per-entity tables; nothing else in the app
reads storage directly.)

## Connect Supabase

1. Create a project at supabase.com.
2. **Run the schema**: Dashboard → SQL Editor → paste `supabase/schema.sql` → Run. This
   creates the `workspaces` table and the row-level-security policies that lock each row to
   its owner.
3. **Auth**: Dashboard → Authentication → Providers → Email is on by default. For instant
   solo testing, turn **off** "Confirm email" (Authentication → Sign In / Providers) so a new
   account logs in immediately; otherwise confirm via the emailed link before signing in.
4. **Env vars**: copy `.env.example` to `.env.local` and fill in from
   Project Settings → API:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
5. `npm run dev` — you'll now get a login screen, and your data saves to Supabase
   (debounced ~0.6s after changes).

## Deploy to Vercel

Push to GitHub, import the repo in Vercel (auto-detects Vite: build `npm run build`, output
`dist`). Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project's
Environment Variables, then deploy. Add your deployed URL to Supabase →
Authentication → URL Configuration so auth redirects resolve.
