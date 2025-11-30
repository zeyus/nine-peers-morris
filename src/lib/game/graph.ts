import { type Hashable } from './hashable';

// generic graph implementation

export class Graph<T> implements Hashable {
	adjList: Map<T, T[]>;
	isSorted: boolean = false;

	constructor(vertices: T[]) {
		this.adjList = new Map<T, T[]>();

		for (const v of vertices) {
			this.addVertice(v);
		}
	}

	get size(): number {
		return this.adjList.size;
	}

	sort(fn: (a: T, b: T) => number): void {
		const sorted = this.sorted(fn);
		const adjList = new Map<T, T[]>();
		for (const v of sorted) {
			adjList.set(v, this.adjList.get(v) || []);
		}
		this.adjList = adjList;
		this.isSorted = true;
	}

	sorted(fn: (a: T, b: T) => number): T[] {
		return Array.from(this.adjList.keys()).sort(fn);
	}

	addVertice(v: T) {
		this.adjList.set(v, []);
		this.isSorted = false;
	}

	addEdge(v: T, w: T) {
		const ve = this.adjList.get(v);
		const we = this.adjList.get(w);
		if (ve && we) {
			if (!ve.includes(w)) ve.push(w);
			if (!we.includes(v)) we.push(v);
		} else {
			throw new Error('Invalid vertices');
		}
	}

	neighbors(v: T): T[] {
		const ve = this.adjList.get(v);
		if (ve) {
			return ve;
		} else {
			throw new Error('Invalid vertex');
		}
	}

	breadthFirstSearch(start: T, func: (v: T) => boolean): T[] {
		const visited: Set<T> = new Set<T>();
		const queue: T[] = [start];
		const result: T[] = [];

		while (queue.length > 0) {
			const v = queue.shift();
			if (v && !visited.has(v)) {
				visited.add(v);
				if (func(v)) {
					result.push(v);
				}
				queue.push(...this.neighbors(v).filter((w) => !visited.has(w)));
			}
		}

		return result;
	}

	contiguousBreathFirstSearch(
		start: T,
		func: (v: T) => boolean,
		excludeStart: boolean = true
	): T[] {
		/**
		 * This is a modified version of the breadthFirstSearch function that
		 * returns all contiguous vertices that match the condition.
		 *
		 * @param start The starting vertex
		 * @param func The condition to match
		 * @param excludeStart Whether to exclude the starting vertex from being tested
		 *
		 * @returns An array of vertices that match the condition, including the starting vertex /if/ it matches
		 */
		const visited: Set<T> = new Set<T>();
		const queue: T[] = [start];
		const result: T[] = [];

		while (queue.length > 0) {
			const v = queue.shift();
			if (v && !visited.has(v)) {
				visited.add(v);
				if (func(v)) {
					result.push(v);
					queue.push(...this.neighbors(v).filter((w) => !visited.has(w)));
				} else if (excludeStart && v === start) {
					queue.push(...this.neighbors(v).filter((w) => !visited.has(w)));
				}
			}
		}

		return result;
	}

	isAdjacent(v: T, w: T): boolean {
		return this.neighbors(v).includes(w);
	}

	isMutuallyAdjacent(v: T, w: T): boolean {
		return this.isAdjacent(v, w) && this.isAdjacent(w, v);
	}

	filter(func: (v: T) => boolean): T[] {
		return Array.from(this.adjList.keys()).filter(func);
	}

	addEdgesByFilter(src: (v: T) => boolean, dst: (w: T) => boolean) {
		const srcV: T[] = this.filter(src);
		if (srcV.length !== 1) {
			throw new Error('Invalid source vertices, must match exactly one');
		}
		const dstV: T[] = this.filter(dst);
		if (dstV.length < 1) {
			throw new Error('Invalid destination vertices, must match at least one');
		}

		for (const v of srcV) {
			for (const w of dstV) {
				this.addEdge(v, w);
			}
		}
	}

	dehydrate(): string {
		return JSON.stringify(
			Array.from(this.adjList.keys()).map((v) => {
				return {
					vertex:
						v !== null &&
						typeof v === 'object' &&
						'dehydrate' in v &&
						typeof v.dehydrate === 'function'
							? v.dehydrate()
							: v,
					neighbors: this.adjList
						.get(v)
						?.map((w) =>
							w !== null &&
							typeof w === 'object' &&
							'dehydrate' in w &&
							typeof w.dehydrate === 'function'
								? w.dehydrate()
								: w
						)
				};
			})
		);
	}

	// this is gimmicky, so it's not a core part of the code
	// but it's interesting to see what a graph representation
	// of a nine men's morris board looks like
	// asDot(): string {
	//     let dot = 'graph {\n';
	//     for (let [v, neighbors] of this.adjList) {
	//         const v_repr = v !== null && typeof v === "object" && 'id' in v && v.id !== null && typeof v.id === "object" ? v.id.toString() : v;
	//         for (let w of neighbors) {
	//             const w_repr = w !== null && typeof w === "object" && 'id' in w && w.id !== null && typeof w.id === "object" ? w.id.toString() : w;
	//             dot += `  ${v_repr} -- ${w_repr};\n`;
	//         }
	//     }
	//     dot += '}';
	//     return dot;
	// }
}
