import {session} from "electron"
import {ChannelInterface} from "./ChannelInterface";
import {CLEAR_ACCOUNT_DATA, IpcRequest} from "../../common/Core/IPC/IPCRequest";

export class AccountInfoChannel implements ChannelInterface{
    /**
     *
     */
    constructor() {}

    getName(): string {
        return CLEAR_ACCOUNT_DATA
    }

    handle(event: Electron.IpcMainEvent, request: IpcRequest) {
        session.defaultSession.cookies.get({}).then((cookies) => {
            cookies.forEach((cookie) => {
                let url = '';
                // get prefix, like https://www.
                url += cookie.secure ? 'https://' : 'http://';
                url += cookie.domain.charAt(0) === '.' ? 'www' : '';
                // append domain and path
                url += cookie.domain;
                url += cookie.path;

                session.defaultSession.cookies.remove(url, cookie.name)
                    .catch(error => {
                        if (error) console.log(`Failed to delete cookie: ${cookie.name} for url: ${url}`);
                    });
            });
        });
    }

}
