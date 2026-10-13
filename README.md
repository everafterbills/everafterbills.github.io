# Ever After

Nick and Courtney's bills, together. A private home-screen web app (PWA) hosted on GitHub Pages with a Supabase backend.

## How it fits together

- **`app/`**: React + Vite front end. Pushing to `main` builds and deploys to https://everafterbills.github.io via GitHub Actions.
- **`supabase/001_schema.sql`**: tables, row-level security, and the database functions behind sign-in, encrypted logins and reminders.
- **`supabase/003_cron.sql`**: the hourly job that triggers 8 AM reminders.
- **`supabase/functions/`**: edge functions `auth` (household setup, trusted devices, PIN sign-in, PIN changes) and `notify` (Web Push).

No bill data, PINs, keys or passwords live in this repository. Everything personal is in Supabase, behind row-level security, and saved logins are encrypted with a key that never leaves the database.

## Security model

- A device must be trusted once with the household key before anyone can try a PIN on it.
- PINs are bcrypt-hashed. Five wrong PINs lock the device for 5 minutes, then 30; fifteen remove the device.
- Each person sees both people's bills but can only change their own, and only the owner can read a bill's saved login.
- Public sign-ups are off; the browser key can't read anything without a signed-in household member.
- Strict Content Security Policy, no third-party scripts or fonts, and the app refuses to load inside frames.

## Releasing an update

1. Make the change in `app/`.
2. Bump `VERSION` in `app/src/config.js` and add a new entry at the top of `app/src/changelog.js`.
3. Bump `CACHE` in `app/public/sw.js` so phones pick up the new version.
4. Push to `main`.

## Local development

```bash
cd app
npm install
npm run dev            # http://localhost:5173 (add ?demo for sample data)
npm run icons          # regenerate the logo, icons and launch screens
```
