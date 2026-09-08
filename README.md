# portfolio-qa-harness

Headless smoke-test harness used to QA my portfolio projects: serves a built Vite app with `vite preview`, loads it in headless Edge via Playwright (SwiftShader WebGL2), collects console/page errors, and saves a screenshot.

```
node smoke.mjs --dir <projectDir> --port 4173 --out shot.png [--path /route] [--wait 4000]
```
