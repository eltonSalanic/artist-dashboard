// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // Every field goes through our TextInput, which puts a Done bar over the
    // iOS keyboard. React Native's own leaves no way to put a multiline
    // keyboard away.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/text-input.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react-native",
              importNames: ["TextInput"],
              message: "Import TextInput from '@/components/text-input' instead.",
            },
          ],
        },
      ],
    },
  },
]);
