# Quiniela Mundial 2026

Prediction league app for the FIFA World Cup 2026 group stage. Users join invite-only leagues, predict all 48 group stage matches before the tournament starts, and compete on a leaderboard.

## Tech Stack

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**
- **Supabase** (PostgreSQL + Realtime) — service role key used in API routes, anon key in client
- Custom username/password auth (bcryptjs, no Supabase Auth)
- State persistence via **localStorage** (user_id, player_id, league_id, etc.)
- Deploy target: **Vercel**

## Project Structure

```
app/
  page.tsx                  # Landing page (static)
  login/                    # Login form
  signup/                   # Registration form
  join/                     # Join league by invite code
  predictions/              # Main prediction interface (48 matches)
  leaderboard/              # Real-time standings
  admin/                    # Admin login + dashboard
  api/
    auth/signup|login       # Auth endpoints
    join/                   # Join league endpoint
    predictions/            # Upsert predictions
    admin/match|league|login # Admin: score matches, lock leagues
components/
  NavBar.tsx                # Top nav (auth-aware)
lib/
  supabase.ts               # Client + service role Supabase instances
  scoring.ts                # calculatePoints() function
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

**Tiebreaker**: most exact scores (6-pointers). This is reflected in the leaderboard `ORDER BY total_points DESC, exact_scores DESC`.

> **Note:** An "Único 6" bonus (8 pts for sole exact scorer) was explored and reverted. Keep scoring at 0/1/3/4/6 only.

## Database Schema (key tables)

- **users** — id, name, username (lowercase), password_hash, failed_attempts, locked_until
- **leagues** — id, name, invite_code (unique, case-insensitive), predictions_locked
- **players** — id, user_id, league_id, name — unique(league_id, user_id)
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
3. Predictions page loads all matches from Supabase, user fills scores
4. Save progress (partial) — no validation, always allowed until league locked
5. Final submit → POST `/api/predictions` with `submit: true` → enforces anti-algorithmic rules (see below)

**Anti-algorithmic submission rules** (enforced client + server on final submit only):
- At least **7 distinct scoreline patterns** in the bracket
- At least **5 of those** must appear 2+ times
- No single scoreline pattern can exceed **28 of 72 matches**
- At least **5 draws** must be predicted
- `1-0` and `0-1` are treated as the **same pattern** (normalized to lower-higher, e.g. `0-1`)
- Save progress bypasses these rules; only final submit enforces them

**Admin scoring a match:**
1. Admin submits result via dashboard → POST `/api/admin/match`
2. Server updates match (scores + status='finished')
3. Server fetches all predictions for that match, runs `calculatePoints()` on each
4. Upserts predictions with calculated points
5. Supabase Realtime triggers UPDATE event → leaderboard page auto-refreshes
6. Position deltas (▲/▼) are computed by comparing new ranks to previous ranks stored in `localStorage` under `leaderboard_prev_ranks` — persists across page refreshes, not just Realtime updates

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL          # Public
NEXT_PUBLIC_SUPABASE_ANON_KEY     # Public (safe for client)
SUPABASE_SERVICE_ROLE_KEY         # Server-only — never expose to client
ADMIN_SECRET                      # Server-only — protects admin endpoints
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

`lib/flags.ts` exports `FLAGS` (emoji) and `FLAG_ISO` (flagcdn.com codes) for all 48 teams. Team names in the DB must match the Spanish keys in `flags.ts` exactly.

## Styling Conventions

- Dark theme: `bg-gray-950` background, white text
- Custom Tailwind colors: `fifa-blue` (#003f7f), `fifa-red` (#c0392b), `fifa-gold` (#f1c40f)
- All styling via Tailwind utility classes — no CSS modules
- Root layout (`app/layout.tsx`) sets `text-gray-900` globally — pages with dark card backgrounds must explicitly set `text-white` on their root element to override

## Current Limitations

- League creation is admin/DB-only (no UI)
- Group stage only — no knockout rounds yet
- Match schedule is the real FIFA 2026 group stage draw (UTC times) — stored in `supabase/fix_and_seed.sql`
- `/reglas` page exists with scoring, submission rules, cost (Q150/$20), and a placeholder for special prizes
- No email verification or password recovery
- Scoring is manual (admin inputs results)
- No Stripe integration yet (fee collection is planned)
