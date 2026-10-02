# Gavindle

One codebase → **website** (gavindle.com, GitHub Pages) + **iOS app** (Capacitor).
Both use the same daily word and the same Supabase leaderboard, so scores from the app and the site show up together.

## Website
Push to `main` → GitHub Actions deploys to gavindle.com. Nothing changed here.

## iOS app (needs a Mac with Xcode 16+)

1. Create `.env.local` with the same values as the GitHub secrets:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
2. `npm install`
3. `npm run ios:sync` (builds the site and copies it into the app)
4. `npm run ios:open` (opens Xcode)
5. In Xcode: **App target → Signing & Capabilities** → pick your Apple Developer team. Change the bundle ID (`com.gavindle.app`) if it's taken.
6. Run on a simulator/phone to test.
7. **Product → Archive → Distribute App → App Store Connect** to upload, then submit in App Store Connect.

Re-run step 3 any time you change the game, then archive again for an app update.

App-only extras: haptics on key taps / win / loss, and the native iOS share sheet.
