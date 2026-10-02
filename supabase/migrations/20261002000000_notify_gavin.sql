-- Email Gavin every new leaderboard result (one per player per day).
-- Uses FormSubmit (free, no account). The first email asks the inbox owner
-- to click "Activate"; after that every result is delivered.
-- The address lives only in this server-side function, never in site code.
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_gavin_of_result()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://formsubmit.co/ajax/gavinlacy321@gmail.com',
    headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb,
    body := jsonb_build_object(
      '_subject', 'Gavindle: ' || NEW.display_name || CASE
        WHEN NEW.result = 'win' THEN ' won in ' || NEW.guesses || '/6'
        ELSE ' lost (X/6)'
      END,
      '_template', 'table',
      '_captcha', 'false',
      'Player', NEW.display_name,
      'Result', CASE WHEN NEW.result = 'win' THEN 'Win' ELSE 'Loss' END,
      'Guesses', COALESCE(NEW.guesses::text, 'X'),
      'Day', NEW.date_key
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block a leaderboard submission because email failed.
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_gavin_of_result() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS notify_gavin_on_result ON public.game_results;
CREATE TRIGGER notify_gavin_on_result
  AFTER INSERT ON public.game_results
  FOR EACH ROW EXECUTE FUNCTION public.notify_gavin_of_result();
