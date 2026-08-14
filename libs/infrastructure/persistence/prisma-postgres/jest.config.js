module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  moduleNameMapper: {
    '^@prc/domain$': '<rootDir>/../../../domain/src/index.ts',
    '^@prc/ports$': '<rootDir>/../../../ports/src/index.ts',
  },
};
