import {IpcMainEvent} from 'electron';
import {IpcRequest} from "../../common/Core/IPC/IPCRequest";

export interface ChannelInterface {
    getName(): any;
    handle(event: IpcMainEvent, request: IpcRequest): Promise<void>
}
