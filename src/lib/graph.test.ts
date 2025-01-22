import { describe, it, expect, beforeEach } from 'vitest';
import { Graph } from './graph';

describe('Graph breadthFirstSearch', () => {
    let graph: Graph<number>;

    beforeEach(() => {
        graph = new Graph<number>([1, 2, 3, 4, 5, 6]);
        graph.addEdge(1, 2);
        graph.addEdge(1, 3);
        graph.addEdge(2, 4);
        graph.addEdge(3, 5);
        graph.addEdge(4, 6);
        graph.addEdge(5, 6);
    });

    it('should return all vertices that match the condition', () => {
        const result = graph.breadthFirstSearch(1, v => v % 2 === 0);
        expect(result).toEqual([2, 4, 6]);
    });

    it('should return an empty array if no vertices match the condition', () => {
        const result = graph.breadthFirstSearch(1, v => v > 10);
        expect(result).toEqual([]);
    });


    it('should return only the start vertex if it is the only one that matches the condition', () => {
        const result = graph.breadthFirstSearch(1, v => v === 1);
        expect(result).toEqual([1]);
    });

    it('should handle graphs with no edges', () => {
        const emptyGraph = new Graph<number>([1, 2, 3]);
        const result = emptyGraph.breadthFirstSearch(1, v => v > 0);
        expect(result).toEqual([1]);
    });

    it('should throw an error if the start vertex is invalid', () => {
        expect(() => graph.breadthFirstSearch(10, v => v > 0)).toThrow('Invalid vertex');
    });
});

describe('Graph addEdge', () => {
    let graph: Graph<number>;

    beforeEach(() => {
        graph = new Graph<number>([1, 2, 3]);
    });

    it('should add an edge between two vertices', () => {
        graph.addEdge(1, 2);
        expect(graph.neighbors(1)).toContain(2);
        expect(graph.neighbors(2)).toContain(1);
    });

    it('should throw an error if one of the vertices does not exist', () => {
        expect(() => graph.addEdge(1, 4)).toThrow('Invalid vertices');
    });
});

describe('Graph filter', () => {
    let graph: Graph<number>;

    beforeEach(() => {
        graph = new Graph<number>([1, 2, 3, 4, 5, 6]);
    });

    it('should return vertices that match the condition', () => {
        const result = graph.filter(v => v % 2 === 0);
        expect(result).toEqual([2, 4, 6]);
    });

    it('should return an empty array if no vertices match the condition', () => {
        const result = graph.filter(v => v > 10);
        expect(result).toEqual([]);
    });
});

describe('Graph addEdgesByFilter', () => {
    let graph: Graph<number>;

    beforeEach(() => {
        graph = new Graph<number>([1, 2, 3, 4, 5, 6]);
    });

    it('should add edges between vertices that match the filters', () => {
        graph.addEdgesByFilter(v => v === 1, v => v % 2 === 0);
        expect(graph.neighbors(1)).toEqual([2, 4, 6]);
    });

    it('should throw an error if the source filter does not match exactly one vertex', () => {
        expect(() => graph.addEdgesByFilter(v => v > 1, v => v % 2 === 0)).toThrow('Invalid source vertices, must match exactly one');
    });

    it('should throw an error if the destination filter does not match at least one vertex', () => {
        expect(() => graph.addEdgesByFilter(v => v === 1, v => v > 10)).toThrow('Invalid destination vertices, must match at least one');
    });

    describe('Graph contiguousBreathFirstSearch', () => {
        let graph: Graph<number>;

        beforeEach(() => {
            graph = new Graph<number>([1, 2, 3, 4, 5, 6]);
            graph.addEdge(1, 2);
            graph.addEdge(1, 3);
            graph.addEdge(2, 4);
            graph.addEdge(3, 5);
            graph.addEdge(4, 6);
            graph.addEdge(5, 6);
        });

        it('should return all contiguous vertices that match the condition', () => {
            const result = graph.contiguousBreathFirstSearch(1, v => v % 2 === 0);
            expect(result).toEqual([2, 4, 6]);
        });

        it('should return an empty array if no contiguous vertices match the condition', () => {
            const result = graph.contiguousBreathFirstSearch(1, v => v > 3); // 4, 5, 6 are not contiguous to 1 with this condition
            expect(result).toEqual([]);
        });

        it('should return only the start vertex if it is the only one that matches the condition', () => {
            const result = graph.contiguousBreathFirstSearch(1, v => v === 1);
            expect(result).toEqual([1]);
        });

        it('should handle graphs with no edges', () => {
            const emptyGraph = new Graph<number>([1, 2, 3]);
            const result = emptyGraph.contiguousBreathFirstSearch(1, v => v > 0);
            expect(result).toEqual([1]);
        });

        it('should throw an error if the start vertex is invalid', () => {
            expect(() => graph.contiguousBreathFirstSearch(10, v => v > 0)).toThrow('Invalid vertex');
        });

        
    });
});

describe('Graph dehydrate', () => {
    let graph: Graph<number>;

    beforeEach(() => {
        graph = new Graph<number>([1, 2, 3, 4, 5, 6]);
        graph.addEdge(1, 2);
        graph.addEdge(1, 3);
        graph.addEdge(2, 4);
        graph.addEdge(3, 5);
        graph.addEdge(4, 6);
        graph.addEdge(5, 6);
    });

    it('should correctly dehydrate the graph', () => {
        const result = graph.dehydrate();
        const expected = JSON.stringify([
            { vertex: 1, neighbors: [2, 3] },
            { vertex: 2, neighbors: [1, 4] },
            { vertex: 3, neighbors: [1, 5] },
            { vertex: 4, neighbors: [2, 6] },
            { vertex: 5, neighbors: [3, 6] },
            { vertex: 6, neighbors: [4, 5] }
        ]);
        expect(result).toEqual(expected);
    });

    it('should handle graphs with no edges', () => {
        const emptyGraph = new Graph<number>([1, 2, 3]);
        const result = emptyGraph.dehydrate();
        const expected = JSON.stringify([
            { vertex: 1, neighbors: [] },
            { vertex: 2, neighbors: [] },
            { vertex: 3, neighbors: [] }
        ]);
        expect(result).toEqual(expected);
    });

    it('should handle graphs with custom objects that implement dehydrate', () => {
        class CustomVertex {
            value: number;
            constructor(value: number) {
                this.value = value;
            }
            dehydrate() {
                return { value: this.value };
            }
        }
        let cv1 = new CustomVertex(1);
        let cv2 = new CustomVertex(2);
        let cv3 = new CustomVertex(3);
        const customGraph = new Graph<CustomVertex>([
            cv1,
            cv2,
            cv3
        ]);
        customGraph.addEdge(cv1, cv2);
        customGraph.addEdge(cv1, cv3);

        const result = customGraph.dehydrate();
        const expected = JSON.stringify([
            { vertex: { value: 1 }, neighbors: [{ value: 2 }, { value: 3 }] },
            { vertex: { value: 2 }, neighbors: [{ value: 1 }] },
            { vertex: { value: 3 }, neighbors: [{ value: 1 }] }
        ]);

        expect(result).toEqual(expected);
    });
});
