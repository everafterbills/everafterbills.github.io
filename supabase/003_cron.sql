-- Ever After — hourly reminder job (the notify function only sends between 8 and 11:59 AM New York time,
-- once per bill/kind/day thanks to private.notification_log)
select cron.unschedule(jobid) from cron.job where jobname = 'ever-after-reminders';
select cron.schedule('ever-after-reminders', '0 * * * *', $job$
  select net.http_post(
    url := 'https://qsaunieuztrbtbdbomie.supabase.co/functions/v1/notify',
    body := '{"action":"run"}'::jsonb,
    headers := jsonb_build_object('Content-Type','application/json','x-cron-key',
      (select decrypted_secret from vault.decrypted_secrets where name = 'ever_after_cron')),
    timeout_milliseconds := 30000);
$job$);
