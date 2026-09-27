import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import {
	GameClient,
	GameHost,
	PeerCommands,
	PeerData,
	HashMismatchError,
	type PeerState
} from './comms';
import { GameAction, GamePhase, type NinePeersMorris } from './game';

vi.mock('../../thirdparty/peerjs/peer');
vi.mock('$lib/persisted-store');

// Uses the real SHA-256 hashing (no hashable mock) so state hashes must really agree.
beforeAll(() => {
	if (!globalThis.window) {
		/** @ts-expect-error node test environment */
		globalThis.window = globalThis;
	}
});

async function deliver(to: PeerState, raw: string | Promise<string>) {
	const msg = PeerData.dataToPeerMessage(await raw);
	expect(msg).not.toBeNull();
	return to.handleMessage(msg!);
}

describe('two peers playing over the protocol', () => {
	let host: GameHost;
	let client: GameClient;
	let hostGame: NinePeersMorris;
	let clientGame: NinePeersMorris;

	beforeEach(async () => {
		host = new GameHost('alice', 'bob');
		host.startGame(window);
		client = new GameClient('bob', 'alice');
		client.startGame(window);
		hostGame = host.getGame() as NinePeersMorris;
		clientGame = client.getGame() as NinePeersMorris;
		await deliver(client, host.messageFromCommand(PeerCommands.Helo));
		await deliver(host, client.messageFromCommand(PeerCommands.Elho));
	});

	/** local click on `side`, returning the outgoing message (not yet delivered) */
	function play(side: PeerState, cellId: number): Promise<string> {
		const game = side.getGame() as NinePeersMorris;
		const move = game.handleCellClick(game.getBoard.getCell(cellId));
		expect(move, `move at ${cellId}`).not.toBeNull();
		return side.sendMove(move!);
	}

	function expectInSync() {
		expect(clientGame.dehydrate()).toBe(hostGame.dehydrate());
		expect(client.lastHash).toBe(host.lastHash);
	}

	it('assigns the first turn to the host only', () => {
		expect(hostGame.isMyTurn()).toBe(true);
		expect(clientGame.isMyTurn()).toBe(false);
		expect(clientGame.getCurrentPlayer.id).toBe('alice');
	});

	it('stays in sync when a mill and its capture arrive back to back', async () => {
		await deliver(client, play(host, 0));
		await deliver(host, play(client, 9));
		await deliver(client, play(host, 1));
		await deliver(host, play(client, 10));

		// host forms 0-1-2 and immediately removes a piece: both messages are
		// in flight at the same time and handled concurrently by the receiver
		const placeMsg = play(host, 2);
		expect(hostGame.phase).toBe(GamePhase.Capture);
		const removeMsg = play(host, 9);
		await Promise.all([deliver(client, placeMsg), deliver(client, removeMsg)]);

		expectInSync();
		expect(clientGame.phase).toBe(GamePhase.Placement);
		expect(clientGame.getCurrentPlayer.id).toBe('bob');
		expect(clientGame.isMyTurn()).toBe(true);
		expect(clientGame.getBoard.getCell(9).piece).toBeNull();

		// and the game carries on normally
		await deliver(host, play(client, 21));
		expectInSync();
		expect(hostGame.isMyTurn()).toBe(true);
	});

	it('rejects a move the sender is not allowed to make', async () => {
		const forged = await client.sendMove({
			action: GameAction.PlacePiece,
			playerId: 'bob',
			pieceId: '0',
			toCellId: 4
		});
		await expect(deliver(host, forged)).rejects.toThrow('Invalid move received');
		expect(hostGame.getBoard.getCell(4).piece).toBeNull();
	});

	it('detects a diverged state and recovers with a sync', async () => {
		await deliver(client, play(host, 0));
		// corrupt the client's copy of the board
		clientGame.getBoard.getCell(0).piece!.player = clientGame.getPlayers[1];

		// the client's next move no longer produces the host's state hash
		await expect(deliver(host, play(client, 9))).rejects.toBeInstanceOf(HashMismatchError);

		// host tells the client to resync; the client adopts the host's state
		await deliver(client, host.messageFromCommand(PeerCommands.HashMismatch));
		await deliver(host, client.requestSync('mismatch'));
		await deliver(client, host.syncResponse());
		expectInSync();
		expect(clientGame.getBoard.getCell(0).piece!.player.id).toBe('alice');

		// play continues from the synced state
		await deliver(client, play(host, 1));
		expectInSync();
	});

	it('ignores sync responses nobody asked for', async () => {
		await deliver(client, play(host, 0));
		await expect(deliver(client, host.syncResponse())).rejects.toThrow('Unexpected sync response');
	});

	it('applies an opponent forfeit', async () => {
		await deliver(host, client.messageFromCommand(PeerCommands.Forfeit));
		expect(hostGame.phase).toBe(GamePhase.GameOver);
		expect(hostGame.getWinner?.id).toBe('alice');
	});
});

describe('PeerData.dataToPeerMessage', () => {
	it.each([undefined, 42, {}, 'NOT_A_COMMAND:a:b:c', 'MOVE:only', 'x'.repeat(70000)])(
		'rejects %j',
		(raw) => {
			expect(PeerData.dataToPeerMessage(raw)).toBeNull();
		}
	);
});
