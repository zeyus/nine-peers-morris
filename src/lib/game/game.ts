import { Graph } from './graph';
import { type Hashable, getHash } from './hashable';
import { GameRules } from './rules';

export enum GamePhase {
    Placement = 'placement',
    Movement = 'movement', 
    Capture = 'capture',
    GameOver = 'game_over'
}

export enum GameAction {
    PlacePiece = 'place_piece',
    MovePiece = 'move_piece',
    RemovePiece = 'remove_piece'
}

export type GameMove = {
    action: GameAction;
    playerId: string;
    pieceId?: string;
    fromCellId?: number;
    toCellId: number;
    removedPieceId?: string;
}

/**
 * Represents a player in the Nine Men's Morris game
 */
export class Player implements Hashable {
    readonly id: string;
    readonly name: string;
    protected pieces: GamePiece[];
    protected removedPieces: GamePiece[];
    readonly isInitiator: boolean;
    protected isWinner: boolean;

    /**
     * Creates a new player
     * @param id - Unique identifier for the player
     * @param name - Display name for the player
     * @param isInitiator - Whether this player initiates the game
     */
    constructor(id: string, name: string, isInitiator: boolean) {
        this.id = id;
        this.name = name;
        this.pieces = [];
        this.isWinner = false;
        this.removedPieces = [];
        this.isInitiator = isInitiator;
    }
    reset() {
        this.pieces = [];
        this.isWinner = false;
    }
    addPiece(piece: GamePiece) {
        this.pieces.push(piece);
    }

    addPieces(pieces: GamePiece[]) {
        this.pieces.push(...pieces);
    }
    removePiece(piece: GamePiece) {
        this.pieces = this.pieces.filter(p => p !== piece);
        this.removedPieces.push(piece);
    }
    /** Gets the total number of pieces owned by this player */
    get pieceCount(): number {
        return this.pieces.length;
    }
    
    /** Gets the next unplaced piece available for placement, or null if none */
    get nextPiece(): GamePiece | null {
        const availablePieces = this.pieces.filter(piece => piece.state === 'unplaced');
        if (availablePieces.length === 0) {
            return null;
        }
        return availablePieces[0];
    }
    
    /** Gets all pieces owned by this player (readonly) */
    get allPieces(): readonly GamePiece[] {
        return Object.freeze([...this.pieces]);
    }
    
    /** Gets all pieces that are currently placed on the board (readonly) */
    get placedPieces(): readonly GamePiece[] {
        return Object.freeze(this.pieces.filter(piece => piece.state === 'placed'));
    }
    
    /** Gets all pieces that are not yet placed on the board (readonly) */
    get unplacedPieces(): readonly GamePiece[] {
        return Object.freeze(this.pieces.filter(piece => piece.state === 'unplaced'));
    }
    dehydrate(): string {
        return JSON.stringify({
            id: this.id,
            name: this.name,
            pieces: this.pieces.map(piece => piece.dehydrate()),
            isWinner: this.isWinner
        });
    }
}

export class Cell implements Hashable {
    id: number;
    row: number;
    col: number;
    piece: GamePiece | null;

    constructor(id: number, row: number, col: number) {
        this.id = id;
        this.row = row;
        this.col = col;
        this.piece = null;
    }

    occupy(piece: GamePiece) {
        if (this.piece) {
            throw new Error('Cell already occupied');
        }
        this.piece = piece;
    }

    vacate() {
        if (!this.piece) {
            throw new Error('Cell already vacant');
        }
        this.piece = null;
    }

    dehydrate(): string {
        return JSON.stringify({
            id: this.id,
            row: this.row,
            col: this.col,
            piece: this.piece
        });
    }
}

export class GamePiece implements Hashable {
    player: Player;
    id: string;
    cell: Cell | null;
    state: 'unplaced' | 'placed' | 'removed';

    constructor(player: Player, id: string) {
        this.id = id;
        this.player = player;
        this.cell = null;
        this.state = 'unplaced';
    }

    place(cell: Cell) {
        if (this.state !== 'unplaced') {
            throw new Error('Piece not available to place');
        }
        this.cell = cell;
        this.state = 'placed';
    }

    remove() {
        if (this.state !== 'placed') {
            throw new Error('Piece not available to remove');
        }
        this.cell = null;
        this.state = 'removed';
    }

    move(cell: Cell) {
        if (this.state !== 'placed') {
            throw new Error('Piece not available to move');
        }
        this.cell = cell;
    }

    dehydrate(): string {
        return JSON.stringify({
            player: this.player.id,
            cell: this.cell !== null ? this.cell.id : null,
            state: this.state
        });
    }
    
}

export type BoardOptions = {
    cells?: number;
    pieces?: number;
    players?: Player[];
    graph?: Graph<Cell>;
    millCount?: number;
    fly?: boolean;
    flyAt?: number;
}

export const defaultOptions: BoardOptions = {
    cells: 24,
    pieces: 18,
    players: [],
    millCount: 3,
    fly: false,
    flyAt: 0
}

export class Board implements Hashable {
    nPlayers: number = 2;
    cellCount: number;
    pieceCount: number;
    state: Graph<Cell>;
    millCount: number;
    players: Player[];
    fly: boolean;
    flyAt: number;
    [index: number]: Cell;

    constructor(boardOptions?: BoardOptions) {
        const options = { ...defaultOptions, ...boardOptions };
        if (options.players!.length !== this.nPlayers) {
            throw new Error(`Invalid number of players, expected ${this.nPlayers}`);
        }
        if (options.pieces! % this.nPlayers !== 0) {
            throw new Error('Invalid number of pieces, must be even');
        }

        this.players = options.players!;
        this.millCount = options.millCount!;
        this.cellCount = options.cells!;
        this.pieceCount = options.pieces!;
        this.players.forEach(player => {
            player.reset();
            player.addPieces(Array.from({ length: this.pieceCount / this.nPlayers }, (_, i) => new GamePiece(player, i.toString())));
        });
        this.fly = options.fly!;
        this.flyAt = options.flyAt!;

        if (options.graph) {
            this.state = options.graph;
        } else {
            this.state = new Graph<Cell>(Array.from({ length: this.cellCount }, (_, i) => {
                const row = Math.floor(i / 3);
                const col = i % 3;
                const cell = new Cell(i, row, col);
                this[i] = cell;
                return cell;
            }));
        }
    }

    getCell(id: number) {
        return this.state.filter(cell => cell.id === id)[0];
    }

    getCellByRowCol(row: number, col: number) {
        return this.state.filter(cell => cell.row === row && cell.col === col)[0];
    }

    checkForMill(cell: Cell) {
        if (!cell.piece) {
            return false;
        }
        const player = cell.piece.player;
        const cellsWithPlayerPiece = this.state.contiguousBreathFirstSearch(cell, c => (c.piece !== null && c.piece.player === player && (c.row === cell.row || c.col === cell.col)));
        if (cellsWithPlayerPiece.length < this.millCount) {
            return false;
        }
        // now check if there are three in a row
        // i.e. there are three cells in a row or column
        const rowCells = cellsWithPlayerPiece.filter(c => c.row === cell.row);
        const colCells = cellsWithPlayerPiece.filter(c => c.col === cell.col);

        return rowCells.length >= this.millCount || colCells.length >= this.millCount;        
    }

    placePiece(piece: GamePiece, cell: Cell) {
        cell.occupy(piece);
        piece.place(cell);
    }

    movePiece(piece: GamePiece, cell: Cell) {
        if (!this.state.isAdjacent(piece.cell!, cell)) {
            throw new Error('Invalid move, cells not adjacent');
        }
        piece.cell!.vacate();
        cell.occupy(piece);
        piece.move(cell);
    }

    // this is only for variations where when a player
    // has < n pieces, they can move any piece
    flyPiece(piece: GamePiece, cell: Cell) {
        if (!this.fly) {
            throw new Error('Invalid move, flying not allowed');
        }
        if (piece.player.pieceCount > this.flyAt) {
            throw new Error('Invalid move, player has too many pieces to fly');
        }

        piece.cell!.vacate();
        cell.occupy(piece);
        piece.move(cell);
    }

    removePiece(piece: GamePiece) {
        piece.cell!.vacate();
        piece.remove();
        piece.player.removePiece(piece);
    }

    dehydrate(): string {
        return JSON.stringify({
            players: this.players.map(player => player.dehydrate()),
            state: this.state.dehydrate(),
            millCount: this.millCount,
            pieceCount: this.pieceCount,
            cellCount: this.cellCount
        });
    }
}


export class NineBoard extends Board {
    constructor(players: Player[]) {
        const cells: Cell[] = [];
        const graph = new Graph<Cell>(Array.from({ length: 24 }, (_, i) => {
            if (i < 12) {
                const row = Math.floor(i / 3);
                const col = i % 3;
                const cell = new Cell(i, row, col);
                cells.push(cell);
                return cell;
            }
            const row = Math.floor((i - 1) / 3);
            if (i < 15) {
                const cell = new Cell(i, row, 3);
                cells.push(cell);
                return cell;
            }
            const col = (i-1) % 3;
            const cell = new Cell(i, 3, col);
            cells.push(cell);
            return cell;
        }));
        /**
         *     0----------1----------2
         *     |          |          |
         *     |   3------4------5   |
         *     |   |      |      |   |
         *     |   |  6---7---8  |   |
         *     |   |  |       |  |   |
         *     9--10-11      12-13--14
         *     |   |  |       |  |   |
         *     |   | 15--16---17 |   |
         *     |   |      |      |   |
         *     |   18----19-----20   |
         *     |          |          |
         *    21---------22---------23
         */
        graph.addEdgesByFilter(cell => cell.id === 0, cell => (cell.id === 1 || cell.id === 9));
        graph.addEdgesByFilter(cell => cell.id === 1, cell => (cell.id === 2 || cell.id === 4));
        graph.addEdgesByFilter(cell => cell.id === 2, cell => (cell.id === 14));
        graph.addEdgesByFilter(cell => cell.id === 3, cell => (cell.id === 4 || cell.id === 10));
        graph.addEdgesByFilter(cell => cell.id === 4, cell => (cell.id === 5 || cell.id === 7));
        graph.addEdgesByFilter(cell => cell.id === 5, cell => (cell.id === 13));
        graph.addEdgesByFilter(cell => cell.id === 6, cell => (cell.id === 7 || cell.id === 11));
        graph.addEdgesByFilter(cell => cell.id === 7, cell => (cell.id === 8));
        graph.addEdgesByFilter(cell => cell.id === 8, cell => (cell.id === 12));
        graph.addEdgesByFilter(cell => cell.id === 9, cell => (cell.id === 10 || cell.id === 21));
        graph.addEdgesByFilter(cell => cell.id === 10, cell => (cell.id === 11 || cell.id === 18));
        graph.addEdgesByFilter(cell => cell.id === 11, cell => (cell.id === 15));
        graph.addEdgesByFilter(cell => cell.id === 12, cell => (cell.id === 13 || cell.id === 17));
        graph.addEdgesByFilter(cell => cell.id === 13, cell => (cell.id === 14 || cell.id === 20));
        graph.addEdgesByFilter(cell => cell.id === 14, cell => (cell.id === 23));
        graph.addEdgesByFilter(cell => cell.id === 15, cell => (cell.id === 16));
        graph.addEdgesByFilter(cell => cell.id === 16, cell => (cell.id === 17 || cell.id === 19));
        graph.addEdgesByFilter(cell => cell.id === 18, cell => (cell.id === 19));
        graph.addEdgesByFilter(cell => cell.id === 19, cell => (cell.id === 20 || cell.id === 22));
        graph.addEdgesByFilter(cell => cell.id === 21, cell => (cell.id === 22));
        graph.addEdgesByFilter(cell => cell.id === 22, cell => (cell.id === 23));

        const options: BoardOptions = {
            cells: 24,
            pieces: 18,
            players: players,
            graph: graph,
            millCount: 3,
            fly: true,
            flyAt: 3
        };
        super(options);
        for (let i = 0; i < 24; i++) {
            this[i] = cells[i];
        }
    }
}


export abstract class Game implements Hashable {
    protected players: Player[];
    protected board: Board;
    protected currentPlayer: Player;
    protected winner: Player | null;
    protected gameStateHash: GameStateHash;

    constructor(me: Player, them: Player, board: Board) {
        if (me === them) {
            throw new Error('Players must be different');
        }
        // initiator first to simplify dehydrating and hashing...for now
        this.players = me.isInitiator ? [me, them] : [them, me];
        this.board = board;
        this.currentPlayer = this.players[0]; // let's always start with the first player, later we can randomize
        this.winner = null;
        this.gameStateHash = {};
    }

    abstract dehydrate(): string;

    abstract getStateHash(): Promise<string>;

    protected abstract _addHash(hash: string): void;

    protected abstract _validateHash(hash: string): boolean;

    // Public getters for read-only access
    get getCurrentPlayer(): Player {
        return this.currentPlayer;
    }
    
    get getWinner(): Player | null {
        return this.winner;
    }
    
    get getBoard(): Board {
        return this.board;
    }
    
    get getPlayers(): readonly Player[] {
        return Object.freeze([...this.players]);
    }
}

// for checking after turns that
// the peer is not trying to cheat.
// sending a move will be replicated
// on the recieving peer, validated
// and then the state hash for the previous
// and new turn will be additionally validated
export type GameStateHash = {
    [key: number]: string;
}

export interface Subscribable {
    subscribe(fn: (value: number) => void): void;
}

export class SubscribableNum extends Number implements Subscribable {
    private subscribers: ((value: number) => void)[] = [];

    constructor(value: number) {
        super(value);
    }

    subscribe(fn: (value: number) => void) {
        this.subscribers.push(fn);
    }

    set value(value: number) {
        this.valueOf = () => value;
        this.subscribers.forEach(fn => fn(value));
    }
}


/**
 * Main game class for Nine Men's Morris with peer-to-peer functionality
 */
export class NinePeersMorris extends Game {
    protected turn: SubscribableNum;
    private win: Window;
    private ready: boolean;
    public phase: GamePhase;
    public selectedPiece: GamePiece | null = null;
    public selectedCell: Cell | null = null;
    public validMoves: readonly Cell[] = [];
    public millToRemove: boolean = false;
    public removablePieces: readonly GamePiece[] = [];

    /**
     * Creates a new Nine Men's Morris game
     * @param win - Browser window object for cryptographic operations
     * @param me - The local player
     * @param them - The remote player
     */
    constructor(win: Window, me: Player, them: Player) {
        super(me, them, new NineBoard([me, them]));
        this.win = win;
        this.turn = new SubscribableNum(0);
        this.ready = true;
        this.phase = GamePhase.Placement;
        this.onTurnChange(0);
        this.turn.subscribe(this.onTurnChange.bind(this));
    }

    dehydrate(): string {
        return JSON.stringify({
            players: [this.players[0].dehydrate(), this.players[1].dehydrate()],
            currentPlayer: this.currentPlayer.id,
            winner: this.winner,
            turn: this.turn.valueOf()
        });
    }

    private onTurnChange(newTurn: number) {
        if (!this.ready) {
            throw new Error('Game not ready');
        }
        this.ready = false;
        this.getStateHash().then(hash => {
            this._addHash(hash, newTurn - 1); // this might need to change
            this.ready = true;
        });
    }

    async getStateHash(): Promise<string> {
        return getHash(this.win, this.dehydrate());
    }

    protected _addHash(hash: string, turn?: number): void {
        this.gameStateHash[turn || this.turn.value] = hash;
    }

    protected _validateHash(hash: string, turn?: number): boolean {
        return this.gameStateHash[turn || this.turn.value] === hash;
    }

    /** Checks if it's the local player's turn */
    isMyTurn(): boolean {
        return this.currentPlayer.id === this.players[0].id; // assuming first player is "me"
    }

    /** Gets the opponent of the specified player */
    getOpponent(player: Player): Player {
        return this.players.find(p => p.id !== player.id)!;
    }

    /** Checks if the current player can place a piece */
    canPlacePiece(): boolean {
        return this.phase === GamePhase.Placement && this.isMyTurn() && 
               this.currentPlayer.nextPiece !== null;
    }

    /** Checks if the current player can move a piece */
    canMovePiece(): boolean {
        return this.phase === GamePhase.Movement && this.isMyTurn();
    }

    /** Checks if the current player can remove an opponent's piece */
    canRemovePiece(): boolean {
        return this.phase === GamePhase.Capture && this.isMyTurn() && this.millToRemove;
    }

    /**
     * Gets valid moves for a piece
     * @param piece - The piece to get valid moves for
     * @returns Array of cells the piece can move to (readonly)
     */
    getValidMoves(piece: GamePiece): readonly Cell[] {
        if (this.phase !== GamePhase.Movement) return Object.freeze([]);
        return GameRules.getValidMovesForPiece(piece, this.board);
    }

    /**
     * Gets pieces that can be removed from the opponent
     * @param excludePlayer - The player whose pieces should not be considered for removal
     * @returns Array of opponent pieces that can be removed (readonly)
     */
    getRemovablePieces(excludePlayer: Player): readonly GamePiece[] {
        const opponent = this.getOpponent(excludePlayer);
        return GameRules.getRemovablePieces(opponent, this.board);
    }

    /**
     * Handles a cell click interaction
     * @param cell - The cell that was clicked
     * @returns The game move that was made, or null if no valid move
     */
    handleCellClick(cell: Cell): GameMove | null {
        if (!this.isMyTurn()) return null;

        switch (this.phase) {
            case GamePhase.Placement:
                return this.handlePlacementClick(cell);
            case GamePhase.Movement:
                return this.handleMovementClick(cell);
            case GamePhase.Capture:
                return this.handleCaptureClick(cell);
            default:
                return null;
        }
    }

    /**
     * Handles a cell click without turn validation (for multiplayer)
     */
    handleCellClickForced(cell: Cell): GameMove | null {
        switch (this.phase) {
            case GamePhase.Placement:
                return this.handlePlacementClickForced(cell);
            case GamePhase.Movement:
                return this.handleMovementClick(cell);
            case GamePhase.Capture:
                return this.handleCaptureClickForced(cell);
            default:
                return null;
        }
    }

    private handlePlacementClickForced(cell: Cell): GameMove | null {
        if (cell.piece || this.phase !== GamePhase.Placement || !this.currentPlayer.nextPiece) {
            console.log('Placement blocked:', {
                hasPiece: !!cell.piece,
                phase: this.phase,
                hasNextPiece: !!this.currentPlayer.nextPiece
            });
            return null;
        }

        const piece = this.currentPlayer.nextPiece!;
        this.board.placePiece(piece, cell);

        const move: GameMove = {
            action: GameAction.PlacePiece,
            playerId: this.currentPlayer.id,
            pieceId: piece.id,
            toCellId: cell.id
        };

        // Check for mill
        if (this.board.checkForMill(cell)) {
            console.log('Mill formed! Entering capture phase');
            this.millToRemove = true;
            const opponent = this.getOpponent(this.currentPlayer);
            this.removablePieces = Object.freeze(this.getRemovablePieces(this.currentPlayer));
            this.phase = GamePhase.Capture;
            console.log('Current player:', this.currentPlayer.name);
            console.log('Opponent:', opponent.name);
            console.log('Removable pieces:', this.removablePieces.length, this.removablePieces.map(p => ({id: p.id, player: p.player.name, cell: p.cell?.id})));
            // Don't change turn - current player continues to remove a piece
        } else {
            this.nextTurn();
        }

        return move;
    }

    private handlePlacementClick(cell: Cell): GameMove | null {
        if (cell.piece || !this.canPlacePiece()) return null;

        const piece = this.currentPlayer.nextPiece!;
        this.board.placePiece(piece, cell);

        const move: GameMove = {
            action: GameAction.PlacePiece,
            playerId: this.currentPlayer.id,
            pieceId: piece.id,
            toCellId: cell.id
        };

        // Check for mill
        if (this.board.checkForMill(cell)) {
            console.log('Mill formed! Entering capture phase');
            this.millToRemove = true;
            const opponent = this.getOpponent(this.currentPlayer);
            this.removablePieces = this.getRemovablePieces(this.currentPlayer);
            this.phase = GamePhase.Capture;
            console.log('Current player:', this.currentPlayer.name);
            console.log('Opponent:', opponent.name);
            console.log('Removable pieces:', this.removablePieces.length, this.removablePieces.map(p => ({id: p.id, player: p.player.name, cell: p.cell?.id})));
            // Don't change turn - current player continues to remove a piece
        } else {
            this.nextTurn();
        }

        return move;
    }

    private handleMovementClick(cell: Cell): GameMove | null {
        if (!this.canMovePiece()) return null;

        // If clicking on own piece, select it
        if (cell.piece && cell.piece.player.id === this.currentPlayer.id) {
            this.selectedPiece = cell.piece;
            this.validMoves = this.getValidMoves(cell.piece);
            return null;
        }

        // If clicking on empty cell with selected piece
        if (!cell.piece && this.selectedPiece && this.validMoves.includes(cell)) {
            const fromCell = this.selectedPiece.cell!;
            
            if (this.selectedPiece.player.pieceCount <= 3) {
                this.board.flyPiece(this.selectedPiece, cell);
            } else {
                this.board.movePiece(this.selectedPiece, cell);
            }

            const move: GameMove = {
                action: GameAction.MovePiece,
                playerId: this.currentPlayer.id,
                pieceId: this.selectedPiece.id,
                fromCellId: fromCell.id,
                toCellId: cell.id
            };

            this.selectedPiece = null;
            this.validMoves = [];

            // Check for mill
            if (this.board.checkForMill(cell)) {
                this.millToRemove = true;
                this.removablePieces = this.getRemovablePieces(this.currentPlayer);
                this.phase = GamePhase.Capture;
            } else {
                this.nextTurn();
            }

            return move;
        }

        return null;
    }

    private handleCaptureClickForced(cell: Cell): GameMove | null {
        if (this.phase !== GamePhase.Capture || !this.millToRemove || !cell.piece) {
            console.log('Forced capture blocked:', {
                phase: this.phase,
                millToRemove: this.millToRemove,
                hasPiece: !!cell.piece
            });
            return null;
        }

        if (!this.removablePieces.includes(cell.piece)) {
            console.log('Piece not removable:', {
                pieceId: cell.piece.id,
                playerName: cell.piece.player.name,
                removablePiecesCount: this.removablePieces.length,
                removablePieceIds: this.removablePieces.map(p => p.id)
            });
            return null;
        }

        const removedPieceId = cell.piece.id;
        this.board.removePiece(cell.piece);
        
        const move: GameMove = {
            action: GameAction.RemovePiece,
            playerId: this.currentPlayer.id,
            toCellId: cell.id,
            removedPieceId: removedPieceId
        };

        this.millToRemove = false;
        this.removablePieces = Object.freeze([]);
        
        // Check win condition
        if (this.checkWinCondition()) {
            this.phase = GamePhase.GameOver;
            this.winner = this.currentPlayer;
        } else {
            // Return to previous phase after capture
            if (this.players.every(p => p.unplacedPieces.length === 0)) {
                this.phase = GamePhase.Movement;
            } else {
                this.phase = GamePhase.Placement;
            }
            this.nextTurn();
        }

        return move;
    }

    private handleCaptureClick(cell: Cell): GameMove | null {
        if (!this.canRemovePiece() || !cell.piece) {
            console.log('Capture blocked:', {
                canRemove: this.canRemovePiece(),
                hasPiece: !!cell.piece,
                phase: this.phase,
                millToRemove: this.millToRemove,
                isMyTurn: this.isMyTurn()
            });
            return null;
        }

        if (!this.removablePieces.includes(cell.piece)) {
            console.log('Piece not removable:', {
                pieceId: cell.piece.id,
                playerName: cell.piece.player.name,
                removablePiecesCount: this.removablePieces.length,
                removablePieceIds: this.removablePieces.map(p => p.id)
            });
            return null;
        }

        const removedPieceId = cell.piece.id;
        this.board.removePiece(cell.piece);
        
        const move: GameMove = {
            action: GameAction.RemovePiece,
            playerId: this.currentPlayer.id,
            toCellId: cell.id,
            removedPieceId: removedPieceId
        };

        this.millToRemove = false;
        this.removablePieces = Object.freeze([]);
        
        // Check win condition
        if (this.checkWinCondition()) {
            this.phase = GamePhase.GameOver;
            this.winner = this.currentPlayer;
        } else {
            // Return to previous phase after capture
            if (this.players.every(p => p.unplacedPieces.length === 0)) {
                this.phase = GamePhase.Movement;
            } else {
                this.phase = GamePhase.Placement;
            }
            this.nextTurn();
        }

        return move;
    }

    private nextTurn(): void {
        // Switch players
        this.currentPlayer = this.getOpponent(this.currentPlayer);
        this.turn.value = this.turn.valueOf() + 1;

        // Check if placement phase is over
        if (this.phase === GamePhase.Placement) {
            this.phase = GameRules.getNextPhase(this.phase, this.players);
        }

        // Reset UI state
        this.selectedPiece = null;
        this.validMoves = Object.freeze([]);
    }

    private checkWinCondition(): boolean {
        const opponent = this.getOpponent(this.currentPlayer);
        return GameRules.hasPlayerWon(this.currentPlayer, opponent, this.phase, this.board);
    }

    // Additional getter for turn access
    get getTurn(): SubscribableNum {
        return this.turn;
    }

    // Apply a move received from peer
    applyMove(move: GameMove): boolean {
        try {
            console.log('Applying move from peer:', move);
            
            // Temporarily set to ready to avoid "Game not ready" errors
            const wasReady = this.ready;
            this.ready = true;
            
            const result = (() => {
                switch (move.action) {
                    case GameAction.PlacePiece:
                        return this.applyPlaceMove(move);
                    case GameAction.MovePiece:
                        return this.applyMovePieceMove(move);
                    case GameAction.RemovePiece:
                        return this.applyRemoveMove(move);
                    default:
                        console.error('Unknown move action:', move.action);
                        return false;
                }
            })();
            
            // Restore ready state
            this.ready = wasReady;
            return result;
        } catch (error) {
            console.error('Error applying move:', error);
            return false;
        }
    }

    private applyPlaceMove(move: GameMove): boolean {
        if (!move.toCellId && move.toCellId !== 0) return false;
        
        const cell = this.board.getCell(move.toCellId);
        const player = this.players.find(p => p.id === move.playerId);
        
        if (!cell || !player || cell.piece) {
            console.log('Apply move failed:', {
                cellExists: !!cell,
                playerExists: !!player,
                cellOccupied: !!cell?.piece,
                moveData: move
            });
            return false;
        }
        
        const piece = player.nextPiece;
        if (!piece || piece.id !== move.pieceId) {
            console.log('Piece validation failed:', {
                pieceExists: !!piece,
                expectedPieceId: move.pieceId,
                actualPieceId: piece?.id
            });
            return false;
        }
        
        // Apply the move
        this.board.placePiece(piece, cell);
        
        // Check for mill and update game state
        if (this.board.checkForMill(cell)) {
            this.millToRemove = true;
            this.removablePieces = Object.freeze(this.getRemovablePieces(player));
            this.phase = GamePhase.Capture;
        } else {
            // Update current player and trigger reactive updates
            this.currentPlayer = this.getOpponent(player);
            
            // Update turn counter normally
            this.turn.value = this.turn.valueOf() + 1;
            
            // Check if placement phase is over
            if (this.phase === GamePhase.Placement) {
                this.phase = GameRules.getNextPhase(this.phase, this.players);
            }
            
            // Reset UI state
            this.selectedPiece = null;
            this.validMoves = Object.freeze([]);
        }
        
        return true;
    }

    private applyMovePieceMove(move: GameMove): boolean {
        if (!move.fromCellId && move.fromCellId !== 0) return false;
        if (!move.toCellId && move.toCellId !== 0) return false;
        
        const fromCell = this.board.getCell(move.fromCellId);
        const toCell = this.board.getCell(move.toCellId);
        const player = this.players.find(p => p.id === move.playerId);
        
        if (!fromCell || !toCell || !player || !fromCell.piece || toCell.piece) return false;
        if (fromCell.piece.id !== move.pieceId) return false;
        
        // Apply the move
        this.board.movePiece(fromCell.piece, toCell);
        
        // Check for mill and update game state
        if (this.board.checkForMill(toCell)) {
            this.millToRemove = true;
            this.removablePieces = Object.freeze(this.getRemovablePieces(this.getOpponent(player)));
            this.phase = GamePhase.Capture;
        } else {
            // Update current player and trigger reactive updates
            this.currentPlayer = this.getOpponent(player);
            this.turn.value = this.turn.valueOf() + 1;
            
            // Reset UI state
            this.selectedPiece = null;
            this.validMoves = Object.freeze([]);
        }
        
        return true;
    }

    private applyRemoveMove(move: GameMove): boolean {
        if (!move.toCellId && move.toCellId !== 0) return false;
        
        const cell = this.board.getCell(move.toCellId);
        if (!cell || !cell.piece) return false;
        if (cell.piece.id !== move.removedPieceId) return false;
        
        // Apply the remove
        this.board.removePiece(cell.piece);
        
        // Reset capture phase
        this.millToRemove = false;
        this.removablePieces = Object.freeze([]);
        
        // Check win condition
        if (this.checkWinCondition()) {
            this.phase = GamePhase.GameOver;
            this.winner = this.currentPlayer;
        } else {
            // Return to previous phase after capture
            if (this.players.every(p => p.unplacedPieces.length === 0)) {
                this.phase = GamePhase.Movement;
            } else {
                this.phase = GamePhase.Placement;
            }
            
            // Update current player and trigger reactive updates
            this.currentPlayer = this.getOpponent(this.currentPlayer);
            this.turn.value = this.turn.valueOf() + 1;
            
            // Reset UI state
            this.selectedPiece = null;
            this.validMoves = Object.freeze([]);
        }
        
        return true;
    }
}
