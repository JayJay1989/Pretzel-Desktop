import {IpcMainEvent} from 'electron';
import {IpcRequest} from "../../desktop-integration";

export interface ChannelInterface<T> {
    getName(): string | string[];
    handle(event: IpcMainEvent, request: IpcRequest) : void;
}
