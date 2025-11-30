import { vi } from 'vitest';

/**
 * Creates a mock window object for testing game functionality
 */
export function createMockWindow(): any {
    return {
        crypto: {
            subtle: {
                digest: vi.fn().mockResolvedValue(new ArrayBuffer(32))
            }
        }
    };
}

/**
 * Mock implementations for hashable module
 */
export const mockHashable = {
    getHash: vi.fn().mockResolvedValue('mock-hash'),
    getUUID: vi.fn().mockReturnValue('mock-uuid')
};

/**
 * Setup function to mock the hashable module
 * Call this at the top of your test file
 */
export function setupHashableMock() {
    vi.mock('./hashable', () => mockHashable);
}
