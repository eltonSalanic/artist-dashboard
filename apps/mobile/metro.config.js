// Metro needs to be told about the monorepo. `packages/shared` and
// `packages/api-client` are consumed as **TypeScript source** (their
// package.json `main` points at `src/index.ts`), which the web app handles with
// tsconfig `paths` + Next's `transpilePackages`. Metro has no equivalent of
// either, so the two halves have to be wired by hand:
//
//   watchFolders       — lets Metro read (and hot-reload) files outside apps/mobile
//   nodeModulesPaths   — npm workspaces hoist most deps to the repo root
//
// Expo's monorepo guide also suggests `resolver.disableHierarchicalLookup`, and
// it is deliberately **not** set here. npm workspaces hoist what they can but
// nest what they cannot, and that is not an edge case: `expo-router` itself
// lands in `apps/mobile/node_modules` with `@expo/metro-runtime` nested under
// it. Turning off the walk-up makes a nested dependency unresolvable, which
// shows up as "Unable to resolve module" for a package that is plainly
// installed. The setting belongs to pnpm-style isolated installs.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
