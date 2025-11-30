// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import type { ServerMessageType } from './enums';

export class ServerMessage {
	type: ServerMessageType;
	payload: any;
	src: string;
}
