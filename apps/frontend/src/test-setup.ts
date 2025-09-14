import '@testing-library/jest-dom';

// Polyfill for TextEncoder/TextDecoder which are needed by React Router DOM
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Set up environment variables for tests
process.env.VITE_API_ENDPOINT = 'http://localhost:3000/api';

// Mock fetch if not available
if (!global.fetch) {
  global.fetch = jest.fn();
}

// Mock matchMedia for components that might use it
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});