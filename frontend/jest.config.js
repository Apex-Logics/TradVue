const nextJest = require('next/jest')

const createJestConfig = nextJest({ dir: './' })

module.exports = createJestConfig({
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  // Include both __tests__/ (existing) and tests/unit/ (new unit tests)
  testMatch: [
    '**/__tests__/**/*.test.{ts,tsx}',
    '**/tests/unit/**/*.test.{ts,tsx}',
  ],
})
