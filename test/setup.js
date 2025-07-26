// Global test setup
process.env.NODE_ENV = 'test';

// Suppress console logs during tests unless there's an error
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

console.log = (...args) => {
  // Only log errors or if explicitly needed for debugging
  if (process.env.DEBUG_TESTS) {
    originalConsoleLog(...args);
  }
};

console.error = (...args) => {
  // Always show errors
  originalConsoleError(...args);
};

// Global cleanup
afterAll(async () => {
  // Restore console
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});