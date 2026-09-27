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
};

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
		this.removedPieces = [];
		this.isWinner = false;
	}
	addPiece(piece: GamePiece) {
		this.pieces.push(piece);
	}

	addPieces(pieces: GamePiece[]) {
		this.pieces.push(...pieces);
	}
	removePiece(piece: GamePiece) {
		this.pieces = this.pieces.filter((p) => p !== piece);
		this.removedPieces.push(piece);
	}
	/** Gets the total number of pieces owned by this player */
	get pieceCount(): number {
		return this.pieces.length;
	}

	/** Gets the next unplaced piece available for placement, or null if none */
	get nextPiece(): GamePiece | null {
		const availablePieces = this.pieces.filter((piece) => piece.state === 'unplaced');
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
		return Object.freeze(this.pieces.filter((piece) => piece.state === 'placed'));
	}

	/** Gets all pieces that are not yet placed on the board (readonly) */
	get unplacedPieces(): readonly GamePiece[] {
		return Object.freeze(this.pieces.filter((piece) => piece.state === 'unplaced'));
	}
	dehydrate(): string {
		return JSON.stringify({
			id: this.id,
			name: this.name,
			pieces: this.pieces.map((piece) => piece.dehydrate()),
			removed: this.removedPieces.map((piece) => piece.id),
			isWinner: this.isWinner,
			isInitiator: this.isInitiator
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
			piece: this.piece ? this.piece.dehydrate() : null
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
			id: this.id,
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
	/** Explicit lists of cell ids that form a mill. When omitted, mills are detected by row/col. */
	mills?: number[][];
};

export const defaultOptions: BoardOptions = {
	cells: 24,
	pieces: 18,
	players: [],
	millCount: 3,
	fly: false,
	flyAt: 0
};

export class Board implements Hashable {
	nPlayers: number = 2;
	cellCount: number;
	pieceCount: number;
	state: Graph<Cell>;
	millCount: number;
	players: Player[];
	fly: boolean;
	flyAt: number;
	mills: number[][] | null;
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
		this.players.forEach((player) => {
			player.reset();
			player.addPieces(
				Array.from(
					{ length: this.pieceCount / this.nPlayers },
					(_, i) => new GamePiece(player, i.toString())
				)
			);
		});
		this.fly = options.fly!;
		this.flyAt = options.flyAt!;
		this.mills = options.mills ?? null;

		if (options.graph) {
			this.state = options.graph;
		} else {
			this.state = new Graph<Cell>(
				Array.from({ length: this.cellCount }, (_, i) => {
					const row = Math.floor(i / 3);
					const col = i % 3;
					const cell = new Cell(i, row, col);
					this[i] = cell;
					return cell;
				})
			);
		}
	}

	getCell(id: number) {
		return this.state.filter((cell) => cell.id === id)[0];
	}

	getCellByRowCol(row: number, col: number) {
		return this.state.filter((cell) => cell.row === row && cell.col === col)[0];
	}

	checkForMill(cell: Cell) {
		if (!cell.piece) {
			return false;
		}
		const player = cell.piece.player;
		if (this.mills) {
			return this.mills.some(
				(line) =>
					line.includes(cell.id) && line.every((id) => this.getCell(id)?.piece?.player === player)
			);
		}
		const cellsWithPlayerPiece = this.state.contiguousBreathFirstSearch(
			cell,
			(c) =>
				c.piece !== null && c.piece.player === player && (c.row === cell.row || c.col === cell.col)
		);

		if (cellsWithPlayerPiece.length < this.millCount) {
			return false;
		}
		// now check if there are three in a row
		// i.e. there are three cells in a row or column
		const rowCells = cellsWithPlayerPiece.filter((c) => c.row === cell.row);
		const colCells = cellsWithPlayerPiece.filter((c) => c.col === cell.col);

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
			players: this.players.map((player) => player.dehydrate()),
			state: this.state.dehydrate(),
			millCount: this.millCount,
			pieceCount: this.pieceCount,
			cellCount: this.cellCount
		});
	}
}

export class NineBoard extends Board {
	/** Every line of three cells that forms a mill (see the diagram below). */
	static readonly MILLS: number[][] = [
		// horizontal
		[0, 1, 2],
		[3, 4, 5],
		[6, 7, 8],
		[9, 10, 11],
		[12, 13, 14],
		[15, 16, 17],
		[18, 19, 20],
		[21, 22, 23],
		// vertical
		[0, 9, 21],
		[3, 10, 18],
		[6, 11, 15],
		[1, 4, 7],
		[16, 19, 22],
		[8, 12, 17],
		[5, 13, 20],
		[2, 14, 23]
	];

	constructor(players: Player[]) {
		const cells: Cell[] = [];
		const graph = new Graph<Cell>(
			Array.from({ length: 24 }, (_, i) => {
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
				const col = (i - 1) % 3;
				const cell = new Cell(i, 3, col);
				cells.push(cell);
				return cell;
			})
		);
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
		graph.addEdgesByFilter(
			(cell) => cell.id === 0,
			(cell) => cell.id === 1 || cell.id === 9
		);
		graph.addEdgesByFilter(
			(cell) => cell.id === 1,
			(cell) => cell.id === 2 || cell.id === 4
		);
		graph.addEdgesByFilter(
			(cell) => cell.id === 2,
			(cell) => cell.id === 14
		);
		graph.addEdgesByFilter(
			(cell) => cell.id === 3,
			(cell) => cell.id === 4 || cell.id === 10
		);
		graph.addEdgesByFilter(
			(cell) => cell.id === 4,
			(cell) => cell.id === 5 || cell.id === 7
		);
		graph.addEdgesByFilter(
			(cell) => cell.id === 5,
			(cell) => cell.id === 13
		);
		graph.addEdgesByFilter(
			(cell) => cell.id === 6,
			(cell) => cell.id === 7 || cell.id === 11
		);
		graph.addEdgesByFilter(
			(cell) => cell.id === 7,
			(cell) => cell.id === 8
		);
		graph.addEdgesByFilter(
			(cell) => cell.id === 8,
			(cell) => cell.id === 12
		);
		graph.addEdgesByFilter(
			(cell) => cell.id === 9,
			(cell) => cell.id === 10 || cell.id === 21
		);
		graph.addEdgesByFilter(
			(cell) => cell.id === 10,
			(cell) => cell.id === 11 || cell.id === 18
		);
		graph.addEdgesByFilter(
			(cell) => cell.id === 11,
			(cell) => cell.id === 15
		);
		graph.addEdgesByFilter(
			(cell) => cell.id === 12,
			(cell) => cell.id === 13 || cell.id === 17
		);
		graph.addEdgesByFilter(
			(cell) => cell.id === 13,
			(cell) => cell.id === 14 || cell.id === 20
		);
		graph.addEdgesByFilter(
			(cell) => cell.id === 14,
			(cell) => cell.id === 23
		);
		graph.addEdgesByFilter(
			(cell) => cell.id === 15,
			(cell) => cell.id === 16
		);
		graph.addEdgesByFilter(
			(cell) => cell.id === 16,
			(cell) => cell.id === 17 || cell.id === 19
		);
		graph.addEdgesByFilter(
			(cell) => cell.id === 18,
			(cell) => cell.id === 19
		);
		graph.addEdgesByFilter(
			(cell) => cell.id === 19,
			(cell) => cell.id === 20 || cell.id === 22
		);
		graph.addEdgesByFilter(
			(cell) => cell.id === 21,
			(cell) => cell.id === 22
		);
		graph.addEdgesByFilter(
			(cell) => cell.id === 22,
			(cell) => cell.id === 23
		);

		const options: BoardOptions = {
			cells: 24,
			pieces: 18,
			players: players,
			graph: graph,
			millCount: 3,
			fly: true,
			flyAt: 3,
			mills: NineBoard.MILLS
		};
		super(options);
		for (let i = 0; i < 24; i++) {
			this[i] = cells[i];
		}
	}
}

export abstract class Game implements Hashable {
	protected turn: SubscribableNum;
	public millToRemove: boolean = false;
	protected players: Player[];
	protected board: Board;
	protected currentPlayer: Player;
	protected winner: Player | null;
	public validMoves: readonly Cell[] = [];
	public removablePieces: readonly GamePiece[] = [];
	public phase: GamePhase;
	/** The id of the player controlling this client, or null for local hot-seat play */
	public localPlayerId: string | null;
	public abstract get selectionVersion(): number;
	public abstract selectedPiece: GamePiece | null;
	private changeListeners = new Set<() => void>();

	constructor(me: Player, them: Player, board: Board, localPlayerId: string | null = null) {
		if (me === them) {
			throw new Error('Players must be different');
		}
		this.turn = new SubscribableNum(0);
		this.phase = GamePhase.Placement;
		// initiator first so both peers dehydrate (and hash) the game identically
		this.players = me.isInitiator ? [me, them] : [them, me];
		this.board = board;
		this.currentPlayer = this.players[0];
		this.winner = null;
		this.localPlayerId = localPlayerId;
	}

	abstract canPlacePiece(): boolean;

	abstract isMyTurn(): boolean;

	abstract handleCellClick(cell: Cell): GameMove | null;
	abstract handleCellClickForced(cell: Cell): GameMove | null;

	abstract dehydrate(): string;

	abstract restore(dehydratedState: string): void;

	abstract applyMove(move: unknown): boolean;

	abstract forfeit(playerId: string): void;

	abstract getStateHash(): Promise<string>;

	/**
	 * Registers a listener that is called whenever the game state changes
	 * (moves, selection, phase, winner). Returns an unsubscribe function.
	 */
	onChange(fn: () => void): () => void {
		this.changeListeners.add(fn);
		return () => this.changeListeners.delete(fn);
	}

	protected notifyChange(): void {
		this.changeListeners.forEach((fn) => fn());
	}

	// Public getters for read-only access
	get getCurrentPlayer(): Player {
		return this.currentPlayer;
	}

	get getTurn(): SubscribableNum {
		return this.turn;
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

	/** The player controlling this client, or null in hot-seat mode */
	get localPlayer(): Player | null {
		return this.players.find((p) => p.id === this.localPlayerId) ?? null;
	}
}

export interface Subscribable {
	subscribe(fn: (value: number) => void): () => void;
}

export class SubscribableNum extends Number implements Subscribable {
	private subscribers = new Set<(value: number) => void>();
	private current: number;

	constructor(value: number) {
		super(value);
		this.current = value;
	}

	valueOf(): number {
		return this.current;
	}

	subscribe(fn: (value: number) => void): () => void {
		this.subscribers.add(fn);
		return () => this.subscribers.delete(fn);
	}

	get value(): number {
		return this.current;
	}

	set value(value: number) {
		this.set(value);
	}

	/** Sets the value, optionally without notifying subscribers */
	set(value: number, notify: boolean = true) {
		this.current = value;
		if (notify) {
			this.subscribers.forEach((fn) => fn(value));
		}
	}
}

function isCellId(value: unknown, board: Board): value is number {
	return (
		typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < board.cellCount
	);
}

/**
 * Main game class for Nine Men's Morris with peer-to-peer functionality
 */
export class NinePeersMorris extends Game {
	private win: Window;
	public selectedPiece: GamePiece | null = null;
	public selectedCell: Cell | null = null;

	// Reactive counter to trigger UI updates when selection changes
	private _selectionVersion = 0;
	public get selectionVersion(): number {
		return this._selectionVersion;
	}

	/**
	 * Creates a new Nine Men's Morris game
	 * @param win - Browser window object for cryptographic operations
	 * @param me - The local player
	 * @param them - The remote player
	 * @param localPlayerId - Id of the player this client controls; null lets both players
	 *   take turns on this client (hot-seat / demo mode)
	 */
	constructor(win: Window, me: Player, them: Player, localPlayerId: string | null = null) {
		super(me, them, new NineBoard([me, them]), localPlayerId);
		this.win = win;
	}

	dehydrate(): string {
		return JSON.stringify({
			players: [this.players[0].dehydrate(), this.players[1].dehydrate()],
			currentPlayer: this.currentPlayer.id,
			winner: this.winner ? this.winner.id : null,
			turn: this.turn.valueOf(),
			board: this.board.state.dehydrate(),
			phase: this.phase,
			millToRemove: this.millToRemove
		});
	}

	/**
	 * Restores a game from dehydrated state
	 */
	static async rehydrate(
		win: Window,
		dehydratedState: string,
		localPlayerId: string | null = null
	): Promise<NinePeersMorris> {
		const data = JSON.parse(dehydratedState);
		const p1Data = JSON.parse(data.players[0]);
		const p2Data = JSON.parse(data.players[1]);
		const player1 = new Player(String(p1Data.id), String(p1Data.name), p1Data.isInitiator ?? true);
		const player2 = new Player(String(p2Data.id), String(p2Data.name), p2Data.isInitiator ?? false);
		const game = new NinePeersMorris(win, player1, player2, localPlayerId);
		game.restore(dehydratedState);
		return game;
	}

	/**
	 * Replaces this game's state with a dehydrated state for the same two players.
	 * Throws (leaving the game unchanged) if the state is malformed or inconsistent.
	 */
	restore(dehydratedState: string): void {
		const data = JSON.parse(dehydratedState);
		if (!data || !Array.isArray(data.players) || data.players.length !== 2) {
			throw new Error('Invalid game state: players');
		}
		const playerData = data.players.map((p: string) => JSON.parse(p));
		const byId = new Map(this.players.map((p) => [p.id, p]));
		for (const pd of playerData) {
			if (!byId.has(pd.id)) throw new Error('Invalid game state: unknown player');
		}
		if (new Set(playerData.map((pd: { id: string }) => pd.id)).size !== 2) {
			throw new Error('Invalid game state: duplicate player');
		}
		if (!Object.values(GamePhase).includes(data.phase)) {
			throw new Error('Invalid game state: phase');
		}
		if (!byId.has(data.currentPlayer)) throw new Error('Invalid game state: current player');
		if (data.winner !== null && data.winner !== undefined && !byId.has(data.winner)) {
			throw new Error('Invalid game state: winner');
		}
		const turn = Number(data.turn ?? 0);
		if (!Number.isInteger(turn) || turn < 0) throw new Error('Invalid game state: turn');

		const boardData = typeof data.board === 'string' ? JSON.parse(data.board) : [];
		const placements: { cell: Cell; owner: Player; pieceId: string | null }[] = [];
		for (const vertexEntry of boardData) {
			const cellData = JSON.parse(vertexEntry.vertex);
			if (!cellData.piece) continue;
			const pieceData = JSON.parse(cellData.piece);
			const owner = byId.get(pieceData.player);
			if (!owner || !isCellId(cellData.id, this.board)) {
				throw new Error('Invalid game state: board');
			}
			placements.push({
				cell: this.board.getCell(cellData.id),
				owner,
				pieceId: pieceData.id !== undefined ? String(pieceData.id) : null
			});
		}

		const perPlayer = this.board.pieceCount / this.board.nPlayers;
		const removedById = new Map<string, string[]>();
		for (const pd of playerData) {
			const removed: string[] = Array.isArray(pd.removed) ? pd.removed.map(String) : [];
			const placedCount = placements.filter((pl) => pl.owner.id === pd.id).length;
			if (removed.length + placedCount > perPlayer) {
				throw new Error('Invalid game state: too many pieces');
			}
			removedById.set(pd.id, removed);
		}

		// validation passed, rebuild the state from scratch
		this.board.state.filter(() => true).forEach((cell) => (cell.piece = null));
		for (const player of this.players) {
			player.reset();
			player.addPieces(
				Array.from({ length: perPlayer }, (_, i) => new GamePiece(player, i.toString()))
			);
			for (const id of removedById.get(player.id)!) {
				const piece = player.allPieces.find((p) => p.id === id && p.state === 'unplaced');
				if (!piece) throw new Error('Invalid game state: removed piece');
				piece.state = 'removed';
				player.removePiece(piece);
			}
		}
		for (const { cell, owner, pieceId } of placements) {
			const piece =
				owner.unplacedPieces.find((p) => p.id === pieceId) ?? owner.unplacedPieces[0] ?? null;
			if (!piece) throw new Error('Invalid game state: piece');
			this.board.placePiece(piece, cell);
		}

		this.currentPlayer = byId.get(data.currentPlayer)!;
		this.winner = data.winner ? byId.get(data.winner)! : null;
		this.phase = data.phase;
		this.millToRemove = this.phase === GamePhase.Capture && data.millToRemove !== false;
		this.removablePieces = this.millToRemove
			? this.getRemovablePieces(this.currentPlayer)
			: Object.freeze([]);
		this.clearSelection();
		this.turn.set(turn, false);
		this.notifyChange();
	}

	async getStateHash(): Promise<string> {
		return getHash(this.win, this.dehydrate());
	}

	/** Checks if it's the local player's turn (always true in hot-seat mode) */
	isMyTurn(): boolean {
		if (this.phase === GamePhase.GameOver) return false;
		return this.localPlayerId === null || this.currentPlayer.id === this.localPlayerId;
	}

	/** Gets the opponent of the specified player */
	getOpponent(player: Player): Player {
		return this.players.find((p) => p.id !== player.id)!;
	}

	/** Checks if the current player can place a piece */
	canPlacePiece(): boolean {
		return (
			this.phase === GamePhase.Placement && this.isMyTurn() && this.currentPlayer.nextPiece !== null
		);
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
	 * Handles a cell click by the local player
	 * @param cell - The cell that was clicked
	 * @returns The game move that was made, or null if no valid move
	 */
	handleCellClick(cell: Cell): GameMove | null {
		if (!this.isMyTurn()) return null;
		return this.handleCellClickForced(cell);
	}

	/**
	 * Handles a cell click on behalf of the current player, without checking
	 * which player this client controls. All game rules are still enforced.
	 */
	handleCellClickForced(cell: Cell): GameMove | null {
		switch (this.phase) {
			case GamePhase.Placement:
				return this.tryPlace(this.currentPlayer, cell);
			case GamePhase.Movement:
				return this.handleMovementClick(cell);
			case GamePhase.Capture:
				return this.tryRemove(this.currentPlayer, cell);
			default:
				return null;
		}
	}

	private handleMovementClick(cell: Cell): GameMove | null {
		// Clicking one of your own pieces toggles its selection
		if (cell.piece && cell.piece.player === this.currentPlayer) {
			if (this.selectedPiece === cell.piece) {
				this.clearSelection();
			} else {
				this.selectedPiece = cell.piece;
				this.selectedCell = cell;
				this.validMoves = this.getValidMoves(cell.piece);
				this._selectionVersion++;
			}
			this.notifyChange();
			return null;
		}

		if (this.selectedPiece?.cell && this.validMoves.includes(cell)) {
			return this.tryMove(this.currentPlayer, this.selectedPiece.cell, cell);
		}

		// Clicking elsewhere clears the selection
		if (this.selectedPiece) {
			this.clearSelection();
			this.notifyChange();
		}
		return null;
	}

	private clearSelection() {
		if (this.selectedPiece || this.selectedCell || this.validMoves.length > 0) {
			this._selectionVersion++;
		}
		this.selectedPiece = null;
		this.selectedCell = null;
		this.validMoves = Object.freeze([]);
	}

	/** Places the player's next piece on the cell, if that is a legal move */
	private tryPlace(player: Player, cell: Cell): GameMove | null {
		if (this.phase !== GamePhase.Placement || player !== this.currentPlayer || cell.piece) {
			return null;
		}
		const piece = player.nextPiece;
		if (!piece) return null;

		this.board.placePiece(piece, cell);
		const move: GameMove = {
			action: GameAction.PlacePiece,
			playerId: player.id,
			pieceId: piece.id,
			toCellId: cell.id
		};
		this.afterPieceLanded(player, cell);
		return move;
	}

	/** Moves (or flies) the player's piece between cells, if that is a legal move */
	private tryMove(player: Player, fromCell: Cell, toCell: Cell): GameMove | null {
		if (this.phase !== GamePhase.Movement || player !== this.currentPlayer) return null;
		const piece = fromCell.piece;
		if (!piece || piece.player !== player || toCell.piece) return null;
		if (!GameRules.getValidMovesForPiece(piece, this.board).includes(toCell)) return null;

		if (GameRules.canPlayerFly(player)) {
			this.board.flyPiece(piece, toCell);
		} else {
			this.board.movePiece(piece, toCell);
		}
		const move: GameMove = {
			action: GameAction.MovePiece,
			playerId: player.id,
			pieceId: piece.id,
			fromCellId: fromCell.id,
			toCellId: toCell.id
		};
		this.afterPieceLanded(player, toCell);
		return move;
	}

	/** Removes an opponent's piece after a mill, if that is a legal removal */
	private tryRemove(player: Player, cell: Cell): GameMove | null {
		if (this.phase !== GamePhase.Capture || !this.millToRemove || player !== this.currentPlayer) {
			return null;
		}
		const piece = cell.piece;
		if (!piece || piece.player === player || !this.removablePieces.includes(piece)) {
			return null;
		}

		this.board.removePiece(piece);
		const move: GameMove = {
			action: GameAction.RemovePiece,
			playerId: player.id,
			toCellId: cell.id,
			removedPieceId: piece.id
		};
		this.millToRemove = false;
		this.removablePieces = Object.freeze([]);

		const opponent = this.getOpponent(player);
		if (GameRules.hasPlayerWon(player, opponent, GamePhase.Capture, this.board)) {
			this.endGame(player);
		} else {
			this.endTurn();
		}
		return move;
	}

	/** After a place or move: enter capture if a mill formed, otherwise end the turn */
	private afterPieceLanded(player: Player, cell: Cell) {
		this.clearSelection();
		if (this.board.checkForMill(cell)) {
			const removable = this.getRemovablePieces(player);
			if (removable.length > 0) {
				this.millToRemove = true;
				this.removablePieces = removable;
				this.phase = GamePhase.Capture;
				this.notifyChange();
				return;
			}
		}
		this.endTurn();
	}

	private endTurn(): void {
		const mover = this.currentPlayer;
		const next = this.getOpponent(mover);

		// update all state before notifying anyone
		this.phase = this.players.every((p) => p.unplacedPieces.length === 0)
			? GamePhase.Movement
			: GamePhase.Placement;
		this.currentPlayer = next;
		this.clearSelection();

		// the next player loses if they have too few pieces or cannot move
		if (
			this.phase === GamePhase.Movement &&
			GameRules.hasPlayerWon(mover, next, GamePhase.Movement, this.board)
		) {
			this.endGame(mover);
			return;
		}

		this.turn.value = this.turn.valueOf() + 1;
		this.notifyChange();
	}

	private endGame(winner: Player) {
		this.phase = GamePhase.GameOver;
		this.winner = winner;
		this.millToRemove = false;
		this.removablePieces = Object.freeze([]);
		this.clearSelection();
		this.turn.value = this.turn.valueOf() + 1;
		this.notifyChange();
	}

	/** Ends the game with the given player forfeiting */
	forfeit(playerId: string): void {
		const loser = this.players.find((p) => p.id === playerId);
		if (!loser || this.phase === GamePhase.GameOver) return;
		this.endGame(this.getOpponent(loser));
	}

	/**
	 * Applies a move received from the remote peer. The move is treated as untrusted:
	 * it must be well-formed, made by the player whose turn it is (never the local
	 * player), and legal under the same rules as a local click.
	 */
	applyMove(move: unknown): boolean {
		try {
			if (!move || typeof move !== 'object') return false;
			const m = move as Record<string, unknown>;
			if (typeof m.playerId !== 'string') return false;

			const player = this.players.find((p) => p.id === m.playerId);
			if (!player || player !== this.currentPlayer) return false;
			if (this.localPlayerId !== null && player.id === this.localPlayerId) return false;
			if (!isCellId(m.toCellId, this.board)) return false;
			const toCell = this.board.getCell(m.toCellId);

			switch (m.action) {
				case GameAction.PlacePiece:
					if (player.nextPiece?.id !== m.pieceId) return false;
					return this.tryPlace(player, toCell) !== null;
				case GameAction.MovePiece: {
					if (!isCellId(m.fromCellId, this.board)) return false;
					const fromCell = this.board.getCell(m.fromCellId);
					if (fromCell.piece?.id !== m.pieceId) return false;
					return this.tryMove(player, fromCell, toCell) !== null;
				}
				case GameAction.RemovePiece:
					if (toCell.piece?.id !== m.removedPieceId) return false;
					return this.tryRemove(player, toCell) !== null;
				default:
					return false;
			}
		} catch (error) {
			console.error('Error applying move:', error);
			return false;
		}
	}
}
