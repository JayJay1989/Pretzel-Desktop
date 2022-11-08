import { ChannelInterface } from "./ChannelInterface";
import { IpcMainEvent, session } from "electron";
import {
  IpcRequest,
  CLEAR_ACCOUNT_DATA
} from "../../desktop-integration";

export class AccountInfoChannel implements ChannelInterface<void> {
  getName(): string[] {
    return [CLEAR_ACCOUNT_DATA];
  }

  async handle(event: IpcMainEvent, request: IpcRequest): Promise<void> {
    if (request.params.type === CLEAR_ACCOUNT_DATA) {
      const cookies = await session.defaultSession.cookies.get({});

      for (const cookie of cookies) {
        let url = "";
        // get prefix, like https://www.
        url += cookie.secure ? "https://" : "http://";
        url += cookie.domain.charAt(0) === "." ? "www" : "";
        // append domain and path
        url += cookie.domain;
        url += cookie.path;

        try {
          await session.defaultSession.cookies.remove(url, cookie.name);
        } catch (e) {
          console.log("Failed to delete cookie:", cookie.name, "for url:", url);
        }
      }
    } else {
      return;
    }
  }
}
