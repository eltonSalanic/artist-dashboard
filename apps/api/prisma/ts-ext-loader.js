// The generated Prisma client is TypeScript source whose relative imports carry
// explicit `.js` specifiers (for nodenext). The app compiles it via webpack's
// `extensionAlias` and Jest via a moduleNameMapper; ts-node has neither, so
// Node's CommonJS loader looks for a literal `.js` that doesn't exist. This hook
// retries any relative `.js` require as `.ts` before falling back. Registered
// after tsconfig-paths so its @artist/shared aliasing still applies.
const Module = require('module');

const original = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request.endsWith('.js') && (request.startsWith('./') || request.startsWith('../'))) {
    try {
      return original.call(this, request.slice(0, -3) + '.ts', ...args);
    } catch {
      // Not a .ts sibling — fall through to normal resolution below.
    }
  }
  return original.call(this, request, ...args);
};
