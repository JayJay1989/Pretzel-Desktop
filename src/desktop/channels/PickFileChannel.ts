import {dialog, BrowserWindow, IpcMainEvent, SaveDialogOptions} from "electron"
import * as jetpack from"fs-jetpack";
import {ChannelInterface} from "./ChannelInterface";
import {IpcRequest, PICK_FILE} from "../../common/Core/IPC/IPCRequest";
import * as cluster from "cluster";

export class PickFileChannel implements ChannelInterface{
    private mainWindow: BrowserWindow;

    constructor(mainWindow: BrowserWindow) {
        this.mainWindow = mainWindow;
        console.log("Instantiating PickFileChannel");
    }

    getName() : string {
        return PICK_FILE;
    }

    async handle(event: IpcMainEvent, request: IpcRequest) {
        await new Promise<void>(() => {
            if (request.params.type !== PICK_FILE) return;
            let params = request.params;
            let title = params.title;
            let message = params.message;
            let filters = params.filters;
            let defaultPath = params.defaultPath;
            const options: SaveDialogOptions = {
                title: title,
                message: message,
                filters: filters,
                defaultPath: defaultPath
            };
            dialog.showSaveDialog(this.mainWindow, options)
                .then((result) => {
                    let filePath = result.filePath, canceled = result.canceled;
                    let enforcedFileName;
                    if (!canceled && filePath) {
                        let parsedFileName = filePath.split(".");
                        let extension = params.filters[0].extensions[0];
                        if (parsedFileName[parsedFileName.length - 1] !== extension) {
                            parsedFileName.push(extension);
                        }
                        enforcedFileName = parsedFileName.join(".");
                        jetpack.file(enforcedFileName);
                    }
                    if (!request.responseChannel) {
                        request.responseChannel = this.getName() + "_response";
                    }
                    console.log("File Picked:", enforcedFileName);
                    event.sender.send(request.responseChannel, enforcedFileName);
                })
        })
    }
}
