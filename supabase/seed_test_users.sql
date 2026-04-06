-- ============================================================
-- Seed: 5 test users with random predictions
-- All users have password: test1234
-- Run AFTER matches_2026.sql
-- Requires pgcrypto (enabled by default in Supabase)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── 1. Insert users ──────────────────────────────────────────
INSERT INTO users (id, name, username, password_hash, failed_attempts)
VALUES
  ('11111111-0000-0000-0000-000000000001', 'Carlos López',   'carlos',   crypt('test1234', gen_salt('bf', 10)), 0),
  ('11111111-0000-0000-0000-000000000002', 'Valentina Ruiz', 'vale',     crypt('test1234', gen_salt('bf', 10)), 0),
  ('11111111-0000-0000-0000-000000000003', 'Diego Morales',  'diego',    crypt('test1234', gen_salt('bf', 10)), 0),
  ('11111111-0000-0000-0000-000000000004', 'Sofía Herrera',  'sofia',    crypt('test1234', gen_salt('bf', 10)), 0),
  ('11111111-0000-0000-0000-000000000005', 'Andrés Castro',  'andres',   crypt('test1234', gen_salt('bf', 10)), 0)
ON CONFLICT (id) DO NOTHING;

-- ── 2. Insert players into the first available league ────────
INSERT INTO players (id, league_id, user_id, name)
SELECT
  gen_random_uuid(),
  (SELECT id FROM leagues ORDER BY created_at LIMIT 1),
  u.id,
  u.name
FROM users u
WHERE u.id IN (
  '11111111-0000-0000-0000-000000000001',
  '11111111-0000-0000-0000-000000000002',
  '11111111-0000-0000-0000-000000000003',
  '11111111-0000-0000-0000-000000000004',
  '11111111-0000-0000-0000-000000000005'
)
ON CONFLICT (league_id, user_id) DO NOTHING;

-- ── 3. Insert random predictions for all 48 matches ─────────
-- Scores: 0–4 goals each side (weighted toward low-scoring realistic games)
INSERT INTO predictions (player_id, match_id, home_score, away_score)
SELECT
  p.id,
  m.id,
  floor(random() * 5)::int,   -- 0–4
  floor(random() * 4)::int    -- 0–3
FROM players p
CROSS JOIN matches m
WHERE p.user_id IN (
  '11111111-0000-0000-0000-000000000001',
  '11111111-0000-0000-0000-000000000002',
  '11111111-0000-0000-0000-000000000003',
  '11111111-0000-0000-0000-000000000004',
  '11111111-0000-0000-0000-000000000005'
)
ON CONFLICT (player_id, match_id) DO NOTHING;
