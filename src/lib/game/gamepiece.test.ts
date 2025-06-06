import { describe, it, expect, beforeEach } from 'vitest';
import { Player, GamePiece, Cell } from './game';

describe('GamePiece', () => {
    let player: Player;
    let piece: GamePiece;
    let cell: Cell;

    beforeEach(() => {
        player = new Player('p1', 'Test Player', true);
        piece = new GamePiece(player, 'piece1');
        cell = new Cell(0, 0, 0);
    });

    describe('initialization', () => {
        it('should initialize with correct properties', () => {
            expect(piece.id).toBe('piece1');
            expect(piece.player).toBe(player);
            expect(piece.state).toBe('unplaced');
            expect(piece.cell).toBeNull();
        });
    });

    describe('piece placement', () => {
        it('should place piece correctly', () => {
            piece.place(cell);
            
            expect(piece.state).toBe('placed');
            expect(piece.cell).toBe(cell);
        });

        it('should not place already placed piece', () => {
            piece.place(cell);
            
            expect(() => {
                piece.place(new Cell(1, 0, 1));
            }).toThrow('Piece not available to place');
        });

        it('should not place removed piece', () => {
            piece.state = 'removed';
            
            expect(() => {
                piece.place(cell);
            }).toThrow('Piece not available to place');
        });
    });

    describe('piece movement', () => {
        beforeEach(() => {
            piece.place(cell);
        });

        it('should move piece correctly', () => {
            const newCell = new Cell(1, 0, 1);
            piece.move(newCell);
            
            expect(piece.cell).toBe(newCell);
            expect(piece.state).toBe('placed'); // State should remain placed
        });

        it('should not move unplaced piece', () => {
            const unplacedPiece = new GamePiece(player, 'unplaced');
            const newCell = new Cell(1, 0, 1);
            
            expect(() => {
                unplacedPiece.move(newCell);
            }).toThrow('Piece not available to move');
        });

        it('should not move removed piece', () => {
            piece.remove();
            const newCell = new Cell(1, 0, 1);
            
            expect(() => {
                piece.move(newCell);
            }).toThrow('Piece not available to move');
        });
    });

    describe('piece removal', () => {
        beforeEach(() => {
            piece.place(cell);
        });

        it('should remove piece correctly', () => {
            piece.remove();
            
            expect(piece.state).toBe('removed');
            expect(piece.cell).toBeNull();
        });

        it('should not remove unplaced piece', () => {
            const unplacedPiece = new GamePiece(player, 'unplaced');
            
            expect(() => {
                unplacedPiece.remove();
            }).toThrow('Piece not available to remove');
        });

        it('should not remove already removed piece', () => {
            piece.remove();
            
            expect(() => {
                piece.remove();
            }).toThrow('Piece not available to remove');
        });
    });

    describe('serialization', () => {
        it('should dehydrate unplaced piece correctly', () => {
            const dehydrated = piece.dehydrate();
            const parsed = JSON.parse(dehydrated);
            
            expect(parsed.player).toBe('p1');
            expect(parsed.cell).toBeNull();
            expect(parsed.state).toBe('unplaced');
        });

        it('should dehydrate placed piece correctly', () => {
            piece.place(cell);
            
            const dehydrated = piece.dehydrate();
            const parsed = JSON.parse(dehydrated);
            
            expect(parsed.player).toBe('p1');
            expect(parsed.cell).toBe(0);
            expect(parsed.state).toBe('placed');
        });

        it('should dehydrate removed piece correctly', () => {
            piece.place(cell);
            piece.remove();
            
            const dehydrated = piece.dehydrate();
            const parsed = JSON.parse(dehydrated);
            
            expect(parsed.player).toBe('p1');
            expect(parsed.cell).toBeNull();
            expect(parsed.state).toBe('removed');
        });
    });
});