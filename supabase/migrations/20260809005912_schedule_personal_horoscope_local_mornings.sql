do $$
declare
  existing_job bigint;
begin
  for existing_job in
    select jobid
      from cron.job
     where jobname = 'nastardamus-daily-horoscope'
  loop
    perform cron.unschedule(existing_job);
  end loop;
end;
$$;

select cron.schedule(
  'nastardamus-daily-horoscope',
  '*/10 * * * *',
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
