import { ChannelInterface } from './ChannelInterface';
import { dialog, IpcMainEvent, SaveDialogOptions } from 'electron';
import { IpcRequest, PickFileParams, PICK_FILE } from '../../desktop-integration';
import jetpack from 'fs-jetpack';
import BrowserWindow = Electron.BrowserWindow;

export class PickFileChannel implements ChannelInterface<PickFileParams> {
  private mainWindow: Electron.BrowserWindow;
  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
    console.log('Instantiating PickFileChannel');
  }
  getName(): string {
    return PICK_FILE;
  }

  async handle(event: IpcMainEvent, request: IpcRequest): Promise<void> {
    if (request.params.type !== PICK_FILE) {
      return;
    }
    const { title, message, filters, defaultPath } = request.params;
    const config: SaveDialogOptions = {
      title,
      message,
      filters,
    };
    if (defaultPath) {
      config.defaultPath = defaultPath;
    }
    console.log('Creating Dialog', request.params);
    dialog.showSaveDialog(this.mainWindow, config).then(({ filePath, canceled }) => {
      let enforcedFileName;
      if (!canceled && filePath) {
        const parsedFileName = filePath.split('.');
        const extension = filters[0].extensions[0];
        if (parsedFileName[parsedFileName.length - 1] !== extension) {
          parsedFileName.push(extension);
        }
        enforcedFileName = parsedFileName.join('.');
        jetpack.file(enforcedFileName);
      }
      if (!request.responseChannel) {
        request.responseChannel = `${this.getName()}_response`;
      }
      console.log('File Picked:', enforcedFileName);
      event.sender.send(request.responseChannel, enforcedFileName);
    });
  }
}
