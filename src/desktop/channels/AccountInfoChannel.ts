import {ChannelInterface} from "./ChannelInterface";
import {CLEAR_ACCOUNT_DATA, IpcRequest} from "../../common/Core/IPC/IPCRequest";

export class AccountInfoChannel implements ChannelInterface{
    /**
     *
     */
    constructor() {}

    getName(): any {
        return CLEAR_ACCOUNT_DATA
    }

    handle(event: Electron.IpcMainEvent, request: IpcRequest): Promise<void> {
        return Promise.resolve(undefined);
    }

}
