# Stateline desktop shell (Tauri 2)

The game is the web build in `../dist`; this wraps it as a native app.

Build locally (needs Rust + the Tauri CLI):

    npm i -D @tauri-apps/cli
    npm run desktop:dev     # native window against the dev server
    npm run desktop:build   # installers for the host OS

Icons: add `icons/` per https://tauri.app/develop/icons/ before shipping.
