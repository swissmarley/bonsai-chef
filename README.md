# Bonsai Chef

Il diario per la cura dei tuoi bonsai: rinvaso, potatura, taglio germogli, applicazione filo,
defogliazione, concimazione, strumenti & accessori, foto e promemoria.

| Folder | What it is |
|---|---|
| [`pwa/`](pwa/) | **The current app**: installable Progressive Web App (React + Vite) with Netlify Functions, Neon Postgres and e-mail/OTP login. Deployed on Netlify. See [pwa/README.md](pwa/README.md). |
| [`ios/`](ios/) | The original SwiftUI iOS app (Xcode 15+, iOS 17.5). Open `ios/Bonsai Chef.xcodeproj`. Data is stored on the device only. |

Both apps are in Italian and share the same features; [pwa/PLAN.md](pwa/PLAN.md) maps every iOS
screen and field to the web version.

## Deploys

Netlify builds only the `pwa/` folder (Base directory = `pwa`). Pushes that change nothing in
`pwa/` (for example iOS-only commits) are skipped automatically.
