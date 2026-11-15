// Prisma 7 generates TS files that import with `.js` extensions;
// teach webpack to resolve those back to the `.ts` sources.
//
// `devtool` writes dist/main.js.map next to the bundle (Nest's default is
// none). `start:prod` runs Node with --enable-source-maps, so stack traces in
// logs and Sentry point at src/*.ts lines instead of one huge main.js.
module.exports = (options) => ({
  ...options,
  devtool: 'source-map',
  resolve: {
    ...options.resolve,
    extensionAlias: {
      '.js': ['.ts', '.js'],
    },
  },
});
