# LanaeHealth iOS app — first-time setup

This is the one-time setup to take the Capacitor iOS shell from "code in
the repo" to "app installed on Lanae's iPhone." After this, every code
change to the web app deploys via Vercel as it always has and the iPhone
just picks it up. The native shell only needs a rebuild when you add a
new Capacitor plugin or change the Info.plist permissions.

## What this gives you

A native iOS app that:

- Shows the deployed `lanaehealth.vercel.app` inside a real iOS WebView
- Has its own home-screen icon, App Store presence (when you publish),
  and TestFlight beta path
- Can read + write Apple Health data via the `capacitor-health` plugin
  (so cycle / period / weight / BP / HR auto-flow into the app's DB
  via the existing import endpoints)
- Can show real iOS push notifications via APNs (med reminders, etc.)
- Has microphone + camera permissions wired for the note composer's
  voice path and the calorie page's barcode scanner

The web build is the source of truth for everything. The iOS shell
is a thin native loader.

## One-time tooling install (~10 min, ~12 GB of disk)

These are required because Capacitor needs Xcode to compile the iOS
project and CocoaPods to fetch native plugin dependencies.

### 1. Install Xcode (full IDE, not just Command Line Tools)

Open the Mac App Store and install **Xcode**. It is free, ~12 GB.

After it finishes downloading, open it once to accept the license, then
in Terminal run:

```bash
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
```

Verify:

```bash
xcodebuild -version
# Should print "Xcode 16.x" (or later)
```

### 2. Install CocoaPods

```bash
sudo gem install cocoapods
pod --version
```

If you get a Ruby permissions error, install via Homebrew instead:

```bash
brew install cocoapods
```

### 3. Confirm npm is healthy

You already have Node 22 and npm 10 from the existing project. No
action needed.

## Generate the iOS project (~3 min, one-time)

From the repo root:

```bash
# Generates the ios/ folder with the Xcode project + Pods.
npx cap add ios

# Copies capacitor.config.ts settings + native plugins into the
# generated project.
npx cap sync ios
```

If `cap add ios` succeeds, you'll see a new `ios/` directory at the
repo root containing `App.xcodeproj`, `App.xcworkspace`, `Podfile`,
and `Pods/`.

## Merge the Info.plist permissions

Open `ios/App/App/Info.plist` in Xcode (or any text editor) and merge
the keys from `ios-templates/Info.plist.additions` into the top-level
`<dict>`. Keep the keys Capacitor already added; just add the new ones
alongside.

The HealthKit permission strings are written in the app's voice; tweak
the wording if you want but keep them specific (Apple rejects generic
"For app functionality" descriptions).

## Enable HealthKit + Push capabilities in Xcode

1. Open `ios/App/App.xcworkspace` in Xcode (NOT `App.xcodeproj` —
   always use the workspace, it knows about Pods).
2. In the project navigator, click the **App** target.
3. Click the **Signing & Capabilities** tab.
4. Click **+ Capability** in the top-left, and add:
   - **HealthKit** (check both "Clinical Health Records" optional
     and the standard data types — capacitor-health uses standard)
   - **Push Notifications**
   - **Background Modes** → enable Background fetch + Background
     processing + Remote notifications

## Sign with your Apple ID (free for sideload)

Same Signing & Capabilities tab:

1. Under **Signing**:
   - **Automatically manage signing** = checked
   - **Team** → select your Apple ID. If your Apple ID isn't in the
     dropdown:
     - Xcode → Settings → Accounts → "+" → Apple ID → sign in
     - Come back to the project, your team appears.
   - **Bundle Identifier** = `app.lanaehealth.mobile` (or change to
     anything unique to you, like
     `com.yourname.lanaehealth`)

You DO NOT need the $99 Apple Developer Program yet. Free sideloading
to Lanae's phone works on a regular Apple ID for 7-day builds. The
$99 unlocks TestFlight + App Store + 1-year provisioning.

## Run on Lanae's iPhone (~2 min, every time you want a fresh sideload)

1. Connect her iPhone to your Mac with a USB-C / Lightning cable.
2. Unlock the iPhone, tap **Trust This Computer**.
3. In Xcode, select her iPhone in the device dropdown at the top
   (next to the play button).
4. Hit ⌘R or click the play button.
5. First time only: on her iPhone, go to **Settings → General →
   VPN & Device Management → Developer App** and trust your Apple ID.
6. The app launches on her phone.

After install, you can disconnect the cable. The app stays on her
phone for 7 days (free Apple ID) or 1 year ($99 Developer Program).
Re-running the same command every week (or every push) refreshes it.

## Iterating after first install

The web app is the source of truth. After your first build:

- **Web changes (any code outside `ios/` or `capacitor.config.ts`):**
  Just `git push`. Vercel deploys, the iOS WebView reloads on next
  app launch. No rebuild needed.

- **Native plugin changes (adding a new Capacitor plugin):**
  ```bash
  npm install --save <plugin>
  npx cap sync ios
  # Then re-run from Xcode (⌘R)
  ```

- **Info.plist changes (adding a new permission):**
  Edit Info.plist, then re-run from Xcode.

## TestFlight + App Store (when you're ready)

1. Pay the $99/year [Apple Developer Program](https://developer.apple.com/programs/).
2. In Xcode, **Product → Archive** to build a release IPA.
3. **Window → Organizer** to upload to App Store Connect.
4. In App Store Connect, set up TestFlight invitees by email or
   submit for App Store review.
5. First HealthKit-using app submission gets extra scrutiny. Expect
   1-2 review cycles for the first version. Subsequent updates
   usually clear in 24 hours.

## Troubleshooting

**`pod install` fails with a Ruby version error.**
Install Ruby via Homebrew (`brew install ruby`) or rbenv before
installing CocoaPods.

**Xcode signing complains about provisioning.**
Make sure Bundle Identifier is unique to your Apple ID (no other
app on App Store uses the same). Change it from `app.lanaehealth.mobile`
to `com.<yourname>.lanaehealth` in both Xcode and `capacitor.config.ts`.

**HealthKit permission prompt never appears in the app.**
You forgot the Signing & Capabilities → "+ Capability" → HealthKit
step. The Info.plist usage description alone is necessary but not
sufficient.

**WebView shows the login page instead of /v2.**
Lanae needs to sign in once on the iPhone. The session cookie
persists across app launches.

**App crashes on launch with "Missing description for ..." in
Console.**
You skipped one of the Info.plist usage descriptions. Add it and
rebuild.
