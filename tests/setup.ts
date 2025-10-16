// Global test setup
// This file runs before all tests

// Mock Next.js server components
global.fetch = global.fetch || (() => Promise.resolve({
  json: () => Promise.resolve({}),
  ok: true,
  status: 200,
} as Response));

// Set NODE_ENV to test
process.env.NODE_ENV = 'test';