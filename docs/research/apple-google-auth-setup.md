# Apple + Google Sign In setup

This document covers the credentials and configuration required to
turn on the Apple and Google sign-in buttons on /v2/login and
/v2/signup. The buttons are already wired through Supabase Auth, so
once the providers are enabled in the Supabase dashboard everything
just works.

The repo also ships WebAuthn / passkey sign-in (Face ID, Touch ID,
Windows Hello) which needs no external credentials at all. See the
"Passkeys" section at the bottom.

## Apple Sign In

Apple Sign In requires a paid Apple Developer Program account
($99/yr). Once you have that, the provider takes about 30 minutes
to wire up.

### What you need to create

1. **Apple Developer Program account.** https://developer.apple.com/programs/
2. **An App ID** with the "Sign In with Apple" capability enabled.
   - In Apple Developer portal -> Certificates, IDs & Profiles -> Identifiers
   - Click + -> App IDs -> App
   - Bundle ID: `com.lanaehealth.web` (or your reverse-domain choice)
   - Capabilities: tick "Sign In with Apple"
3. **A Services ID** (this is what Supabase actually uses).
   - Identifiers -> + -> Services IDs
   - Description: "LanaeHealth Web"
   - Identifier: `com.lanaehealth.web.signin`
   - Tick "Sign In with Apple", then click "Configure"
   - Primary App ID: select the App ID from step 2
   - Web Domain: your production domain (e.g. `lanaehealth.vercel.app`)
   - Return URLs: `https://dmvzonbqbkfptkfrsfuz.supabase.co/auth/v1/callback`
4. **A Sign in with Apple Private Key.**
   - Keys -> + -> "Sign in with Apple"
   - Configure -> select your Primary App ID
   - Download the .p8 file. Apple only lets you download it once. Store
     it in 1Password.
   - Note the Key ID shown on the key page (10 characters).
5. **Your Team ID.**
   - Visible at the top right of the Apple Developer portal.

### What to paste into Supabase

Supabase Dashboard -> Authentication -> Providers -> Apple. Toggle on
and fill in:

- **Services ID:** the identifier from step 3 (e.g. `com.lanaehealth.web.signin`)
- **Team ID:** from step 5
- **Key ID:** from step 4
- **Secret Key (.p8):** paste the full contents of the .p8 file,
  including the `-----BEGIN PRIVATE KEY-----` lines.

Click Save. The Apple button on /v2/login now works end to end.

### Common gotchas

- Apple requires the redirect URL to use HTTPS with a non-localhost
  domain. For local development, use a tunnel (ngrok, Cloudflare
  Tunnel) or test against your Vercel preview deploy.
- Email relay: Apple may give the user a private relay email
  (`xyz@privaterelay.appleid.com`). That is fine. Treat it as a
  normal email; replies go through Apple's relay.
- The first time a user signs in, Apple sends the email and name in
  the response. Subsequent sign-ins do not. Store what you receive on
  first sign-in.

## Google Sign In

Google needs a Google Cloud project and an OAuth 2.0 Client ID. No
paid account required.

### What you need to create

1. **Google Cloud Console -> APIs & Services -> Credentials.**
   https://console.cloud.google.com/apis/credentials
2. **OAuth consent screen** (one-time setup).
   - User Type: External (unless you are on Google Workspace)
   - App name: LanaeHealth
   - User support email: stockcryptobots@gmail.com
   - Authorized domains: `vercel.app`, your custom domain if any
   - Developer contact email: stockcryptobots@gmail.com
   - Scopes: leave default (email, profile, openid)
3. **Create OAuth 2.0 Client ID.**
   - Credentials -> + Create credentials -> OAuth client ID
   - Application type: Web application
   - Name: LanaeHealth Web
   - Authorized JavaScript origins:
     - `https://lanaehealth.vercel.app`
     - `http://localhost:3005`
   - Authorized redirect URIs:
     - `https://dmvzonbqbkfptkfrsfuz.supabase.co/auth/v1/callback`
4. **Save the Client ID and Client Secret.**

### What to paste into Supabase

Supabase Dashboard -> Authentication -> Providers -> Google. Toggle
on and fill in:

- **Client ID:** from step 4
- **Client Secret:** from step 4

Click Save. The Google button on /v2/login now works end to end.

### Common gotchas

- The redirect URI in Google Cloud must match the Supabase callback
  exactly. Trailing slash matters.
- If you change the Supabase project (rare), the redirect URI changes
  and Google sign-in stops working until you update Google Cloud.

## Passkeys (Face ID / Touch ID / Windows Hello)

No external setup required. We use the browser's built-in WebAuthn
support. Once a user is signed in (any method), they can add a
passkey at /v2/settings -> Security. The next time they visit
/v2/login the "Use a passkey" button prompts the device's biometric
sensor.

### What is required

- A modern browser. Safari 16+, Chrome 108+, Firefox 122+, Edge 108+.
- An OS that ships a WebAuthn authenticator. iOS, macOS, Windows 11,
  Windows 10 22H2+, Android 9+ all qualify.
- HTTPS in production. Localhost is exempt; everywhere else must be
  HTTPS or the browser refuses to expose `navigator.credentials`.

### How it works

- Storage: `passkey_credentials` and `passkey_challenges` (migration 043)
- Server: `src/lib/auth/passkey.ts`, routes under
  `src/app/api/auth/passkey/{register,authenticate,list}/route.ts`
- Browser: `@simplewebauthn/browser`'s `startRegistration` and
  `startAuthentication`

### Roll out checklist

1. Run migration 043 against the live database:
   `node src/lib/migrations/run-043-passkey-credentials.mjs`
2. Sign in with email + password on a phone.
3. Settings -> Security -> Add a passkey. Tap Face ID. Done.
4. Sign out. On /v2/login tap "Use a passkey". Tap Face ID. Signed in.

## Status (as of this PR)

- Apple Sign In button: rendered, wired to Supabase OAuth, **awaiting
  Apple Developer credentials**.
- Google Sign In button: rendered, wired to Supabase OAuth, **awaiting
  Google Cloud OAuth client**.
- Email + password: working today. Polished UI in this PR.
- Passkeys: working today. No external setup needed beyond the
  migration.
