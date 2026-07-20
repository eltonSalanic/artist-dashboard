// Prisma 7 generates TS files that import with `.js` extensions;
// teach webpack to resolve those back to the `.ts` sources.
module.exports = (options) => ({
  ...options,
  resolve: {
    ...options.resolve,
    extensionAlias: {
      '.js': ['.ts', '.js'],
    },
  },
});
