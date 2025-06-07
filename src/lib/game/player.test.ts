import { describe, it, expect, beforeEach } from 'vitest';
import { Player, GamePiece } from './game';

describe('Player', () => {
    let player: Player;

    beforeEach(() => {
        player = new Player('p1', 'Test Player', true);
    });

    describe('initialization', () => {
        it('should initialize with correct properties', () => {
            expect(player.id).toBe('p1');
            expect(player.name).toBe('Test Player');
            expect(player.isInitiator).toBe(true);
            expect(player.pieceCount).toBe(0);
        });
    });

    describe('piece management', () => {
        it('should add pieces correctly', () => {
            const piece1 = new GamePiece(player, '1');
            const piece2 = new GamePiece(player, '2');
            
            player.addPiece(piece1);
            player.addPieces([piece2]);
            
            expect(player.pieceCount).toBe(2);
            expect(player.allPieces).toContain(piece1);
            expect(player.allPieces).toContain(piece2);
        });

        it('should remove pieces correctly', () => {
            const piece1 = new GamePiece(player, '1');
            const piece2 = new GamePiece(player, '2');
            
            player.addPieces([piece1, piece2]);
            player.removePiece(piece1);
            
            expect(player.pieceCount).toBe(1);
            expect(player.allPieces).not.toContain(piece1);
            expect(player.allPieces).toContain(piece2);
        });

        it('should reset pieces correctly', () => {
            const piece = new GamePiece(player, '1');
            player.addPiece(piece);
            
            player.reset();
            
            expect(player.pieceCount).toBe(0);
            expect(player.allPieces).toHaveLength(0);
        });
    });

    describe('piece getters', () => {
        beforeEach(() => {
            // Add some pieces in different states
            const piece1 = new GamePiece(player, '1'); // unplaced
            const piece2 = new GamePiece(player, '2'); // will be placed
            const piece3 = new GamePiece(player, '3'); // will be removed
            
            player.addPieces([piece1, piece2, piece3]);
            
            // Change states
            piece2.state = 'placed';
            piece3.state = 'removed';
        });

        it('should return next unplaced piece', () => {
            const nextPiece = player.nextPiece;
            expect(nextPiece).toBeTruthy();
            expect(nextPiece?.state).toBe('unplaced');
        });

        it('should return null when no unplaced pieces', () => {
            // Mark all pieces as placed
            player.allPieces.forEach(piece => {
                (piece as GamePiece).state = 'placed';
            });
            
            expect(player.nextPiece).toBeNull();
        });

        it('should return placed pieces correctly', () => {
            const placedPieces = player.placedPieces;
            expect(placedPieces).toHaveLength(1);
            expect(placedPieces[0].state).toBe('placed');
        });

        it('should return unplaced pieces correctly', () => {
            const unplacedPieces = player.unplacedPieces;
            expect(unplacedPieces).toHaveLength(1);
            expect(unplacedPieces[0].state).toBe('unplaced');
        });

        it('should return readonly arrays', () => {
            const allPieces = player.allPieces;
            const placedPieces = player.placedPieces;
            const unplacedPieces = player.unplacedPieces;
            
            expect(() => {
                (allPieces as GamePiece[]).push(new GamePiece(player, 'test'));
            }).toThrow();
            
            expect(() => {
                (placedPieces as GamePiece[]).push(new GamePiece(player, 'test'));
            }).toThrow();
            
            expect(() => {
                (unplacedPieces as GamePiece[]).push(new GamePiece(player, 'test'));
            }).toThrow();
        });
    });

    describe('serialization', () => {
        it('should dehydrate correctly', () => {
            const piece = new GamePiece(player, '1');
            player.addPiece(piece);
            
            const dehydrated = player.dehydrate();
            const parsed = JSON.parse(dehydrated);
            
            expect(parsed.id).toBe('p1');
            expect(parsed.name).toBe('Test Player');
            expect(parsed.pieces).toHaveLength(1);
        });
    });
});
