<script lang="ts">
    import { type GamePiece } from "$lib/game/game";
    let { piece }: { piece: GamePiece } = $props();
</script>
<div class="piece" class:placed={piece}>
    {#if piece}
        <div class="inner" class:color={piece.player.name}></div>
    {/if}
</div>
