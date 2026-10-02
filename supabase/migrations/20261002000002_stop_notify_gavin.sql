-- Stop emailing Gavin about leaderboard results.
DROP TRIGGER IF EXISTS notify_gavin_on_result ON public.game_results;
DROP FUNCTION IF EXISTS public.notify_gavin_of_result();
