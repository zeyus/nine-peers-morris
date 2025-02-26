<script lang="ts">
    import NineGameBoard from "../../components/game/ninegameboard.svelte";
    import { NineBoard, Player } from "$lib/game/game";
    // create dummy players
    const p1 = new Player("Player 1", "X", true);
    const p2 = new Player("Player 2", "O", false);
    // create a new board
    const board = new NineBoard([p1, p2]);
</script>
<NineGameBoard board={board} />
