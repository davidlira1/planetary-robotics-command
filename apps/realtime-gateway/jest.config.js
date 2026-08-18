module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  moduleNameMapper: {
    '^@prc/contracts$': '<rootDir>/../../libs/contracts/src/index.ts',
    '^@prc/ports$': '<rootDir>/../../libs/ports/src/index.ts',
    '^@prc/messaging-asb$': '<rootDir>/../../libs/infrastructure/messaging/azure-service-bus/src/index.ts',
    '^@prc/messaging-rabbitmq$': '<rootDir>/../../libs/infrastructure/messaging/rabbitmq/src/index.ts',
  },
};
