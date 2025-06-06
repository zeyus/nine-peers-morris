import { describe, it, expect, beforeEach } from 'vitest';
import { Cell, Player, GamePiece } from './game';

describe('Cell', () => {
    let cell: Cell;
    let player: Player;
    let piece: GamePiece;

    beforeEach(() => {
        cell = new Cell(5, 1, 2);
        player = new Player('p1', 'Test Player', true);
        piece = new GamePiece(player, 'piece1');
    });

    describe('initialization', () => {
        it('should initialize with correct properties', () => {
            expect(cell.id).toBe(5);
            expect(cell.row).toBe(1);
            expect(cell.col).toBe(2);
            expect(cell.piece).toBeNull();
        });
    });

    describe('piece occupation', () => {
        it('should occupy cell with piece', () => {
            cell.occupy(piece);
            
            expect(cell.piece).toBe(piece);
        });

        it('should not occupy already occupied cell', () => {
            const anotherPiece = new GamePiece(player, 'piece2');
            
            cell.occupy(piece);
            
            expect(() => {
                cell.occupy(anotherPiece);
            }).toThrow('Cell already occupied');
        });
    });

    describe('cell vacation', () => {
        beforeEach(() => {
            cell.occupy(piece);
        });

        it('should vacate occupied cell', () => {
            cell.vacate();
            
            expect(cell.piece).toBeNull();
        });

        it('should not vacate already vacant cell', () => {
            cell.vacate();
            
            expect(() => {
                cell.vacate();
            }).toThrow('Cell already vacant');
        });
    });

    describe('serialization', () => {
        it('should dehydrate empty cell correctly', () => {
            const dehydrated = cell.dehydrate();
            const parsed = JSON.parse(dehydrated);
            
            expect(parsed.id).toBe(5);
            expect(parsed.row).toBe(1);
            expect(parsed.col).toBe(2);
            expect(parsed.piece).toBeNull();
        });

        it('should dehydrate occupied cell correctly', () => {
            cell.occupy(piece);
            
            const dehydrated = cell.dehydrate();
            const parsed = JSON.parse(dehydrated);
            
            expect(parsed.id).toBe(5);
            expect(parsed.row).toBe(1);
            expect(parsed.col).toBe(2);
            expect(parsed.piece).toBeTruthy();
        });
    });
});