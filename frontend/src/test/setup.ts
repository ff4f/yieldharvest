import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock HashConnect for testing
;(global as any).HashConnect = {
  init: vi.fn(),
  connectToLocalWallet: vi.fn(),
  disconnect: vi.fn(),
  sendTransaction: vi.fn(),
}

// Mock window.crypto for testing
Object.defineProperty(window, 'crypto', {
  value: {
    getRandomValues: (arr: any) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256)
      }
      return arr
    },
  },
})

// Mock ResizeObserver
;(global as any).ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Mock IntersectionObserver
;(global as any).IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
}