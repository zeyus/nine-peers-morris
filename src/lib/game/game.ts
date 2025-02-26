import { Graph } from './graph';
import { type Hashable, getHash } from './hashable';

export class Player implements Hashable {
    readonly id: string;
    readonly name: string;
    protected pieces: GamePiece[];
    protected removedPieces: GamePiece[];
    readonly isInitiator: boolean;
    protected isWinner: boolean;

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
    get pieceCount(): number {
        return this.pieces.length;
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
        if (piece.player.pieceCount >= this.flyAt) {
            throw new Error('Invalid move, player has enough pieces to fly');
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
            millCount: 3
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


export class NinePeersMorris extends Game {
    protected turn: SubscribableNum;
    private win: Window;
    private ready: boolean;

    constructor(win: Window, me: Player, them: Player) {
        super(me, them, new NineBoard([me, them]));
        this.win = win;
        this.turn = new SubscribableNum(0);
        this.ready = true;
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
}
