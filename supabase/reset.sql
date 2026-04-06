-- ============================================================
-- RESET — Wipe all users, players, predictions. Keep leagues.
-- Run this in the Supabase SQL Editor.
-- ============================================================

TRUNCATE predictions CASCADE;
TRUNCATE players CASCADE;
TRUNCATE users CASCADE;

-- ============================================================
-- Re-insert all 48 matches with Spanish team names
-- ============================================================

TRUNCATE matches CASCADE;

INSERT INTO matches (matchday, round, "group", home_team, away_team, kickoff_at) VALUES
-- GRUPO A
(1,'group','A','México',          'Sudáfrica',           '2026-06-11 19:00:00+00'),
(1,'group','A','Corea del Sur',   'Chequia',             '2026-06-12 02:00:00+00'),
(2,'group','A','Chequia',         'Sudáfrica',           '2026-06-18 16:00:00+00'),
(2,'group','A','México',          'Corea del Sur',       '2026-06-19 01:00:00+00'),
(3,'group','A','Chequia',         'México',              '2026-06-25 01:00:00+00'),
(3,'group','A','Sudáfrica',       'Corea del Sur',       '2026-06-25 01:00:00+00'),
-- GRUPO B
(1,'group','B','Canadá',          'Bosnia y Herzegovina','2026-06-12 19:00:00+00'),
(1,'group','B','Catar',           'Suiza',               '2026-06-13 19:00:00+00'),
(2,'group','B','Suiza',           'Bosnia y Herzegovina','2026-06-18 19:00:00+00'),
(2,'group','B','Canadá',          'Catar',               '2026-06-18 22:00:00+00'),
(3,'group','B','Suiza',           'Canadá',              '2026-06-24 19:00:00+00'),
(3,'group','B','Bosnia y Herzegovina','Catar',           '2026-06-24 19:00:00+00'),
-- GRUPO C
(1,'group','C','Brasil',          'Marruecos',           '2026-06-13 22:00:00+00'),
(1,'group','C','Haití',           'Escocia',             '2026-06-14 01:00:00+00'),
(2,'group','C','Escocia',         'Marruecos',           '2026-06-19 22:00:00+00'),
(2,'group','C','Brasil',          'Haití',               '2026-06-20 01:00:00+00'),
(3,'group','C','Escocia',         'Brasil',              '2026-06-24 22:00:00+00'),
(3,'group','C','Marruecos',       'Haití',               '2026-06-24 22:00:00+00'),
-- GRUPO D
(1,'group','D','Estados Unidos',  'Paraguay',            '2026-06-13 01:00:00+00'),
(1,'group','D','Australia',       'Turquía',             '2026-06-13 04:00:00+00'),
(2,'group','D','Estados Unidos',  'Australia',           '2026-06-19 19:00:00+00'),
(2,'group','D','Turquía',         'Paraguay',            '2026-06-20 04:00:00+00'),
(3,'group','D','Turquía',         'Estados Unidos',      '2026-06-26 02:00:00+00'),
(3,'group','D','Paraguay',        'Australia',           '2026-06-26 02:00:00+00'),
-- GRUPO E
(1,'group','E','Alemania',        'Curazao',             '2026-06-14 17:00:00+00'),
(1,'group','E','Costa de Marfil', 'Ecuador',             '2026-06-14 23:00:00+00'),
(2,'group','E','Alemania',        'Costa de Marfil',     '2026-06-20 20:00:00+00'),
(2,'group','E','Ecuador',         'Curazao',             '2026-06-21 00:00:00+00'),
(3,'group','E','Ecuador',         'Alemania',            '2026-06-25 20:00:00+00'),
(3,'group','E','Curazao',         'Costa de Marfil',     '2026-06-25 20:00:00+00'),
-- GRUPO F
(1,'group','F','Países Bajos',    'Japón',               '2026-06-14 20:00:00+00'),
(1,'group','F','Suecia',          'Túnez',               '2026-06-15 02:00:00+00'),
(2,'group','F','Países Bajos',    'Suecia',              '2026-06-20 17:00:00+00'),
(2,'group','F','Túnez',           'Japón',               '2026-06-21 04:00:00+00'),
(3,'group','F','Japón',           'Suecia',              '2026-06-25 23:00:00+00'),
(3,'group','F','Túnez',           'Países Bajos',        '2026-06-25 23:00:00+00'),
-- GRUPO G
(1,'group','G','Bélgica',         'Egipto',              '2026-06-15 19:00:00+00'),
(1,'group','G','Irán',            'Nueva Zelanda',       '2026-06-16 01:00:00+00'),
(2,'group','G','Bélgica',         'Irán',                '2026-06-21 19:00:00+00'),
(2,'group','G','Nueva Zelanda',   'Egipto',              '2026-06-22 01:00:00+00'),
(3,'group','G','Egipto',          'Irán',                '2026-06-27 03:00:00+00'),
(3,'group','G','Nueva Zelanda',   'Bélgica',             '2026-06-27 03:00:00+00'),
-- GRUPO H
(1,'group','H','España',          'Cabo Verde',          '2026-06-15 16:00:00+00'),
(1,'group','H','Arabia Saudita',  'Uruguay',             '2026-06-15 22:00:00+00'),
(2,'group','H','España',          'Arabia Saudita',      '2026-06-21 16:00:00+00'),
(2,'group','H','Uruguay',         'Cabo Verde',          '2026-06-21 22:00:00+00'),
(3,'group','H','Cabo Verde',      'Arabia Saudita',      '2026-06-27 00:00:00+00'),
(3,'group','H','Uruguay',         'España',              '2026-06-27 00:00:00+00'),
-- GRUPO I
(1,'group','I','Francia',         'Senegal',             '2026-06-16 19:00:00+00'),
(1,'group','I','Irak',            'Noruega',             '2026-06-16 22:00:00+00'),
(2,'group','I','Francia',         'Irak',                '2026-06-22 21:00:00+00'),
(2,'group','I','Noruega',         'Senegal',             '2026-06-23 00:00:00+00'),
(3,'group','I','Noruega',         'Francia',             '2026-06-26 19:00:00+00'),
(3,'group','I','Senegal',         'Irak',                '2026-06-26 19:00:00+00'),
-- GRUPO J
(1,'group','J','Argentina',       'Argelia',             '2026-06-17 01:00:00+00'),
(1,'group','J','Austria',         'Jordania',            '2026-06-17 04:00:00+00'),
(2,'group','J','Argentina',       'Austria',             '2026-06-22 17:00:00+00'),
(2,'group','J','Jordania',        'Argelia',             '2026-06-23 03:00:00+00'),
(3,'group','J','Argelia',         'Austria',             '2026-06-28 02:00:00+00'),
(3,'group','J','Jordania',        'Argentina',           '2026-06-28 02:00:00+00'),
-- GRUPO K
(1,'group','K','Portugal',        'RD Congo',            '2026-06-17 17:00:00+00'),
(1,'group','K','Uzbekistán',      'Colombia',            '2026-06-18 02:00:00+00'),
(2,'group','K','Portugal',        'Uzbekistán',          '2026-06-23 17:00:00+00'),
(2,'group','K','Colombia',        'RD Congo',            '2026-06-24 02:00:00+00'),
(3,'group','K','Colombia',        'Portugal',            '2026-06-27 23:30:00+00'),
(3,'group','K','RD Congo',        'Uzbekistán',          '2026-06-27 23:30:00+00'),
-- GRUPO L
(1,'group','L','Inglaterra',      'Croacia',             '2026-06-17 20:00:00+00'),
(1,'group','L','Ghana',           'Panamá',              '2026-06-17 23:00:00+00'),
(2,'group','L','Inglaterra',      'Ghana',               '2026-06-23 20:00:00+00'),
(2,'group','L','Panamá',          'Croacia',             '2026-06-23 23:00:00+00'),
(3,'group','L','Panamá',          'Inglaterra',          '2026-06-27 21:00:00+00'),
(3,'group','L','Croacia',         'Ghana',               '2026-06-27 21:00:00+00');
