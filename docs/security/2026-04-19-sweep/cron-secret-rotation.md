# CRON_SECRET rotation

Every Vercel cron entry point checks
`Authorization: Bearer $CRON_SECRET`. The header is injected by Vercel
when the env var is set on the project. Rotation procedure:

1. Generate a new secret:
   `openssl rand -base64 32 | tr -d '/+=\n' | head -c 40`
2. Set the value on Vercel for Production, Preview, and Development:
   `vercel env add CRON_SECRET production`
   (repeat for `preview` and `development`, or copy through the dashboard).
3. Redeploy production.
   Vercel picks up the new value on next deploy; crons keep running
   without a reschedule.
4. Verify with `curl`:
   - `curl -I https://lanaehealth.vercel.app/api/sync` returns `401`.
   - `curl -I -H "Authorization: Bearer $NEW" https://lanaehealth.vercel.app/api/sync`
     returns `200`.
5. There is no "old secret accepted for 24h" window. The rotation is
   atomic across all cron routes because every route reads the env
   var per request.

Rotate at least yearly, or immediately if any of:

- The Vercel account is compromised.
- A deployment log leaks the bearer token.
- A contractor with Vercel env-var access is off-boarded.

Audit trail: write the rotation date into `docs/security/ops-log.md`
(created by Track D).
