
interface Player {
    name: string;
    rolled: number;
    score: number;
    isWinner: boolean;
}

class Cell {
    id: number;
    row: number;
    col: number;
    piece: Player | null;

    constructor(id: number, row: number, col: number) {
        this.id = id;
        this.row = row;
        this.col = col;
        this.piece = null;
    }
}

class GamePiece {
    player: Player;
    cell: Cell | null;
    state: 'unplaced' | 'placed' | 'removed';

    constructor(player: Player, cell: Cell | null = null) {
        this.player = player;
        this.cell = cell;
        this.state = 'unplaced';
    }
}

class Board {
    cellCount: number;
    pieceCount: number;
    state: Graph<Cell>;

    constructor(cells: number, pieces: number, graph: Graph<Cell> | undefined = undefined) {
        this.cellCount = cells;
        this.pieceCount = pieces;
        if (graph) {
            this.state = graph;
        } else {
            this.state = new Graph<Cell>(Array.from({ length: cells }, (_, i) => {
                const row = Math.floor(i / 3);
                const col = i % 3;
                return new Cell(i, row, col);
            }));
        }
    }
}


class NineBoard extends Board {
    constructor() {
        const graph = new Graph<Cell>(Array.from({ length: 24 }, (_, i) => {
            if (i < 12) {
                const row = Math.floor(i / 3);
                const col = i % 3;
                return new Cell(i, row, col);
            }
            const row = Math.floor((i - 1) / 3);
            if (i < 15) {
                return new Cell(i, row, 3);
            }
            const col = (i-1) % 3;
            return new Cell(i, 3, col);
        }));
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
        graph.addEdgesByFilter(cell => cell.id === 0, cell => (cell.id === 1 || cell.id === 9));
        graph.addEdgesByFilter(cell => cell.id === 1, cell => (cell.id === 2 || cell.id === 4));
        graph.addEdgesByFilter(cell => cell.id === 2, cell => (cell.id === 14));
        graph.addEdgesByFilter(cell => cell.id === 3, cell => (cell.id === 4 || cell.id === 10));
        graph.addEdgesByFilter(cell => cell.id === 4, cell => (cell.id === 5 || cell.id === 7));
        graph.addEdgesByFilter(cell => cell.id === 5, cell => (cell.id === 13));
        graph.addEdgesByFilter(cell => cell.id === 6, cell => (cell.id === 7 || cell.id === 11));
        graph.addEdgesByFilter(cell => cell.id === 7, cell => (cell.id === 8));
        graph.addEdgesByFilter(cell => cell.id === 8, cell => (cell.id === 12));
        graph.addEdgesByFilter(cell => cell.id === 9, cell => (cell.id === 10 || cell.id === 21));
        graph.addEdgesByFilter(cell => cell.id === 10, cell => (cell.id === 11 || cell.id === 18));
        graph.addEdgesByFilter(cell => cell.id === 11, cell => (cell.id === 15));
        graph.addEdgesByFilter(cell => cell.id === 12, cell => (cell.id === 13 || cell.id === 17));
        graph.addEdgesByFilter(cell => cell.id === 13, cell => (cell.id === 14 || cell.id === 20));
        graph.addEdgesByFilter(cell => cell.id === 14, cell => (cell.id === 23));
        graph.addEdgesByFilter(cell => cell.id === 15, cell => (cell.id === 16));
        graph.addEdgesByFilter(cell => cell.id === 16, cell => (cell.id === 17 || cell.id === 19));
        graph.addEdgesByFilter(cell => cell.id === 18, cell => (cell.id === 19));
        graph.addEdgesByFilter(cell => cell.id === 19, cell => (cell.id === 20 || cell.id === 22));
        graph.addEdgesByFilter(cell => cell.id === 21, cell => (cell.id === 22));
        graph.addEdgesByFilter(cell => cell.id === 22, cell => (cell.id === 23));

        super(24, 18, graph);
    }

    cellFilter(row: number, col: number) {
        return (cell: Cell) => cell.row === row && cell.col === col;
    }
}


interface GameState {
    board: Board;
    currentPlayer: Player;
    winner: Player | null;
}

interface Game {
    players: Player[];
    board: Board;
    currentPlayer: Player;
    winner: Player | null;
}


class Graph<T> {
    adjList: Map<T, T[]>;

    constructor(vertices: T[]) {
        this.adjList = new Map<T, T[]>();

        for (let v of vertices) {
            this.addVertice(v);
        }
    }

    addVertice(v: T) {
        this.adjList.set(v, []);
    }

    addEdge(v: T, w: T) {
        let ve = this.adjList.get(v);
        let we = this.adjList.get(w);
        if (ve && we) {
            if (!ve.includes(w)) ve.push(w);
            if (!we.includes(v)) we.push(v);
        } else {
            throw new Error('Invalid vertices');
        }
    }


    filter(func: (v: T) => boolean): T[] {
        return Array.from(this.adjList.keys()).filter(func);
    }

    addEdgesByFilter(src: (v: T) => boolean, dst: (w: T) => boolean) {
        let srcV: T[] = this.filter(src);
        if (srcV.length !== 1) {
            throw new Error('Invalid source vertices, must match exactly one');
        }
        let dstV: T[] = this.filter(dst);
        if (dstV.length < 1) {
            throw new Error('Invalid destination vertices, must match at least one');
        }

        for (let v of srcV) {
            for (let w of dstV) {
                this.addEdge(v, w);
            }
        }
    }
}


class NinePeersMorris implements Game {
    players: Player[];
    board: Board;
    currentPlayer: Player;
    winner: Player | null;

    constructor(players: Player[], board: Board) {
        this.players = players;
        this.board = board;
        this.currentPlayer = players[0];
        this.winner = null;
    }

}
