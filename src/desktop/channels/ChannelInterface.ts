import {IpcMainEvent} from 'electron';
import {IPCRequest} from "../../common/Core/IPC/IPCRequest";

export interface ChannelInterface {
    getName(): any;
    handle(event: IpcMainEvent, request: IPCRequest): Promise<void>
}