# portfolio-qa-harness

Headless smoke-test harness for portfolio projects.

It serves a built Vite app with `vite preview`, opens it in headless Edge via Playwright (SwiftShader WebGL2), collects console/page errors, and optionally saves a screenshot. Output is a JSON report; exit code is 0 only when the page rendered without uncaught errors and the root has content.

## Usage

```bash
node smoke.mjs --dir <projectDir> --port 4173 --out shot.png [--path /route] [--wait 4000] [--width 1440] [--height 900]
```

Build the target project first (`npm run build` so `dist/` exists). The script expects Edge at the usual Windows path; adjust if needed.

## What it checks

- Console errors and warnings
- Uncaught page errors
- Failed network requests
- Whether `#root` (or `body`) has children
- Canvas count (useful for WebGL demos)

## License

MIT
