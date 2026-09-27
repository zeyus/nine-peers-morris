import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NinePeersMorris, Player, GamePhase, GameAction, NineBoard, type GameMove } from './game';
import { createMockWindow } from './test-utils';

vi.mock('./hashable', () => ({
	getHash: vi.fn().mockResolvedValue('mock-hash'),
	getUUID: vi.fn().mockReturnValue('mock-uuid')
}));

function newGame(localPlayerId: string | null = null) {
	const p1 = new Player('p1', 'X', true);
	const p2 = new Player('p2', 'O', false);
	return { p1, p2, game: new NinePeersMorris(createMockWindow() as Window, p1, p2, localPlayerId) };
}

function click(game: NinePeersMorris, ...cellIds: number[]) {
	return cellIds.map((id) => game.handleCellClick(game.getBoard.getCell(id)));
}

describe('mill detection', () => {
	let board: NineBoard;
	let p1: Player;

	beforeEach(() => {
		p1 = new Player('p1', 'X', true);
		board = new NineBoard([p1, new Player('p2', 'O', false)]);
	});

	it.each(NineBoard.MILLS)('detects mill %j', (...line) => {
		line.forEach((id) => board.placePiece(p1.nextPiece!, board.getCell(id)));
		line.forEach((id) => expect(board.checkForMill(board.getCell(id))).toBe(true));
	});

	it('does not detect lines that are not mills', () => {
		// adjacent, but these cells are not on one straight line
		[10, 11, 15].forEach((id) => board.placePiece(p1.nextPiece!, board.getCell(id)));
		expect(board.checkForMill(board.getCell(11))).toBe(false);
	});

	it('only uses valid board edges for every mill', () => {
		for (const [a, b, c] of NineBoard.MILLS) {
			expect(board.state.isAdjacent(board.getCell(a), board.getCell(b))).toBe(true);
			expect(board.state.isAdjacent(board.getCell(b), board.getCell(c))).toBe(true);
		}
	});
});

describe('turn handling', () => {
	it('lets both players take turns in hot-seat mode', () => {
		const { game, p1, p2 } = newGame();
		expect(click(game, 0)[0]?.playerId).toBe(p1.id);
		expect(click(game, 21)[0]?.playerId).toBe(p2.id);
		expect(game.getCurrentPlayer).toBe(p1);
	});

	it('only lets the local player act in multiplayer', () => {
		const { game } = newGame('p2');
		expect(game.isMyTurn()).toBe(false);
		expect(click(game, 0)[0]).toBeNull();
		expect(game.getBoard.getCell(0).piece).toBeNull();
	});

	it('updates phase before notifying turn subscribers', () => {
		const { game } = newGame();
		const seen: GamePhase[] = [];
		game.getTurn.subscribe(() => seen.push(game.phase));
		// play out the whole placement phase, capturing whenever a mill forms
		for (
			let i = 0;
			i < 60 && game.phase !== GamePhase.Movement && game.phase !== GamePhase.GameOver;
			i++
		) {
			if (game.phase === GamePhase.Capture) {
				game.handleCellClick(game.removablePieces[0].cell!);
				continue;
			}
			const empty = game.getBoard.state.filter((c) => !c.piece)[0];
			expect(game.handleCellClick(empty)).not.toBeNull();
		}
		expect(game.phase === GamePhase.Movement || game.phase === GamePhase.GameOver).toBe(true);
		expect(seen.at(-1)).toBe(game.phase);
	});

	it('notifies change listeners and supports unsubscribe', () => {
		const { game } = newGame();
		const fn = vi.fn();
		const off = game.onChange(fn);
		click(game, 0);
		expect(fn).toHaveBeenCalled();
		off();
		fn.mockClear();
		click(game, 1);
		expect(fn).not.toHaveBeenCalled();
	});
});

describe('win conditions', () => {
	it('declares a win when the opponent is blocked after a move', () => {
		const { game, p1, p2 } = newGame();
		game.phase = GamePhase.Movement;
		// p2 holds the four outer corners, p1 surrounds them except for 9
		const place = (player: Player, id: number) =>
			game.getBoard.placePiece(player.nextPiece!, game.getBoard.getCell(id));
		[0, 2, 21, 23].forEach((id) => place(p2, id));
		[1, 14, 22, 10].forEach((id) => place(p1, id));
		// the remaining pieces were captured earlier
		p1.unplacedPieces.forEach((piece) => p1.removePiece(piece));
		p2.unplacedPieces.forEach((piece) => p2.removePiece(piece));
		expect(p2.pieceCount).toBe(4); // too many pieces to fly

		// p1 closes the last gap: 10 -> 9 leaves p2 without a legal move
		click(game, 10, 9);
		expect(game.phase).toBe(GamePhase.GameOver);
		expect(game.getWinner).toBe(p1);
	});

	it('forfeit awards the win to the opponent', () => {
		const { game, p1 } = newGame();
		game.forfeit('p2');
		expect(game.getWinner).toBe(p1);
		expect(game.phase).toBe(GamePhase.GameOver);
		expect(game.isMyTurn()).toBe(false);
	});
});

describe('applyMove (untrusted peer input)', () => {
	let game: NinePeersMorris;
	beforeEach(() => {
		// we are p2, the peer is p1 and moves first
		game = newGame('p2').game;
	});

	const place = (cell: number, pieceId = '0', playerId = 'p1'): GameMove => ({
		action: GameAction.PlacePiece,
		playerId,
		pieceId,
		toCellId: cell
	});

	it('accepts a legal move from the current player', () => {
		expect(game.applyMove(place(0))).toBe(true);
		expect(game.getBoard.getCell(0).piece?.player.id).toBe('p1');
	});

	it('rejects moves made on behalf of the local player', () => {
		game.applyMove(place(0));
		expect(game.applyMove(place(1, '0', 'p2'))).toBe(false);
	});

	it('rejects out-of-turn moves', () => {
		game.applyMove(place(0));
		expect(game.applyMove(place(1, '1', 'p1'))).toBe(false);
	});

	it.each([
		null,
		'x',
		{},
		{ action: 'place_piece', playerId: 'p1', pieceId: '0', toCellId: 24 },
		{ action: 'place_piece', playerId: 'p1', pieceId: '0', toCellId: -1 },
		{ action: 'place_piece', playerId: 'p1', pieceId: '0', toCellId: 1.5 },
		{ action: 'place_piece', playerId: 'p1', pieceId: '0', toCellId: '3' },
		{ action: 'nope', playerId: 'p1', toCellId: 3 },
		{ action: 'move_piece', playerId: 'p1', pieceId: '0', fromCellId: 0, toCellId: 1 },
		{ action: 'remove_piece', playerId: 'p1', toCellId: 0, removedPieceId: '0' }
	])('rejects malformed or illegal move %j', (move) => {
		expect(game.applyMove(move)).toBe(false);
		expect(game.getTurn.valueOf()).toBe(0);
	});

	it('rejects removing a piece in a mill while other pieces are removable', () => {
		// p2 (local) builds the mill 21-22-23 (capturing p1's 9) plus a loose piece at 5,
		// then p1 completes 0-1-2
		const peer = (cell: number) =>
			expect(game.applyMove(place(cell, game.getCurrentPlayer.nextPiece!.id))).toBe(true);
		const local = (cell: number) =>
			expect(game.handleCellClick(game.getBoard.getCell(cell))).not.toBeNull();
		peer(0);
		local(21);
		peer(1);
		local(22);
		peer(9);
		local(23);
		expect(game.phase).toBe(GamePhase.Capture);
		local(9);
		peer(10);
		local(5);
		peer(2);
		expect(game.phase).toBe(GamePhase.Capture);
		const removeAt = (cell: number): GameMove => ({
			action: GameAction.RemovePiece,
			playerId: 'p1',
			toCellId: cell,
			removedPieceId: game.getBoard.getCell(cell).piece?.id
		});
		expect(game.applyMove(removeAt(22))).toBe(false); // in a mill
		expect(game.applyMove(removeAt(0))).toBe(false); // own piece
		expect(game.applyMove(removeAt(5))).toBe(true);
		expect(game.getCurrentPlayer.id).toBe('p2');
	});
});

describe('dehydrate / rehydrate', () => {
	it('round-trips a game mid-capture with removed pieces', async () => {
		const { game } = newGame();
		// X: 0,1,2 mill -> removes O at 9; later O: 21,22,23 mill -> removes X at 5
		click(game, 0, 9, 1, 10, 2);
		expect(game.phase).toBe(GamePhase.Capture);
		click(game, 9);
		click(game, 21, 5, 22, 7);
		click(game, 23);
		expect(game.phase).toBe(GamePhase.Capture);

		const state = game.dehydrate();
		const restored = await NinePeersMorris.rehydrate(createMockWindow() as Window, state);
		expect(restored.dehydrate()).toBe(state);
		expect(restored.phase).toBe(GamePhase.Capture);
		expect(restored.millToRemove).toBe(true);
		expect(restored.removablePieces.map((p) => p.cell!.id).sort()).toEqual(
			game.removablePieces.map((p) => p.cell!.id).sort()
		);
		expect(restored.getPlayers[1].pieceCount).toBe(8);

		// both copies accept the same follow-up move
		const move = click(game, 5)[0]!;
		expect(restored.applyMove(move)).toBe(true);
		expect(restored.dehydrate()).toBe(game.dehydrate());
	});

	it('restores the turn without notifying subscribers', async () => {
		const { game } = newGame();
		click(game, 0, 1, 2);
		const restored = await NinePeersMorris.rehydrate(
			createMockWindow() as Window,
			game.dehydrate()
		);
		expect(restored.getTurn.valueOf()).toBe(3);
		expect(restored.getTurn.value).toBe(3);
	});

	it('rejects inconsistent states and leaves the game untouched', () => {
		const { game } = newGame();
		click(game, 0);
		const before = game.dehydrate();
		const bad = JSON.parse(before);
		bad.currentPlayer = 'mallory';
		expect(() => game.restore(JSON.stringify(bad))).toThrow();
		expect(() => game.restore('not json')).toThrow();
		expect(game.dehydrate()).toBe(before);
	});
});
