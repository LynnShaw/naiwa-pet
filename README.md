# Naiwa Pet

A lightweight Tauri desktop pet for Windows and macOS.

## Commands

```sh
npm install
npm run assets:naiwa
npm run tauri:dev
npm run tauri:build
```

If dependencies need a local proxy:

```sh
export https_proxy=http://127.0.0.1:7890 http_proxy=http://127.0.0.1:7890 all_proxy=socks5://127.0.0.1:7890
npm install --registry=https://registry.npmjs.org --no-audit --no-fund
```

## Pet Assets

The default pet lives in `public/pets/naiwa`.

- `manifest.json` describes the animation.
- `frames/*.webp` are transparent animation frames.
- `audio.m4a` is the extracted source audio.

To regenerate the bundled Naiwa assets from `naiwa.mp4`:

```sh
npm run assets:naiwa
```

To add another pet later, create another folder with the same manifest shape and update `DEFAULT_PET_ID` in `src/main.ts`.

## Builds

Local macOS builds are emitted under `src-tauri/target/release/bundle`. Windows and macOS CI builds are configured in `.github/workflows/build.yml`.
