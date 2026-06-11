-- Run this in your Supabase SQL editor
-- Aggregates rondas/goles data server-side to avoid PostgREST row limits

-- Returns total points + exact scores per player per matchday
-- Max rows returned: players × 3 matchdays (e.g. 39 × 3 = 117 rows)
CREATE OR REPLACE FUNCTION get_rondas_points(p_league_id uuid)
RETURNS TABLE(
  player_id uuid,
  player_name text,
  matchday integer,
  points integer,
  exact_scores integer
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    pl.id             AS player_id,
    pl.name           AS player_name,
    m.matchday::integer,
    COALESCE(SUM(pred.points), 0)::integer                         AS points,
    COUNT(CASE WHEN pred.points = 6 THEN 1 END)::integer           AS exact_scores
  FROM players pl
  JOIN predictions pred ON pred.player_id = pl.id
  JOIN matches     m    ON m.id = pred.match_id
  WHERE pl.league_id = p_league_id
    AND pl.paid = true
  GROUP BY pl.id, pl.name, m.matchday
$$;

-- Returns predicted goals per player: finished matches only vs all 72
-- Max rows returned: number of paid players (e.g. 39 rows)
CREATE OR REPLACE FUNCTION get_goles_data(p_league_id uuid)
RETURNS TABLE(
  player_id        uuid,
  player_name      text,
  predicted_current integer,
  predicted_total   integer
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    pl.id   AS player_id,
    pl.name AS player_name,
    COALESCE(SUM(CASE WHEN m.status = 'finished'
                      THEN pred.home_score + pred.away_score
                      ELSE 0 END), 0)::integer              AS predicted_current,
    COALESCE(SUM(pred.home_score + pred.away_score), 0)::integer AS predicted_total
  FROM players pl
  JOIN predictions pred ON pred.player_id = pl.id
  JOIN matches     m    ON m.id = pred.match_id
  WHERE pl.league_id = p_league_id
    AND pl.paid = true
  GROUP BY pl.id, pl.name
$$;
