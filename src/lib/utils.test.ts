import { describe, it, expect } from 'vitest';
import { randomFloat, randomName } from './utils';

describe('randomFloat', () => {
    it('should return a number between 0 and 1', () => {
        for (let i = 0; i < 100; i++) {
            const result = randomFloat();
            expect(result).toBeGreaterThanOrEqual(0);
            expect(result).toBeLessThan(1);
        }
    });
});

describe('randomName', () => {
    it('should generate a name with the default parts and separator', () => {
        const name = randomName();
        const parts = name.split('-');
        expect(parts.length).toBe(3);
    });

    it('should generate a name with the specified number of parts', () => {
        const partsCount = 4;
        const name = randomName(partsCount);
        const parts = name.split('-');
        expect(parts.length).toBe(partsCount);
    });

    it('should generate a name with the specified separator', () => {
        const separator = '_';
        const name = randomName(3, separator);
        const parts = name.split(separator);
        expect(parts.length).toBe(3);
    });

    it('should capitalize words if capitalizeWords is true', () => {
        const name = randomName(3, '-', true);
        const parts = name.split('-');
        parts.forEach(part => {
            expect(part.charAt(0)).toBe(part.charAt(0).toUpperCase());
        });
    });

    it('should not capitalize words if capitalizeWords is false', () => {
        const name = randomName(3, '-', false);
        const parts = name.split('-');
        parts.forEach(part => {
            expect(part.charAt(0)).toBe(part.charAt(0).toLowerCase());
        });
    });
});
