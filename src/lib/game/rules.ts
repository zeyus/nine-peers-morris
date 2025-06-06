import type { Player, GamePiece, Cell, Board } from './game';
import { GamePhase } from './game';

/**
 * Game rules engine for Nine Men's Morris
 * Contains all game logic and validation rules
 */
export class GameRules {
    /** Standard number of pieces each player starts with */
    static readonly PIECES_PER_PLAYER = 9;
    
    /** Number of pieces needed to form a mill */
    static readonly MILL_SIZE = 3;
    
    /** Minimum pieces a player must have to continue playing */
    static readonly MIN_PIECES_TO_PLAY = 3;
    
    /** Number of pieces at which flying is allowed */
    static readonly FLYING_THRESHOLD = 3;

    /**
     * Checks if a move from one cell to another is valid
     * @param fromCell - Starting cell
     * @param toCell - Destination cell
     * @param board - Game board
     * @param canFly - Whether the piece can fly to any empty cell
     * @returns True if the move is valid
     */
    static isValidMove(fromCell: Cell, toCell: Cell, board: Board, canFly: boolean): boolean {
        // Destination must be empty
        if (toCell.piece) {
            return false;
        }

        // If can fly, any empty cell is valid
        if (canFly) {
            return true;
        }

        // Otherwise, cells must be adjacent
        return board.state.isAdjacent(fromCell, toCell);
    }

    /**
     * Checks if a player can fly (move to any empty cell)
     * @param player - The player to check
     * @returns True if the player can fly
     */
    static canPlayerFly(player: Player): boolean {
        return player.pieceCount <= this.FLYING_THRESHOLD;
    }

    /**
     * Checks if forming a mill at the given cell would be valid
     * @param cell - Cell to check for mill formation
     * @param board - Game board
     * @returns True if a mill is formed at this cell
     */
    static isMillFormed(cell: Cell, board: Board): boolean {
        return board.checkForMill(cell);
    }

    /**
     * Gets pieces that can be removed after a mill is formed
     * @param opponent - The opponent whose pieces might be removed
     * @param board - Game board
     * @returns Array of removable pieces
     */
    static getRemovablePieces(opponent: Player, board: Board): readonly GamePiece[] {
        // First, try to find pieces not in a mill
        const piecesNotInMill = opponent.placedPieces.filter(piece => 
            !this.isMillFormed(piece.cell!, board)
        );
        
        if (piecesNotInMill.length > 0) {
            return Object.freeze(piecesNotInMill);
        }
        
        // If all pieces are in mills, any piece can be removed
        return opponent.placedPieces;
    }

    /**
     * Checks if a player has won the game
     * @param player - Player to check for win
     * @param opponent - The opponent
     * @param phase - Current game phase
     * @param board - Game board
     * @returns True if the player has won
     */
    static hasPlayerWon(player: Player, opponent: Player, phase: GamePhase, board: Board): boolean {
        // Win if opponent has fewer than minimum pieces (only after placement phase)
        if (phase === GamePhase.Movement || phase === GamePhase.Capture) {
            if (opponent.pieceCount < this.MIN_PIECES_TO_PLAY) {
                return true;
            }
        }

        // Win if opponent cannot move (only check in movement phase)
        if (phase === GamePhase.Movement) {
            const canMove = opponent.placedPieces.some(piece => {
                return this.getValidMovesForPiece(piece, board).length > 0;
            });
            if (!canMove) {
                return true;
            }
        }

        return false;
    }

    /**
     * Gets valid moves for a specific piece
     * @param piece - The piece to get moves for
     * @param board - Game board
     * @returns Array of valid destination cells
     */
    static getValidMovesForPiece(piece: GamePiece, board: Board): readonly Cell[] {
        if (piece.state !== 'placed' || !piece.cell) {
            return Object.freeze([]);
        }

        const validMoves: Cell[] = [];
        const canFly = this.canPlayerFly(piece.player);

        if (canFly) {
            // Can move to any empty cell
            for (let i = 0; i < board.cellCount; i++) {
                const cell = board.getCell(i);
                if (!cell.piece) {
                    validMoves.push(cell);
                }
            }
        } else {
            // Can only move to adjacent empty cells
            const neighbors = board.state.neighbors(piece.cell);
            for (const neighbor of neighbors) {
                if (!neighbor.piece) {
                    validMoves.push(neighbor);
                }
            }
        }

        return Object.freeze(validMoves);
    }

    /**
     * Validates if a piece placement is legal
     * @param cell - Cell to place piece in
     * @param player - Player placing the piece
     * @param phase - Current game phase
     * @returns True if placement is valid
     */
    static isValidPlacement(cell: Cell, player: Player, phase: GamePhase): boolean {
        // Can only place during placement phase
        if (phase !== GamePhase.Placement) {
            return false;
        }

        // Cell must be empty
        if (cell.piece) {
            return false;
        }

        // Player must have pieces to place
        return player.nextPiece !== null;
    }

    /**
     * Validates if a piece removal is legal
     * @param piece - Piece to remove
     * @param removingPlayer - Player removing the piece
     * @param board - Game board
     * @returns True if removal is valid
     */
    static isValidRemoval(piece: GamePiece, removingPlayer: Player, board: Board): boolean {
        // Cannot remove own pieces
        if (piece.player.id === removingPlayer.id) {
            return false;
        }

        // Piece must be placed on board
        if (piece.state !== 'placed') {
            return false;
        }

        // Check if piece is in the removable pieces list
        const removablePieces = this.getRemovablePieces(piece.player, board);
        return removablePieces.includes(piece);
    }

    /**
     * Determines the next game phase based on current state
     * @param currentPhase - Current game phase
     * @param players - All players in the game
     * @returns Next game phase
     */
    static getNextPhase(currentPhase: GamePhase, players: readonly Player[]): GamePhase {
        if (currentPhase === GamePhase.Placement) {
            // Check if all pieces are placed
            const allPiecesPlaced = players.every(player => 
                player.unplacedPieces.length === 0
            );
            if (allPiecesPlaced) {
                return GamePhase.Movement;
            }
        }

        return currentPhase;
    }
}