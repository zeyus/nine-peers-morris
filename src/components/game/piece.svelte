<script lang="ts">
    import { type GamePiece } from "$lib/game/game";
    let { piece }: { piece: GamePiece } = $props();
</script>
<div
    class="rounded-full size-1/2 mt-2 ml-2 z-10 border-[0.35vw] border-gray-300 piece bg-radial-[at_60%_60%] to-80%"
    class:from-purple-300={piece.player.name === "X"}
    class:via-indigo-500={piece.player.name === "X"}
    class:to-purple-900={piece.player.name === "X"}
    class:from-amber-300={piece.player.name === "O"}
    class:via-orange-500={piece.player.name === "O"}
    class:to-amber-900={piece.player.name === "O"}
    >
</div>
