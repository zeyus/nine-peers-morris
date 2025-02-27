<script lang="ts">
    import NineGameBoard from "../../components/game/ninegameboard.svelte";
    import { NineBoard, Player } from "$lib/game/game";
    // create dummy players
    const p1 = new Player("Player 1", "X", true);
    const p2 = new Player("Player 2", "O", false);
    // create a new board
    const board = new NineBoard([p1, p2]);
    // place some demo pieces
    const pi1 = p1.nextPiece;
    const pi2 = p2.nextPiece;
    
    board.placePiece(pi1!, board.getCell(0));
    board.placePiece(pi2!, board.getCell(1));

</script>
<NineGameBoard board={board} />
