-- Upsert requires UPDATE when (date_key, player_key) already exists (resubmit same day)
CREATE POLICY "Allow public update" ON game_results
  FOR UPDATE USING (true) WITH CHECK (true);
