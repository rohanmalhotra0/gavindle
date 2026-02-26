-- Gavindle leaderboard: one submission per player per day (date_key)
CREATE TABLE IF NOT EXISTS game_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_key text NOT NULL,
  player_key text NOT NULL,
  display_name text NOT NULL,
  result text NOT NULL CHECK (result IN ('win', 'loss')),
  guesses integer,
  created_at timestamptz DEFAULT now(),
  UNIQUE(date_key, player_key)
);

-- Index for fetching all results (leaderboard aggregation)
CREATE INDEX IF NOT EXISTS idx_game_results_player_key ON game_results(player_key);
CREATE INDEX IF NOT EXISTS idx_game_results_date_key ON game_results(date_key);

-- RLS: allow anonymous read and insert (public leaderboard)
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON game_results
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert" ON game_results
  FOR INSERT WITH CHECK (true);
