# Quiniela Mundial 2026

Prediction league app for the FIFA World Cup 2026 group stage. Users join invite-only leagues, predict all 48 group stage matches before the tournament starts, and compete on a leaderboard.

## Tech Stack

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**
- **Supabase** (PostgreSQL + Realtime + Storage) — service role key used in API routes, anon key in client
- Custom username/password auth (bcryptjs, no Supabase Auth)
- State persistence via **localStorage** (user_id, player_id, league_id, etc.)
- Deploy target: **Vercel** (with cron jobs)

## Project Structure

```
app/
  page.tsx                  # Landing page — shows auth buttons or "Mis predicciones/Ver tabla" when logged in
  login/                    # Login form
  signup/                   # Registration form
  join/                     # Join league by invite code
  predictions/              # Main prediction interface (48 matches) + projected group standings
  leaderboard/              # Real-time standings + Único 6 tracker + expandable player brackets
  rondas/                   # Per-round (matchday) leaderboard — Q150 prize per jornada
  goles/                    # Tournament goals tracker — predicted vs actual, closest to 0 wins
  ultimo-cero/              # Last player without a 0-point match — survival game
  reglas/                   # Rules, scoring, prizes, cost, anti-algo warning
  admin/                    # Admin login
  admin/dashboard/          # Admin dashboard: score matches, sync scores, lock leagues, mark payments
  api/
    auth/signup|login       # Auth endpoints
    join/                   # Join league endpoint
    predictions/            # Upsert predictions
    avatar/                 # POST: upload player photo to Supabase Storage (bucket: Avatar)
    leaderboard/            # GET: leaderboard data (API route)
    admin/match             # Score a single match manually
    admin/league            # Lock/unlock league
    admin/login             # Admin auth
    admin/payment           # Mark player as paid/unpaid
    admin/live-score        # Sync scores from football-data.org (manual trigger)
    admin/user              # Admin user management
    cron/sync-scores        # GET: Vercel cron — auto-syncs WC results every 5 min
components/
  BottomNav.tsx             # Mobile bottom nav (md:hidden) with horizontal scroll — 7 tabs + account
  NavBar.tsx                # Top nav (auth-aware), hidden on mobile
  FlagImg.tsx               # Team flag image via flagcdn.com (falls back to ⚽)
  HeroCTA.tsx               # Landing page hero CTA
lib/
  supabase.ts               # Client + service role Supabase instances
  scoring.ts                # calculatePoints() function
  flags.ts                  # FLAGS (emoji) + FLAG_ISO + flagUrl() for all 48 teams
  team-map.ts               # resolveTeam(): maps football-data.org English names → Spanish DB names
types/
  index.ts                  # Match, League, Player, Prediction, LeaderboardEntry
supabase/
  schema.sql                # Full DB schema + seed data
```

## Scoring Logic (`lib/scoring.ts`)

`calculatePoints(actualHome, actualAway, predictedHome, predictedAway): 0 | 1 | 3 | 4 | 6`

| Condition | Points |
|-----------|--------|
| Exact score | 6 |
| Correct result (W/D/L) + correct draw (wrong score) | 4 |
| Correct result + 1 goal correct | 4 |
| Correct result + 0 goals correct | 3 |
| Wrong result + 1 goal correct | 1 |
| Wrong result + 0 goals correct | 0 |

**Tiebreaker**: most exact scores (6-pointers). Reflected in leaderboard `ORDER BY total_points DESC, exact_scores DESC`.

> **Note:** An "Único 6" bonus (8 pts for sole exact scorer) was explored and reverted. Keep scoring at 0/1/3/4/6 only. The leaderboard shows a separate "Único 6" tracker (informational only, no points change).

## Database Schema (key tables)

- **users** — id, name, username (lowercase), password_hash, failed_attempts, locked_until
- **leagues** — id, name, invite_code (unique, case-insensitive), predictions_locked
- **players** — id, user_id, league_id, name, paid (bool) — unique(league_id, user_id)
- **matches** — id, matchday (1-3), round, group (A-L), home_team, away_team, kickoff_at, home_score, away_score, status (upcoming/live/finished)
- **predictions** — id, player_id, match_id, home_score, away_score, points (null until match finishes) — unique(player_id, match_id)
- **leaderboard** — SQL VIEW joining players + predictions, aggregates total_points, exact_scores, correct_results

All tables have RLS enabled with public read. Admin operations are protected by `ADMIN_SECRET`.

## Auth & Authorization

- No Supabase Auth — custom `users` table with bcrypt hashed passwords
- Account lockout after 5 failed login attempts (15-min lock)
- Admin panel uses a shared `ADMIN_SECRET` env var (checked server-side)
- API routes that write data use the **service role key** to bypass RLS

## Key Flows

**Signup → Join → Predict:**
1. POST `/api/auth/signup` → creates user → saves user_id to localStorage
2. POST `/api/join` (user_id + invite_code) → creates player → saves player_id, league_id
3. Player must upload a profile photo (stored in Supabase Storage bucket `Avatar` by player_id) before final submit
4. Player must be marked as `paid = true` by admin before final submit is allowed
5. Predictions page loads all matches + projected group standings
6. Save progress (partial) — no validation, always allowed until league locked
7. Final submit → POST `/api/predictions` with `submit: true` → enforces anti-algorithmic rules (see below)

**Anti-algorithmic submission rules** (enforced client + server on final submit only):
- At least **7 distinct scoreline patterns** in the bracket
- At least **5 of those** must appear 2+ times
- No single scoreline pattern can exceed **28 of 72 matches**
- At least **5 draws** must be predicted
- `1-0` and `0-1` are treated as the **same pattern** (normalized to lower-higher, e.g. `0-1`)
- Save progress bypasses these rules; only final submit enforces them
- Submission rules are hidden from `/reglas` by default; shown inline only when algo validation fails

**Admin scoring a match:**
1. Admin submits result via dashboard → POST `/api/admin/match`
2. Server updates match (scores + status='finished')
3. Server fetches all predictions for that match, runs `calculatePoints()` on each
4. Upserts predictions with calculated points
5. Supabase Realtime triggers UPDATE event → leaderboard page auto-refreshes
6. Position deltas (▲/▼) computed by comparing new ranks to previous ranks stored in `localStorage` under `leaderboard_prev_ranks`

**Auto-scoring (Vercel cron):**
- `/api/cron/sync-scores` runs every 5 minutes via Vercel cron
- Fetches finished WC matches from `football-data.org` API
- Uses `lib/team-map.ts` (`resolveTeam()`) to map English team names → Spanish DB names
- Only processes matches not yet `finished` in the DB to avoid double-scoring
- Protected by `CRON_SECRET` env var (Vercel passes as Bearer token)
- Admin dashboard also has a "Sync Scores" button that calls `/api/admin/live-score` manually

**Leaderboard extras:**
- Only shows players who have submitted their full bracket (72 predictions)
- Expandable rows: click a player to see their full prediction grid with flags
- Único 6 tracker: shows matches where only one player predicted the exact score
- Other players' predictions hidden until the league is locked

## Special Prize Tabs

| Tab | Route | Description |
|-----|-------|-------------|
| Rondas | `/rondas` | Per-matchday leaderboard. Prize: Q150/$20 per jornada winner. Auto-selects in-progress round. |
| Goles | `/goles` | Total tournament goals. Player closest to actual total wins. Prize: Q150/$20. Hidden until tournament starts. |
| Último 0 | `/ultimo-cero` | Survival: last player without a 0-point match. Shows alive vs eliminated with first-zero match detail. Prize: Q150/$20. |

## Navigation

- **BottomNav** (`components/BottomNav.tsx`): mobile-only (`md:hidden`), fixed bottom, horizontally scrollable. Tabs: Inicio, Tabla, Quiniela, Rondas, Goles, Último 0, Reglas, + Account (avatar initial or 👤).
- **NavBar** (`components/NavBar.tsx`): desktop top nav, hidden on mobile.
- Auth state updates dispatch a `quinielaauth` custom event so both navs update without page reload.

## Player Avatars

- Uploaded via POST `/api/avatar` (multipart form, fields: `file`, `player_id`)
- Stored in Supabase Storage bucket named `Avatar` (capital A) — keyed by `player_id` (no extension)
- Displayed in leaderboard, rondas, goles, and ultimo-cero pages
- Required before final submission — predictions page blocks final submit if no photo uploaded
- `FlagImg` component handles team flags separately via `flagUrl()` from `lib/flags.ts`

## Payment Tracking

- `players.paid` boolean column tracked in DB
- Admin dashboard can mark players as paid/unpaid via POST `/api/admin/payment`
- Final bracket submission is blocked client-side if `paid !== true`
- No Stripe integration — payment is manual (WhatsApp comprobante)

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL          # Public
NEXT_PUBLIC_SUPABASE_ANON_KEY     # Public (safe for client)
SUPABASE_SERVICE_ROLE_KEY         # Server-only — never expose to client
ADMIN_SECRET                      # Server-only — protects admin endpoints
CRON_SECRET                       # Server-only — Vercel cron auth token
FOOTBALL_DATA_API_KEY             # Server-only — football-data.org API key for auto-scoring
```

## Team Names & Flags (`lib/flags.ts`)

All team names are in **Spanish**. All 48 teams are finalized (April 2026). The 6 playoff spots resolved as:

| Placeholder | Team (ES) | Group |
|---|---|---|
| UEFA Playoff A | Bosnia y Herzegovina | B |
| UEFA Playoff B | Suecia | F |
| UEFA Playoff C | Turquía | D |
| UEFA Playoff D | Chequia | A |
| Playoff IC-1 | RD Congo | K |
| Playoff IC-2 | Irak | I |

`lib/flags.ts` exports `FLAGS` (emoji), `FLAG_ISO` (flagcdn.com codes), and `flagUrl()` for all 48 teams.
`lib/team-map.ts` maps football-data.org English names → Spanish names for the cron auto-scorer.
Team names in the DB must match the Spanish keys in `flags.ts` exactly.

## Styling Conventions

- Light theme on cards: `bg-white` cards on `bg-gray-50` or white page background
- Custom Tailwind colors: `fifa-blue` (#003f7f), `fifa-red` (#c0392b), `fifa-gold` (#f1c40f)
- All styling via Tailwind utility classes — no CSS modules
- Root layout (`app/layout.tsx`) sets `text-gray-900` globally
- Cards use `rounded-2xl border border-gray-200 shadow-sm` pattern throughout
- Active/selected state: `bg-fifa-blue text-white`; "me" highlight: `border-fifa-blue/30` or `text-fifa-blue`
- PWA metadata configured: manifest, apple-web-app tags, theme-color, viewport

## Current Limitations

- League creation is admin/DB-only (no UI)
- Group stage only — no knockout rounds yet
- Match schedule is the real FIFA 2026 group stage draw (UTC times) — stored in `supabase/fix_and_seed.sql`
- No email verification or password recovery
- Payment collection is manual (no Stripe)
- Leaderboard only shows submitted players (72 predictions); partial bracketers are invisible
