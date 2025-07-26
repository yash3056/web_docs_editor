
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.js?(x)', '**/?(*.)+(spec|test).js?(x)'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  forceExit: true,
  detectOpenHandles: true,
  testTimeout: 10000,
};
