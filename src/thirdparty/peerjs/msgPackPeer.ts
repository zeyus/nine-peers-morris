// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { Peer, type SerializerMapping } from './peer';
import { MsgPack } from './exports';

/**
 * @experimental
 */
export class MsgPackPeer extends Peer {
	override _serializers: SerializerMapping = {
		MsgPack,
		default: MsgPack
	};
}
