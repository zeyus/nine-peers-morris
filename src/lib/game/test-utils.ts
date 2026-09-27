import { vi } from 'vitest';

/**
 * Creates a mock window object for testing game functionality
 */
export function createMockWindow(): unknown {
	return {
		crypto: {
			subtle: {
				digest: vi.fn().mockResolvedValue(new ArrayBuffer(32))
			}
		}
	};
}
