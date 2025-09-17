/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests/ts"],
  testMatch: ["**/*.test.ts"],
  // Ensure Jest prefers TypeScript sources over stale compiled JavaScript
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  // Force resolver to pick .ts files from our source tree when .js artifacts also exist
  moduleNameMapper: {
    // Map our utils/typescript imports explicitly to .ts to avoid picking compiled .js
    "^utils/typescript/(.*)$": "<rootDir>/utils/typescript/$1.ts",
    "^\./utils/typescript/(.*)$": "<rootDir>/utils/typescript/$1.ts",
    "^\.\./utils/typescript/(.*)$": "<rootDir>/utils/typescript/$1.ts",
    "^../../utils/typescript/(.*)$": "<rootDir>/utils/typescript/$1.ts",
    // Map top-level TS modules explicitly if referenced without extension
    "^ai-debugging$": "<rootDir>/ai-debugging.ts",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.json" }]
  },
};