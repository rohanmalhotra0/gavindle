-- Class/group leaderboards and daily hints.
ALTER TABLE public.game_results ADD COLUMN IF NOT EXISTS hint_used boolean NOT NULL DEFAULT false;
ALTER TABLE public.game_results ADD COLUMN IF NOT EXISTS group_code text CHECK (group_code IS NULL OR group_code ~ '^[A-Z0-9]{2,12}$');
CREATE INDEX IF NOT EXISTS idx_game_results_group_code ON public.game_results(group_code);
