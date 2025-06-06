<script lang="ts">
    import BoardSegment from "./boardsegment.svelte";
    import { type NineBoard, type Cell, type NinePeersMorris } from "$lib/game/game";
    let { board, game, onCellClick }: { 
        board: NineBoard,
        game?: NinePeersMorris,
        onCellClick?: (cell: Cell) => void
    } = $props();
    
    // Rename for consistency with BoardSegment
    const onclick = onCellClick;
    
</script>
<div class="board nineboard container w-full">
    <div class="grid grid-cols-7 gap-0 w-full">
        <!-- row 1 -->
        <!-- col 2 --> 
        <BoardSegment cell={board[0]} e={true} s={true} {game} {onclick} />
        <!-- col 2 -->
        <BoardSegment e={true} w={true} />
        <!-- col 3 -->
        <BoardSegment e={true} w={true} />
        <!-- col 4 -->
        <BoardSegment cell={board[1]} e={true} s={true} w={true} {game} {onclick} />
        <!-- col 5 -->
        <BoardSegment e={true} w={true} />
        <!-- col 6 -->
        <BoardSegment e={true} w={true} />
        <!-- col 7 -->
        <BoardSegment cell={board[2]} s={true} w={true} {game} {onclick} />
        <!-- row 2 -->
        <!-- col 1 -->
        <BoardSegment n={true} s={true} />
        <!-- col 2 -->
        <BoardSegment cell={board[3]} e={true} s={true} {game} {onclick} />
        <!-- col 3 -->
        <BoardSegment e={true} w={true} />
        <!-- col 4 -->
        <BoardSegment cell={board[4]} n={true} e={true} s={true} w={true} {game} {onclick} />
        <!-- col 5 -->
        <BoardSegment e={true} w={true} />
        <!-- col 6 -->
        <BoardSegment cell={board[5]} s={true} w={true} {game} {onclick} />
        <!-- col 7 -->
        <BoardSegment n={true} s={true} />
        <!-- row 3 -->
        <!-- col 1 -->
        <BoardSegment n={true} s={true} />
        <!-- col 2 -->
        <BoardSegment n={true} s={true} />
        <!-- col 3 -->
        <BoardSegment cell={board[6]} e={true} s={true} {game} {onclick} />
        <!-- col 4 -->
        <BoardSegment cell={board[7]} n={true} e={true} w={true} {game} {onclick} />
        <!-- col 5 -->
        <BoardSegment cell={board[8]} s={true} w={true} {game} {onclick} />
        <!-- col 6 -->
        <BoardSegment n={true} s={true} />
        <!-- col 7 -->
        <BoardSegment n={true} s={true} />
        <!-- row 4 -->
        <!-- col 1 -->
        <BoardSegment cell={board[9]} n={true} s={true} e={true} {game} {onclick} />
        <!-- col 2 -->
        <BoardSegment cell={board[10]} n={true} e={true} s={true} w={true} {game} {onclick} />
        <!-- col 3 -->
        <BoardSegment cell={board[11]} n={true} s={true} w={true} {game} {onclick} />
        <!-- col 4 // center -->
        <BoardSegment />
        <!-- col 5 -->
        <BoardSegment cell={board[12]} n={true} e={true} s={true} {game} {onclick} />
        <!-- col 6 -->
        <BoardSegment cell={board[13]} n={true} e={true} s={true} w={true} {game} {onclick} />
        <!-- col 7 -->
        <BoardSegment cell={board[14]} n={true} s={true} w={true} {game} {onclick} />
        <!-- row 5 -->
        <!-- col 1 -->
        <BoardSegment n={true} s={true} />
        <!-- col 2 -->
        <BoardSegment n={true} s={true} />
        <!-- col 3 -->
        <BoardSegment cell={board[15]} n={true} e={true} {game} {onclick} />
        <!-- col 4 -->
        <BoardSegment cell={board[16]} s={true} e={true} w={true} {game} {onclick} />
        <!-- col 5 -->
        <BoardSegment cell={board[17]} n={true} w={true} {game} {onclick} />
        <!-- col 6 -->
        <BoardSegment n={true} s={true} />
        <!-- col 7 -->
        <BoardSegment n={true} s={true} />
        <!-- row 6 -->
        <!-- col 1 -->
        <BoardSegment n={true} s={true} />
        <!-- col 2 -->
        <BoardSegment cell={board[18]} n={true} e={true} {game} {onclick} />
        <!-- col 3 -->
        <BoardSegment e={true} w={true} />
        <!-- col 4 -->
        <BoardSegment cell={board[19]} n={true} s={true} e={true} w={true} {game} {onclick} />
        <!-- col 5 -->
        <BoardSegment e={true} w={true} />
        <!-- col 6 -->
        <BoardSegment cell={board[20]} n={true} w={true} {game} {onclick} />
        <!-- col 7 -->
        <BoardSegment n={true} s={true} />
        <!-- row 7 -->
        <!-- col 1 -->
        <BoardSegment cell={board[21]} n={true} e={true} {game} {onclick} />
        <!-- col 2 -->
        <BoardSegment e={true} w={true} />
        <!-- col 3 -->
        <BoardSegment e={true} w={true} />
        <!-- col 4 -->
        <BoardSegment cell={board[22]} n={true} e={true} w={true} {game} {onclick} />
        <!-- col 5 -->
        <BoardSegment e={true} w={true} />
        <!-- col 6 -->
        <BoardSegment e={true} w={true} />
        <!-- col 7 -->
        <BoardSegment cell={board[23]} n={true} w={true} {game} {onclick} />
    </div>
</div>
        
        
        