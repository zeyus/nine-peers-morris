<script lang="ts">
    import { type GamePiece } from "$lib/game/game";
    let { piece, isSelected = false, isRemovable = false }: { 
        piece: GamePiece,
        isSelected?: boolean,
        isRemovable?: boolean
    } = $props();
</script>
<!-- animation class maybe for pieces: motion-safe:animate-[ping_5s_ease-in-out_infinite] -->
<div
    class="rounded-full size-1/2 mt-2 ml-2 z-10 border-[0.35vw] piece bg-radial-[at_60%_60%] to-80% transition-all duration-200"
    class:from-purple-300={piece.player.name === "X"}
    class:via-indigo-500={piece.player.name === "X"}
    class:to-purple-900={piece.player.name === "X"}
    class:from-amber-300={piece.player.name === "O"}
    class:via-orange-500={piece.player.name === "O"}
    class:to-amber-900={piece.player.name === "O"}
    class:border-gray-300={!isSelected && !isRemovable}
    class:border-blue-500={isSelected}
    class:border-red-500={isRemovable}
    class:ring-2={isSelected || isRemovable}
    class:ring-blue-400={isSelected}
    class:ring-red-400={isRemovable}
    class:motion-safe:animate-pulse={isSelected}
    class:motion-safe:animate-bounce={isRemovable}
    >
</div>
