import { ChannelInterface } from './ChannelInterface';
import { IpcMainEvent } from 'electron';
import jetpack from 'fs-jetpack';
import * as fs from 'fs';
import axios from 'axios';
import { IpcRequest, WRITE_TRACK_INFO, WriteTrackInfoParams } from '../../desktop-integration';

export class WriteTrackInfoChannel implements ChannelInterface<WriteTrackInfoParams> {
  getName(): string {
    return WRITE_TRACK_INFO;
  }

  async handle(event: IpcMainEvent, request: IpcRequest): Promise<void> {
    if (request.params.type !== WRITE_TRACK_INFO) return;
    console.log('WriteTrackInfoChannel', request);
    const { filename, contents, coverFilename, coverURL, jsonFilename, jsonString } = request.params;

    if (filename) {
      jetpack.file(filename);
      jetpack.write(filename, contents);
      console.log('Track Info Updated', filename);
    }
    if (jsonFilename) {
      jetpack.file(jsonFilename);
      jetpack.write(jsonFilename, jsonString);
      console.log('Track Json Updated', jsonString);
    }
    if (coverFilename && !!coverURL) {
      const writer = fs.createWriteStream(coverFilename);

      const response = await axios({
        url: coverURL,
        method: 'GET',
        responseType: 'stream',
      });

      response.data.pipe(writer);
      console.log('Track Cover Updated', coverFilename);
    }
  }
}
