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

Everything saves to `localStorage` (single device). All reads/writes go through
`src/store/storage.ts` — only those two functions (`load` / `save`) need to change
to move to a backend.

### Moving to Supabase (your existing stack)

1. `npm install @supabase/supabase-js`
2. Add env vars in `.env.local`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
3. Create a table, e.g. `workspaces (user_id uuid primary key, data jsonb)` with
   row-level security so each user only sees their own row.
4. Make `load()` / `save()` in `storage.ts` async (the commented sketch in that file
   shows the shape), then `await` them in `AppContext` (`init` becomes an effect that
   loads on mount). The rest of the app is untouched because nothing else reads storage.

## Deploy to Vercel

Push to GitHub, import the repo in Vercel. It auto-detects Vite — build command
`npm run build`, output directory `dist`. Add the Supabase env vars in the Vercel
project settings once you wire the backend.
