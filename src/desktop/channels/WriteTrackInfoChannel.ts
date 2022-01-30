import {IpcMainEvent} from "electron";
import {ChannelInterface} from "./ChannelInterface";
import * as jetpack from "fs-jetpack";
import * as fs from "fs";
import * as axios from "axios";
import {IpcRequest, WRITE_TRACK_INFO} from "../../common/Core/IPC/IPCRequest";

export class WriteTrackInfoChannel implements ChannelInterface {

    getName(): string {
        return WRITE_TRACK_INFO;
    }

    handle(event: IpcMainEvent, request: IpcRequest) {
        return new Promise<void>((resolve, reject) => {
            if(request.params.type !== WRITE_TRACK_INFO) return;
            let params = request.params,
                filename = params.filename,
                contents = params.contents,
                coverFilename = params.coverFilename,
                coverURL = params.coverURL,
                jsonFilename = params.jsonFilename,
                jsonString = params.jsonString;

            //Write song information to txt file on disk
            if(filename){
                jetpack.file(filename);
                jetpack.write(filename, contents);
                console.log("Track Info Updated", filename);
            }

            //Write info to json file on disk
            if(jsonFilename){
                jetpack.file(jsonFilename);
                jetpack.write(jsonFilename, jsonString);
                console.log("Track Json Updated", jsonString);
            }

            //Write Cover art on disk
            if(coverFilename && coverURL){
                axios.default({
                    method: "get",
                    url: coverURL,
                    responseType: "stream"
                }).then(function (response) {
                    response.data.pipe(fs.createWriteStream(coverFilename));
                });

                console.log("WriteTrackInfoChannel", request);
            }

        })
    }
}
