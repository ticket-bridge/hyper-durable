export default {
  preset: "ts-jest/presets/default-esm",
  globals: {
    "ts-jest": {
      useESM: true,
    },
  },
  verbose: true,

  // Coverage
  collectCoverage: true,
  collectCoverageFrom: [
    "src/**/*.ts",
    "!**/*.d.ts"
  ],

  // Miniflare!
  testEnvironment: "miniflare",
};
