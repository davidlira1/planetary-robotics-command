module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  moduleNameMapper: {
    '^@prc/ports$': '<rootDir>/../../../ports/src/index.ts',
    '^@prc/contracts$': '<rootDir>/../../../contracts/src/index.ts',
    '^@prc/domain$': '<rootDir>/../../../domain/src/index.ts',
  },
};
