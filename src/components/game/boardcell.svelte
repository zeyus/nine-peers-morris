<script lang="ts">
	import { GamePhase, type Cell, type NinePeersMorris } from '#lib/game/game.js';
	import Piece from './piece.svelte';

	let {
		cell,
		game,
		onclick,
		version = 0
	}: {
		cell?: Cell; // the cell object, which references a piece if placed
		game?: NinePeersMorris;
		onclick?: (cell: Cell) => void;
		version?: number; // bumped by the page whenever the game state changes
	} = $props();

	function handleClick() {
		if (cell && onclick) {
			onclick(cell);
		}
	}

	// The game object is mutated in place, so every derived value reads `version`
	// to be recomputed when the game changes.
	const state = $derived.by(() => {
		void version;
		if (!game || !cell) {
			return {
				isValidMove: false,
				isRemovable: false,
				isSelected: false,
				isValidPlacement: false,
				isMovablePiece: false
			};
		}
		const myTurn = game.isMyTurn();
		const piece = cell.piece;
		return {
			isValidMove: myTurn && game.validMoves.includes(cell),
			isRemovable:
				myTurn &&
				!!piece &&
				game.phase === GamePhase.Capture &&
				game.removablePieces.includes(piece),
			isSelected: !!piece && game.selectedPiece === piece,
			isValidPlacement: !piece && game.canPlacePiece(),
			isMovablePiece: !!piece && game.canMovePiece() && piece.player === game.getCurrentPlayer
		};
	});
	const isHighlighted = $derived(state.isValidMove || state.isValidPlacement);
	const isPlain = $derived(!isHighlighted && !state.isRemovable && !state.isMovablePiece);
	const showMovable = $derived(state.isMovablePiece && !state.isSelected);
	const piece = $derived.by(() => {
		void version;
		return cell?.piece ?? null;
	});
</script>

{#if cell}
	<div
		class="relative z-10 grid size-full cursor-pointer place-items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
		class:placed={piece}
		onclick={handleClick}
		onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), handleClick())}
		role="button"
		tabindex="0"
		aria-label={`Point ${cell.id}${piece ? `, ${piece.player.name} piece` : ', empty'}`}
	>
		{#if piece}
			<Piece {piece} isSelected={state.isSelected} isRemovable={state.isRemovable} />
		{/if}

		<!-- Cell indicator dot -->
		<div
			class="pointer-events-none absolute z-5 mt-[1vw] ml-[1vw] size-[2vw] rounded-full border-[0.5vw] transition-all duration-200"
			class:bg-purple-900={isPlain}
			class:border-pink-400={isPlain}
			class:bg-green-400={isHighlighted}
			class:border-green-200={isHighlighted}
			class:motion-safe:animate-pulse={isHighlighted}
			class:shadow-lg={isHighlighted}
			class:shadow-green-400={isHighlighted}
			class:scale-125={isHighlighted}
			class:bg-yellow-400={showMovable}
			class:border-yellow-200={showMovable}
			class:motion-safe:animate-bounce={showMovable}
			class:shadow-md={state.isMovablePiece}
			class:shadow-yellow-300={state.isMovablePiece}
			class:bg-red-500={state.isRemovable}
			class:border-red-300={state.isRemovable}
			class:motion-safe:animate-ping={state.isRemovable}
			class:ring-4={state.isSelected}
			class:ring-yellow-400={state.isSelected}
			class:ring-opacity-70={state.isSelected}
		></div>

		{#if state.isRemovable}
			<!-- Extra visual indicator for removable pieces -->
			<div
				class="pointer-events-none absolute inset-0 animate-pulse rounded-full bg-red-500 opacity-20"
			></div>
			<div
				class="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transform text-lg font-bold text-white"
			>
				✕
			</div>
		{/if}
	</div>
{/if}
