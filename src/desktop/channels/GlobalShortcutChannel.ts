import {BrowserWindow, globalShortcut, IpcMainEvent} from "electron"

import {GLOBAL_SHORTCUT_REGISTRATION, GLOBAL_SHORTCUT_REMOVAL, IPCRequest} from "../../common/Core/IPC/IPCRequest";
import {ChannelInterface} from "./ChannelInterface";

export class GlobalShortcutChannel implements ChannelInterface{
    private mainWindow: BrowserWindow;

    constructor(mainWindow: BrowserWindow) {
        this.mainWindow = mainWindow;
    }

    getName() {
        return [GLOBAL_SHORTCUT_REGISTRATION, GLOBAL_SHORTCUT_REMOVAL];
    }

    handle(event: IpcMainEvent, request: IPCRequest) {
        return new Promise<void>(() => {
            let params = request.params;
            if(params.type === GLOBAL_SHORTCUT_REGISTRATION){
                let accelerator = params.accelerator;
                let payload = params.payload;
                globalShortcut.register(accelerator ,() => {
                    console.log("Received Global Shortcut", payload);
                    this.mainWindow.webContents.send(GLOBAL_SHORTCUT_REGISTRATION, payload);
                })
            }
            else if(params.type === GLOBAL_SHORTCUT_REMOVAL){
                let accelerator = params.accelerator;
                globalShortcut.unregister(accelerator);
                console.log("Removing Global Shortcut: " + accelerator);
            }
            return;
        })
    }

}