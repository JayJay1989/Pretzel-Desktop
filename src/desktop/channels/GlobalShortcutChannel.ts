import { ChannelInterface } from "./ChannelInterface";
import { globalShortcut, IpcMainEvent } from "electron";
import {
  IpcRequest,
  PickFileParams,
  GLOBAL_SHORTCUT_REGISTRATION,
  GLOBAL_SHORTCUT_REMOVAL,
  GLOBAL_SHORTCUT_EXECUTED
} from "../../desktop-integration";
import BrowserWindow = Electron.BrowserWindow;

export class GlobalShortcutChannel implements ChannelInterface<PickFileParams> {
  private mainWindow: Electron.BrowserWindow;
  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }
  getName(): string[] {
    return [GLOBAL_SHORTCUT_REGISTRATION, GLOBAL_SHORTCUT_REMOVAL];
  }

  async handle(event: IpcMainEvent, request: IpcRequest): Promise<void> {
    if (request.params.type === GLOBAL_SHORTCUT_REGISTRATION) {
      const { accelerator, payload, error } = request.params;
      if (error) {
        return;
      }
      const result = globalShortcut.register(accelerator, () => {
        console.log("Received Global Shortcut", payload);
        this.mainWindow.webContents.send(GLOBAL_SHORTCUT_EXECUTED, payload);
      });
      console.log(`Registering Global Shortcut: ${accelerator}: ${result}`);
    } else if (request.params.type === GLOBAL_SHORTCUT_REMOVAL) {
      const { accelerator } = request.params;
      globalShortcut.unregister(accelerator);
      console.log(`Removing Global Shortcut: ${accelerator}`);
    } else {
      return;
    }
  }
}
