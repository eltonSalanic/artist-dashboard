// Prisma 7 generates TS files that import with `.js` extensions;
// teach webpack to resolve those back to the `.ts` sources.
//
// `devtool` writes dist/main.js.map next to the bundle (Nest's default is
// none). `start:prod` runs Node with --enable-source-maps, so stack traces in
// logs and Sentry point at src/*.ts lines instead of one huge main.js.
//
// The map names each source by its absolute path (not webpack://api/./src/…),
// so those stack frames are real files on disk. The source ships in the same
// container, so Sentry's context lines read the code around each frame from
// there: readable traces with no source map upload or auth token.
module.exports = (options) => ({
  ...options,
  devtool: 'source-map',
  output: {
    ...options.output,
    devtoolModuleFilenameTemplate: '[absolute-resource-path]',
  },
  resolve: {
    ...options.resolve,
    extensionAlias: {
      '.js': ['.ts', '.js'],
    },
  },
});
