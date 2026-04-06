-- ============================================================
-- Quiniela Mundial 2026 — Supabase Schema
-- Run this in your Supabase SQL editor
-- ============================================================

-- Leagues
create table leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  predictions_locked boolean not null default false,
  created_at timestamptz not null default now()
);

-- Players (no auth — identified by name + league + stored in localStorage)
create table players (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique(league_id, name)
);

-- Matches (group stage only for now)
create table matches (
  id uuid primary key default gen_random_uuid(),
  matchday int not null,           -- 1, 2, 3
  round text not null default 'group', -- group | r16 | qf | sf | final
  "group" text,                    -- A, B, C ... L
  home_team text not null,
  away_team text not null,
  kickoff_at timestamptz not null,
  home_score int,                  -- null until match finished
  away_score int,                  -- null until match finished
  status text not null default 'upcoming' -- upcoming | live | finished
);

-- Predictions
create table predictions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  match_id uuid not null references matches(id) on delete cascade,
  home_score int not null,
  away_score int not null,
  points int,                      -- null until match is scored
  created_at timestamptz not null default now(),
  unique(player_id, match_id)
);

-- ============================================================
-- Leaderboard view
-- ============================================================
create or replace view leaderboard as
select
  p.id as player_id,
  p.league_id,
  p.name as player_name,
  coalesce(sum(pr.points), 0) as total_points,
  count(*) filter (where pr.points = 6) as exact_scores,
  count(*) filter (where pr.points in (3, 4)) as correct_results,
  count(*) filter (where pr.points is not null) as scored_predictions
from players p
left join predictions pr on pr.player_id = p.id
group by p.id, p.league_id, p.name;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table leagues enable row level security;
alter table players enable row level security;
alter table matches enable row level security;
alter table predictions enable row level security;

-- Anyone can read leagues (needed to validate invite codes)
create policy "leagues: public read" on leagues for select using (true);

-- Anyone can read players in any league
create policy "players: public read" on players for select using (true);

-- Anyone can join a league (insert a player)
create policy "players: public insert" on players for insert with check (true);

-- Anyone can read matches
create policy "matches: public read" on matches for select using (true);

-- Anyone can read predictions
create policy "predictions: public read" on predictions for select using (true);

-- Anyone can insert their own predictions (before lock)
create policy "predictions: public insert" on predictions for insert with check (true);

-- ============================================================
-- Seed: 2026 World Cup Group Stage Matches
-- Kickoff times in UTC. Tournament starts June 11, 2026.
-- 48 matches across 12 groups (A–L), 3 matchdays each.
-- ============================================================
-- NOTE: Official schedule TBD. Placeholder dates used.
-- Update kickoff_at once FIFA publishes the full schedule.

insert into matches (matchday, round, "group", home_team, away_team, kickoff_at) values
-- GROUP A
(1,'group','A','Mexico','Chile','2026-06-11 20:00:00+00'),
(1,'group','A','USA','Canada','2026-06-12 00:00:00+00'),
(2,'group','A','Mexico','Canada','2026-06-16 20:00:00+00'),
(2,'group','A','USA','Chile','2026-06-16 23:00:00+00'),
(3,'group','A','Canada','Chile','2026-06-20 20:00:00+00'),
(3,'group','A','USA','Mexico','2026-06-20 23:00:00+00'),
-- GROUP B
(1,'group','B','Argentina','Morocco','2026-06-12 20:00:00+00'),
(1,'group','B','Saudi Arabia','Egypt','2026-06-13 00:00:00+00'),
(2,'group','B','Argentina','Saudi Arabia','2026-06-17 20:00:00+00'),
(2,'group','B','Morocco','Egypt','2026-06-17 23:00:00+00'),
(3,'group','B','Egypt','Argentina','2026-06-21 20:00:00+00'),
(3,'group','B','Saudi Arabia','Morocco','2026-06-21 23:00:00+00'),
-- GROUP C
(1,'group','C','Spain','Brazil','2026-06-13 20:00:00+00'),
(1,'group','C','Japan','Senegal','2026-06-14 00:00:00+00'),
(2,'group','C','Spain','Japan','2026-06-18 20:00:00+00'),
(2,'group','C','Brazil','Senegal','2026-06-18 23:00:00+00'),
(3,'group','C','Senegal','Spain','2026-06-22 20:00:00+00'),
(3,'group','C','Brazil','Japan','2026-06-22 23:00:00+00'),
-- GROUP D
(1,'group','D','France','Germany','2026-06-14 20:00:00+00'),
(1,'group','D','Portugal','Belgium','2026-06-15 00:00:00+00'),
(2,'group','D','France','Portugal','2026-06-19 20:00:00+00'),
(2,'group','D','Germany','Belgium','2026-06-19 23:00:00+00'),
(3,'group','D','Belgium','France','2026-06-23 20:00:00+00'),
(3,'group','D','Germany','Portugal','2026-06-23 23:00:00+00'),
-- GROUP E
(1,'group','E','England','Netherlands','2026-06-15 20:00:00+00'),
(1,'group','E','Colombia','Ecuador','2026-06-16 00:00:00+00'),
(2,'group','E','England','Colombia','2026-06-20 16:00:00+00'),
(2,'group','E','Netherlands','Ecuador','2026-06-20 19:00:00+00'),
(3,'group','E','Ecuador','England','2026-06-24 20:00:00+00'),
(3,'group','E','Colombia','Netherlands','2026-06-24 23:00:00+00'),
-- GROUP F
(1,'group','F','Italy','Croatia','2026-06-16 16:00:00+00'),
(1,'group','F','Uruguay','South Korea','2026-06-16 19:00:00+00'),
(2,'group','F','Italy','Uruguay','2026-06-21 16:00:00+00'),
(2,'group','F','Croatia','South Korea','2026-06-21 19:00:00+00'),
(3,'group','F','South Korea','Italy','2026-06-25 20:00:00+00'),
(3,'group','F','Croatia','Uruguay','2026-06-25 23:00:00+00'),
-- GROUP G
(1,'group','G','Australia','Nigeria','2026-06-17 16:00:00+00'),
(1,'group','G','Serbia','Switzerland','2026-06-17 19:00:00+00'),
(2,'group','G','Australia','Serbia','2026-06-22 16:00:00+00'),
(2,'group','G','Nigeria','Switzerland','2026-06-22 19:00:00+00'),
(3,'group','G','Switzerland','Australia','2026-06-26 20:00:00+00'),
(3,'group','G','Nigeria','Serbia','2026-06-26 23:00:00+00'),
-- GROUP H
(1,'group','H','Denmark','Tunisia','2026-06-18 16:00:00+00'),
(1,'group','H','Poland','Cameroon','2026-06-18 19:00:00+00'),
(2,'group','H','Denmark','Poland','2026-06-23 16:00:00+00'),
(2,'group','H','Tunisia','Cameroon','2026-06-23 19:00:00+00'),
(3,'group','H','Cameroon','Denmark','2026-06-27 20:00:00+00'),
(3,'group','H','Tunisia','Poland','2026-06-27 23:00:00+00');
