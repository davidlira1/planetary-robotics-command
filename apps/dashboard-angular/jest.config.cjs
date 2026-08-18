/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleNameMapper: {
    '^@angular/core$': '<rootDir>/src/test/angular-core-stub.ts',
    '^@prc/design-system/tokens$': '<rootDir>/../../libs/design-system/tokens.ts',
    '^@prc/contracts$': '<rootDir>/../../libs/contracts/src/index.ts',
    '^three/addons/renderers/CSS2DRenderer\\.js$': '<rootDir>/src/test/css2d-stub.ts',
  },
};
