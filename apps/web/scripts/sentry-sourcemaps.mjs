// Runs after `next build` (see "build" in package.json).
//
// next.config.ts turns on productionBrowserSourceMaps, so the build writes a
// .map next to every browser chunk. This script, in order:
//   1. injects a Sentry debug ID into each chunk and its map, so Sentry matches
//      an error to the exact build without relying on URLs;
//   2. uploads the maps to the band-wall-web project, under the deploy's
//      commit as the release (the same value Sentry.init reports);
//   3. deletes every .map from .next/static, so the code's readable source is
//      never served to browsers.
//
// Without SENTRY_AUTH_TOKEN (local builds, CI) it skips 1 and 2 and still does
// 3, so maps never ship by accident. A failed upload fails the build: a deploy
// with unreadable traces is worth noticing.
import { execFileSync } from "node:child_process";
import { readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const STATIC_DIR = ".next/static";
const ORG = "elton-salanic";
const PROJECT = "band-wall-web";

function mapFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return mapFiles(path);
    return name.endsWith(".map") ? [path] : [];
  });
}

const token = process.env.SENTRY_AUTH_TOKEN;
const release =
  process.env.NEXT_PUBLIC_SENTRY_RELEASE ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;

if (token) {
  const require = createRequire(import.meta.url);
  const cli = require.resolve("@sentry/cli/bin/sentry-cli");
  const run = (...args) =>
    execFileSync(process.execPath, [cli, ...args], {
      stdio: "inherit",
      env: { ...process.env, SENTRY_ORG: ORG, SENTRY_PROJECT: PROJECT },
    });

  run("sourcemaps", "inject", STATIC_DIR);
  run(
    "sourcemaps",
    "upload",
    ...(release ? ["--release", release] : []),
    STATIC_DIR,
  );
} else {
  console.log("Sentry: no SENTRY_AUTH_TOKEN, skipping source map upload.");
}

const maps = mapFiles(STATIC_DIR);
for (const path of maps) rmSync(path);
console.log(`Sentry: removed ${maps.length} .map files from ${STATIC_DIR}.`);
