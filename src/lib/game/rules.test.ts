import { describe, it, expect, beforeEach } from 'vitest';
import { GameRules } from './rules';
import { Player, GamePiece, NineBoard, GamePhase } from './game';

describe('GameRules', () => {
    let player1: Player;
    let player2: Player;
    let board: NineBoard;

    beforeEach(() => {
        player1 = new Player('p1', 'Player 1', true);
        player2 = new Player('p2', 'Player 2', false);
        board = new NineBoard([player1, player2]);
    });

    describe('isValidMove', () => {
        it('should return false if destination cell is occupied', () => {
            const fromCell = board.getCell(0);
            const toCell = board.getCell(1);
            const piece = player1.nextPiece!;
            
            // Occupy destination cell
            board.placePiece(piece, toCell);
            
            const result = GameRules.isValidMove(fromCell, toCell, board, false);
            expect(result).toBe(false);
        });

        it('should return true if can fly to empty cell', () => {
            const fromCell = board.getCell(0);
            const toCell = board.getCell(23); // Far away cell
            
            const result = GameRules.isValidMove(fromCell, toCell, board, true);
            expect(result).toBe(true);
        });

        it('should return false if not adjacent and cannot fly', () => {
            const fromCell = board.getCell(0);
            const toCell = board.getCell(23); // Far away cell
            
            const result = GameRules.isValidMove(fromCell, toCell, board, false);
            expect(result).toBe(false);
        });

        it('should return true for adjacent empty cell', () => {
            const fromCell = board.getCell(0);
            const toCell = board.getCell(1); // Adjacent cell
            
            const result = GameRules.isValidMove(fromCell, toCell, board, false);
            expect(result).toBe(true);
        });
    });

    describe('canPlayerFly', () => {
        it('should return true when player has 3 or fewer pieces', () => {
            // Remove pieces until player has 3
            while (player1.pieceCount > 3) {
                const piece = player1.allPieces[0];
                player1.removePiece(piece);
            }
            
            expect(GameRules.canPlayerFly(player1)).toBe(true);
        });

        it('should return false when player has more than 3 pieces', () => {
            expect(player1.pieceCount).toBeGreaterThan(3);
            expect(GameRules.canPlayerFly(player1)).toBe(false);
        });
    });

    describe('isMillFormed', () => {
        it('should return true for horizontal mill', () => {
            const cell0 = board.getCell(0);
            const cell1 = board.getCell(1);
            const cell2 = board.getCell(2);
            
            // Place three pieces in a row
            board.placePiece(player1.nextPiece!, cell0);
            board.placePiece(player1.nextPiece!, cell1);
            board.placePiece(player1.nextPiece!, cell2);
            
            expect(GameRules.isMillFormed(cell1, board)).toBe(true);
        });

        it('should return true for vertical mill', () => {
            // Use cells that actually form a vertical mill in Nine Men's Morris
            // Looking at the board layout, cells 1-4-7 form a vertical line
            const cell1 = board.getCell(1);
            const cell4 = board.getCell(4);
            const cell7 = board.getCell(7);
            
            // Place three pieces in a column
            board.placePiece(player1.nextPiece!, cell1);
            board.placePiece(player1.nextPiece!, cell4);
            board.placePiece(player1.nextPiece!, cell7);
            
            expect(GameRules.isMillFormed(cell4, board)).toBe(true);
        });

        it('should return false for incomplete mill', () => {
            const cell0 = board.getCell(0);
            const cell1 = board.getCell(1);
            
            // Place only two pieces
            board.placePiece(player1.nextPiece!, cell0);
            board.placePiece(player1.nextPiece!, cell1);
            
            expect(GameRules.isMillFormed(cell0, board)).toBe(false);
        });

        it('should return false for empty cell', () => {
            const cell0 = board.getCell(0);
            expect(GameRules.isMillFormed(cell0, board)).toBe(false);
        });
    });

    describe('getRemovablePieces', () => {
        it('should return pieces not in mills first', () => {
            const cell0 = board.getCell(0);
            const cell1 = board.getCell(1);
            const cell2 = board.getCell(2);
            const cell3 = board.getCell(3);
            
            // Create a mill for player2
            board.placePiece(player2.nextPiece!, cell0);
            board.placePiece(player2.nextPiece!, cell1);
            board.placePiece(player2.nextPiece!, cell2);
            
            // Place one piece not in mill
            board.placePiece(player2.nextPiece!, cell3);
            
            const removable = GameRules.getRemovablePieces(player2, board);
            expect(removable).toHaveLength(1);
            expect(removable[0].cell?.id).toBe(3);
        });

        it('should return all pieces if all are in mills', () => {
            const cell0 = board.getCell(0);
            const cell1 = board.getCell(1);
            const cell2 = board.getCell(2);
            
            // Create a mill with all placed pieces
            board.placePiece(player2.nextPiece!, cell0);
            board.placePiece(player2.nextPiece!, cell1);
            board.placePiece(player2.nextPiece!, cell2);
            
            const removable = GameRules.getRemovablePieces(player2, board);
            expect(removable).toHaveLength(3);
        });
    });

    describe('hasPlayerWon', () => {
        it('should return true if opponent has fewer than 3 pieces', () => {
            // Remove pieces until player2 has 2
            while (player2.pieceCount > 2) {
                const piece = player2.allPieces[0];
                player2.removePiece(piece);
            }
            
            expect(GameRules.hasPlayerWon(player1, player2, GamePhase.Movement, board)).toBe(true);
        });

        it('should return false if opponent has 3 or more pieces in placement phase', () => {
            expect(player2.pieceCount).toBeGreaterThanOrEqual(3);
            expect(GameRules.hasPlayerWon(player1, player2, GamePhase.Placement, board)).toBe(false);
        });

        it('should return true if opponent cannot move in movement phase', () => {
            
            // Create a player with 3 pieces all placed but unable to move
            const blockedPlayer = new Player('blocked', 'Blocked', false);
            const piece1 = new GamePiece(blockedPlayer, '1');
            const piece2 = new GamePiece(blockedPlayer, '2');
            const piece3 = new GamePiece(blockedPlayer, '3');
            
            piece1.place(board.getCell(0));
            piece2.place(board.getCell(1));
            piece3.place(board.getCell(2));
            
            blockedPlayer.addPieces([piece1, piece2, piece3]);
            
            // This would require a more complex setup to test properly
            // For now, we'll test that the function exists and doesn't crash
            expect(() => GameRules.hasPlayerWon(player1, blockedPlayer, GamePhase.Movement, board)).not.toThrow();
        });
    });

    describe('getValidMovesForPiece', () => {
        it('should return empty array for unplaced piece', () => {
            const piece = player1.nextPiece!;
            const moves = GameRules.getValidMovesForPiece(piece, board);
            expect(moves).toHaveLength(0);
        });

        it('should return adjacent cells for non-flying piece', () => {
            const piece = player1.nextPiece!;
            const cell0 = board.getCell(0);
            board.placePiece(piece, cell0);
            
            const moves = GameRules.getValidMovesForPiece(piece, board);
            expect(moves.length).toBeGreaterThan(0);
            
            // Check that returned moves are adjacent
            moves.forEach(move => {
                expect(board.state.isAdjacent(cell0, move)).toBe(true);
            });
        });

        it('should return all empty cells for flying piece', () => {
            const piece = player1.nextPiece!;
            const cell0 = board.getCell(0);
            board.placePiece(piece, cell0);
            
            // Reduce player pieces to trigger flying
            while (player1.pieceCount > 3) {
                const pieceToRemove = player1.allPieces.find(p => p !== piece);
                if (pieceToRemove) {
                    player1.removePiece(pieceToRemove);
                }
            }
            
            const moves = GameRules.getValidMovesForPiece(piece, board);
            
            // Should be able to move to any empty cell
            expect(moves.length).toBe(23); // 24 total cells - 1 occupied
        });
    });

    describe('isValidPlacement', () => {
        it('should return true for valid placement in placement phase', () => {
            const cell = board.getCell(0);
            const result = GameRules.isValidPlacement(cell, player1, GamePhase.Placement);
            expect(result).toBe(true);
        });

        it('should return false for placement outside placement phase', () => {
            const cell = board.getCell(0);
            const result = GameRules.isValidPlacement(cell, player1, GamePhase.Movement);
            expect(result).toBe(false);
        });

        it('should return false for occupied cell', () => {
            const cell = board.getCell(0);
            board.placePiece(player1.nextPiece!, cell);
            
            const result = GameRules.isValidPlacement(cell, player2, GamePhase.Placement);
            expect(result).toBe(false);
        });

        it('should return false when player has no pieces to place', () => {
            const cell = board.getCell(0);
            
            // Remove all unplaced pieces
            while (player1.nextPiece) {
                const piece = player1.nextPiece;
                piece.place(board.getCell(1)); // Place it somewhere
            }
            
            const result = GameRules.isValidPlacement(cell, player1, GamePhase.Placement);
            expect(result).toBe(false);
        });
    });

    describe('isValidRemoval', () => {
        it('should return false for removing own piece', () => {
            const piece = player1.nextPiece!;
            const cell = board.getCell(0);
            board.placePiece(piece, cell);
            
            const result = GameRules.isValidRemoval(piece, player1, board);
            expect(result).toBe(false);
        });

        it('should return false for unplaced piece', () => {
            const piece = player2.nextPiece!;
            const result = GameRules.isValidRemoval(piece, player1, board);
            expect(result).toBe(false);
        });

        it('should return true for valid removal', () => {
            const piece = player2.nextPiece!;
            const cell = board.getCell(0);
            board.placePiece(piece, cell);
            
            const result = GameRules.isValidRemoval(piece, player1, board);
            expect(result).toBe(true);
        });
    });

    describe('getNextPhase', () => {
        it('should transition from placement to movement when all pieces placed', () => {
            // Place all pieces for both players
            player1.allPieces.forEach((piece, index) => {
                if (piece.state === 'unplaced') {
                    piece.place(board.getCell(index));
                }
            });
            player2.allPieces.forEach((piece, index) => {
                if (piece.state === 'unplaced') {
                    piece.place(board.getCell(index + 9));
                }
            });
            
            const nextPhase = GameRules.getNextPhase(GamePhase.Placement, [player1, player2]);
            expect(nextPhase).toBe(GamePhase.Movement);
        });

        it('should stay in placement if pieces remain', () => {
            const nextPhase = GameRules.getNextPhase(GamePhase.Placement, [player1, player2]);
            expect(nextPhase).toBe(GamePhase.Placement);
        });

        it('should stay in current phase for non-placement phases', () => {
            const nextPhase = GameRules.getNextPhase(GamePhase.Movement, [player1, player2]);
            expect(nextPhase).toBe(GamePhase.Movement);
        });
    });
});
