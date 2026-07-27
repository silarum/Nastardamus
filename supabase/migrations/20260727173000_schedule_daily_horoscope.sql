create extension if not exists pg_net with schema extensions;

do $$
declare
  existing_job bigint;
begin
  select jobid
    into existing_job
    from cron.job
   where jobname = 'nastardamus-daily-horoscope'
   limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
end;
$$;

select cron.schedule(
  'nastardamus-daily-horoscope',
  '0 7 * * *',
  $$
  select net.http_get(
    url := 'https://nastardamus.vercel.app/api/daily-horoscope',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || coalesce(
        (
          select decrypted_secret
            from vault.decrypted_secrets
           where name = 'nastardamus_daily_horoscope_cron'
           limit 1
        ),
        ''
      )
    ),
    timeout_milliseconds := 50000
  ) as request_id;
  $$
);
