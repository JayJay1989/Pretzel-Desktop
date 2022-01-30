import {IpcMainEvent} from "electron";
import {ChannelInterface} from "./ChannelInterface";
import * as jetpack from "fs-jetpack";
import * as fs from "fs";
import * as axios from "axios";
import {IpcRequest, WRITE_TRACK_INFO, WriteTrackInfoParams} from "../../common/Core/IPC/IPCRequest";

export class WriteTrackInfoChannel implements ChannelInterface {

    getName(): string {
        return WRITE_TRACK_INFO;
    }

    async handle(event: IpcMainEvent, request: IpcRequest) {
        let params: WriteTrackInfoParams,
            filename: string,
            contents: string,
            coverFilename: string,
            coverURL: string,
            jsonFilename: string,
            jsonString: string;

        await new Promise<void>(() => {
            if (request.params.type !== WRITE_TRACK_INFO) return;
            console.log("WriteTrackInfoChannel", request);
            params = request.params,
                filename = params.filename,
                contents = params.contents,
                coverFilename = params.coverFilename,
                coverURL = params.coverURL,
                jsonFilename = params.jsonFilename,
                jsonString = params.jsonString;

            //Write song information to txt file on disk
            if (filename) {
                jetpack.file(filename);
                jetpack.write(filename, contents);
                console.log("Track Info Updated", filename);
            }

            //Write info to json file on disk
            if (jsonFilename) {
                jetpack.file(jsonFilename);
                jetpack.write(jsonFilename, jsonString);
                console.log("Track Json Updated", jsonString);
            }

            if (!(coverFilename && coverURL)) return;
            //Write Cover art on disk
            axios.default({
                method: "get",
                url: coverURL,
                responseType: "stream"
            }).then(function (response) {
                response.data.pipe(fs.createWriteStream(coverFilename));
            });
        })
    }
}
