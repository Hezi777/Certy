# Certy

Windows desktop app that tracks when API tokens and certificates expire and sends desktop
notifications before they do. Local-only: no server, no accounts, secrets encrypted on disk.
Mostly used on Windows 10; developed on macOS.

## Map

- `src/` — React 19 + TypeScript UI (Vite, Tailwind 4, shadcn/ui in `src/components/ui`).
  - `lib/backend.ts` — the `Backend` interface the UI talks to. Two implementations:
    `tauriBackend.ts` (Rust commands) and `browserBackend` (localStorage mock with demo data,
    used when the UI runs in a plain browser). New backend calls need both.
  - `lib/presets.ts` — built-in services. A preset is a pre-filled custom service; there is
    no separate code path for built-ins.
  - `lib/types.ts` — shared shapes; mirrored by `src-tauri/src/model.rs`.
  - `features/` — one folder per screen. `mascot/` — React wrapper around the bloub engine.
- `src-tauri/src/` — Rust: `commands.rs` (everything the UI invokes), `scheduler.rs`
  (background checks + reminders), `checks.rs`, `certs.rs`, `crypto.rs`, `db.rs`.
- `src/mascot/engine/` is vendored from github.com/jeremy-prt/bloub (MIT, French comments).
  Its constants are measurements, not choices — read its README before changing it.

## Rules that aren't visible in the code

- Secrets (token values, cert files, AI key) never reach the UI unencrypted except through
  `reveal_secret`/`export_file`, and are never sent to the AI endpoint.
- Rust stores items/services/settings as JSON documents with `#[serde(flatten)] rest`, so
  new UI fields need no migration. Only add typed Rust fields Rust actually reads.
- `daysLeft`/`dueThreshold` in `src/lib/expiry.ts` and `days_left`/`due_threshold` in
  `scheduler.rs` must agree; both have tests.

## Commands

- `pnpm tauri dev` — desktop app; UI also served at http://localhost:1420
  (`?fresh` = onboarding, `#mascots` = mascot lab).
- `pnpm build` (typecheck + build), `pnpm test` (vitest), `pnpm lint` (oxlint).
- `cd src-tauri && cargo test` — cert fixtures regenerate via `tests/fixtures/make.sh`.
- Windows installers (`.exe` NSIS + `.msi` WiX) build only on Windows: GitHub Actions
  workflow `.github/workflows/windows.yml`.

## Done means

`pnpm build`, `pnpm test` and `cargo test` pass, and UI changes were looked at in the
browser in both light and dark theme.
