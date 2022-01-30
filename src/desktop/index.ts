"use strict";
import {
    app,
    shell,
    BrowserWindow,
    ipcMain,
    Menu,
    protocol,
    globalShortcut,
    MenuItemConstructorOptions,
    IpcMainEvent, RenderProcessGoneDetails
} from 'electron'
import * as electronLog from "electron-log"
import * as jetpack from "fs-jetpack"
import {Console} from "console"
import {GlobalShortcutChannel} from "./channels/GlobalShortcutChannel";
import {PickFileChannel} from "./channels/PickFileChannel";
import {WriteTrackInfoChannel} from "./channels/WriteTrackInfoChannel";
import {AccountInfoChannel} from "./channels/AccountInfoChannel";
import * as windowStateKeeper from "electron-window-state";
import * as path from "path";
import * as electronContextMenu from "electron-context-menu";
import {ChannelInterface} from "./channels/ChannelInterface";
const console = new Console(process.stdout, process.stderr);

let mainWindow: BrowserWindow;
let appUrl: string = "https://play.pretzel.rocks";
let launchUrl: string;
let willQuitApp: boolean = false;

electronContextMenu({
    shouldShowMenu: (event, params) => params.mediaType !== "image"
});

let isPrimary = app.requestSingleInstanceLock();
if (!isPrimary) {
    app.quit();
}

app.on("second-instance", (event: Event, commandLine: string[], workingDirectory: string) => {
    let handleableUrl;
    if (process.platform == "win32") {
        let launchArgs = commandLine.slice(1);
        if (launchArgs.length > 0 &&
            (launchArgs[0].indexOf("pretzel://") === 0 ||
                launchArgs[0].indexOf("pretzel-desktop://") === 0)) {
            handleableUrl = launchArgs[0]
                .replace("pretzel-desktop://", "")
                .replace("pretzel://", "")
                .replace("/?", "?");
        }
    }
    if (mainWindow) {
        if (handleableUrl) {
            mainWindow.loadURL(appUrl + "/" + handleableUrl).then();
        }
        if (mainWindow.isMinimized())
            mainWindow.restore();
        if (!mainWindow.isVisible())
            mainWindow.show();
        mainWindow.focus();
    }
});

let template : MenuItemConstructorOptions[] = [
    {
        label: "Edit",
        submenu: [
            {
                role: "undo"
            },
            {
                role: "redo"
            },
            {
                type: "separator"
            },
            {
                role: "cut"
            },
            {
                role: "copy"
            },
            {
                role: "paste"
            },
            {
                role: "delete"
            },
            {
                role: "selectAll"
            }
        ]
    },
    {
        role: "window",
        submenu: [
            {
                role: "minimize"
            },
            {
                role: "close"
            }
        ]
    },
    {
        role: "help",
        submenu: [
            {
                label: "Pretzel on the web.",
                click: () => shell.openExternal("https://www.pretzel.rocks")
            },
            {
                type: "separator"
            },
            {
                label: "Debug",
                submenu: [
                    {
                        role: "toggleDevTools"
                    }
                ]
            }
        ]
    }
];
if (process.platform === 'darwin') {
    let name = app.getName();
    template.unshift({
        label: name,
        submenu: [
            {
                label: 'About ' + name,
                role: 'about'
            },
            { type: 'separator' },
            { role: 'services', submenu: [] },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            {
                label: 'Quit',
                accelerator: 'Command+Q',
                click: function () {
                    app.quit();
                }
            },
        ]
    });
}



let createWindow = () => {
    let mainWindowState = windowStateKeeper({
        defaultWidth: 1000,
        defaultHeight: 800
    });
    mainWindow = new BrowserWindow({
        x: mainWindowState.x,
        y: mainWindowState.y,
        width: mainWindowState.width,
        height: mainWindowState.height,
        minWidth: 310,
        minHeight: 485,
        resizable: true,
        maximizable: true,
        frame: true,
        autoHideMenuBar: true,
        backgroundColor: "#262b2a",
        title: "Pretzel",
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
        }
    });

    mainWindowState.manage(mainWindow);

    if (process.platform == "win32") {
        let launchArgs = process.argv.slice(1);
        if (launchArgs.length > 0 &&
            (launchArgs[0].indexOf("pretzel://") === 0 ||
                launchArgs[0].indexOf("pretzel-desktop://") === 0)) {
            launchUrl = "/" + launchArgs[0]
                .replace("pretzel-desktop://", "")
                .replace("pretzel://", "")
                .replace("/?", "?");
        }
    }

    console.log("MainWindow Loading: ", launchUrl ? "" + appUrl + launchUrl : appUrl);
    mainWindow.loadURL(launchUrl ? "" + appUrl + launchUrl : appUrl).then();
    mainWindow.on("close", (e: Event) => {
        if (process.platform === "darwin") {
            if (!willQuitApp) {
                e.preventDefault();
                mainWindow.hide();
            }
        }
    });

    mainWindow.on("closed", () => {
        mainWindow = null;
    });

    mainWindow.on("ready-to-show", () => mainWindow.show());

    mainWindow.webContents.on("render-process-gone", (event: Event, details: RenderProcessGoneDetails) => {
        let isKilled = details.reason === "killed";
        electronLog.default.error("webContents", {e: event, killed: isKilled});
    });

    mainWindow.webContents.setWindowOpenHandler(({url}) => {
        if (url != mainWindow.webContents.getURL()) {
            shell.openExternal(url).then();
            return { action: 'allow' }
        }
        return { action: 'deny' }
    })

    mainWindow.on("unresponsive", ( e: string ) => {
        electronLog.default.error("Window unresponsive", {e: e});
    });

    /** Hook up IPCRequest.ts Channels **/
    [
        new WriteTrackInfoChannel(),
        new PickFileChannel(mainWindow),
        new GlobalShortcutChannel(mainWindow),
        new AccountInfoChannel()
    ].forEach((channel: ChannelInterface) => {
        let names = channel.getName();
        console.log("Setting up IPCRequest.ts Channel: ", names);
        if (!Array.isArray(names)) {
            names = [names];
        }
        names.forEach((name: string) => {
            ipcMain.on(name, (event, request) => { channel.handle(event, request) });
        })
    });
};

let handleCustomProtocolLaunch = (event: Event, url: string) => {
    let handleableUrl = url
        .replace("pretzel-desktop://", "")
        .replace("pretzel://", "")
        .replace("/?", "?");
    let logMessage = "handling launch URL: " + url;
    console.log(logMessage);
    if (mainWindow) {
        mainWindow.loadURL(appUrl + "/" + handleableUrl).then();
    } else {
        launchUrl = "/" + handleableUrl;
    }
};

let setUpLogging = () => {
    let logPath = path.join(app.getPath("userData"), "pretzel-current-session.log");
    let prevLogPath = path.join(app.getPath("userData"), "pretzel-last-session.log");
    if (jetpack.exists(logPath)) {
        jetpack.copy(logPath, prevLogPath, {overwrite: true});
    }
    let startLine = app.getName() + " - " + app.getVersion() + " \n";
    jetpack.write(logPath, startLine);
    electronLog.default.transports.file.file = logPath;
    electronLog.default.transports.file.maxSize = 5 * 1024 * 1024;
    electronLog.default.transports.file.level = "info";
    electronLog.default.transports.console.level = "info";
};

protocol.registerSchemesAsPrivileged([
    {scheme: "pretzel", privileges: {secure: true}},
    {scheme: "pretzel-desktop", privileges: {secure: true}}
]);

app.on("ready", () => {
    let menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
    setUpLogging();
    createWindow();
});

app.setAsDefaultProtocolClient("pretzel");
app.setAsDefaultProtocolClient("pretzel-desktop");

app.on("open-url", handleCustomProtocolLaunch);

app.on("before-quit", () => {
    willQuitApp = true;
    globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    if (mainWindow === null) {
        createWindow();
    } else {
        mainWindow.show();
    }
});

ipcMain.on("applyAppSettings", (event: IpcMainEvent, data) => {
    if (data) {
        mainWindow.setAlwaysOnTop(data.alwaysOnTop || false);
    }
});

process.on("uncaughtException", (e: Error) => {
    electronLog.default.error("uncaughtException", {e: e});
});
