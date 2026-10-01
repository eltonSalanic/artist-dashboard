import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  testEnvironment: "jsdom",
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@artist/shared$": "<rootDir>/../../packages/shared/src",
    "^@artist/shared/(.*)$": "<rootDir>/../../packages/shared/src/$1",
    "^@artist/api-client$": "<rootDir>/../../packages/api-client/src",
    "^@artist/api-client/(.*)$": "<rootDir>/../../packages/api-client/src/$1",
  },
};

export default createJestConfig(config);
