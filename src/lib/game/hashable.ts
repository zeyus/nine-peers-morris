/**
 * Hashable interface
 */
export interface Hashable {
	dehydrate(): string;
}

export async function getHash(win: Window, data: string): Promise<string> {
	const hashed = win.crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
	const hash = new Uint8Array(await hashed);
	return Array.from(hash)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export function getUUID(win: Window): string {
	return win.crypto.randomUUID();
}
