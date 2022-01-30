import {IpcMainEvent} from 'electron';
import {IpcRequest} from "../../common/Core/IPC/IPCRequest";

export interface ChannelInterface {
    getName(): string | string[];
    handle(event: IpcMainEvent, request: IpcRequest): void
}
