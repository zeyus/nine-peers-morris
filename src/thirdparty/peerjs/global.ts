// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { util } from './util';
import { Peer } from './peer';

(<any>window).peerjs = {
	Peer,
	util
};
/** @deprecated Should use peerjs namespace */
(<any>window).Peer = Peer;
