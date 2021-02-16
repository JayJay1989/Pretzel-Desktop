"use strict";
import { app, shell, BrowserWindow, ipcMain, Menu, protocol, globalShortcut, MenuItemConstructorOptions } from 'electron'
import * as electronLog from "electron-log"
import * as jetpack from "fs-jetpack"
import {Console} from "console"

import {GlobalShortcutChannel} from "./channels/GlobalShortcutChannel";
import {PickFileChannel} from "./channels/PickFileChannel";
import {WriteTrackInfoChannel} from "./channels/WriteTrackInfoChannel";
import * as windowStateKeeper from "electron-window-state";
import * as path from "path";
import * as electronDebug from "electron-debug";
import * as electronContextMenu from "electron-context-menu";
import * as dotenv from "dotenv"

const console = new Console(process.stdout, process.stderr);
const isDev = false;

let mainWindow: BrowserWindow;
let appUrl: string;
let launchUrl: string;
let willQuitApp: boolean = false;

//electronDebug({showDevTools: false});

electronContextMenu({
    prepend: (params, browserWindow) => {
        return [
            {
                label: "Debug",
                submenu: [
                    {
                        label: "Toggle verbose logging",
                        click: () => mainWindow.webContents.executeJavaScript("pretzel_debug.toggleVerbose()")
                    },
                    {
                        type: "separator"
                    },
                    {
                        label: "Simulate 2 hour playback refresh",
                        click: () => mainWindow.webContents.executeJavaScript("pretzel_debug.force2Hours()")
                    },
                    {
                        label: "Simulate 3 hour paused refresh",
                        click: () => mainWindow.webContents.executeJavaScript("pretzel_debug.force3Hours()")
                    }
                ]
            }
        ];
    },
    shouldShowMenu: (event, params) => {
        if (params.mediaType === "image") {
            return false;
        }
        return true;
    }
});

let isPrimary = app.requestSingleInstanceLock();
if (!isPrimary) {
    app.quit();
}

app.on("second-instance", (event, commandLine, workingDirectory) => {
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
            mainWindow.loadURL(appUrl + "/" + handleableUrl);
        }
        if (mainWindow.isMinimized())
            mainWindow.restore();
        if (!mainWindow.isVisible())
            mainWindow.show();
        mainWindow.focus();
    }
});

let template : Electron.MenuItemConstructorOptions[] = [
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
        minHeight: 463,
        resizable: true,
        maximizable: true,
        frame: true,
        autoHideMenuBar: true,
        backgroundColor: "#262b2a",
        title: "Pretzel",
        show: false,
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true
        }
    });

    mainWindowState.manage(mainWindow);

    try {
        console.log("ENV", dotenv.config());
    } catch (e) {
    }

    appUrl = "https://play.pretzel.rocks";

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

    mainWindow.loadURL(launchUrl ? "" + appUrl + launchUrl : appUrl);

    mainWindow.on("close", (e) => {
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
    mainWindow.on("ready-to-show", () => {
        mainWindow.show();
    });

    mainWindow.webContents.on("crashed", (e, killed) => {
        electronLog["default"].error("webContents", {e: e, killed: killed});
    });

    mainWindow.webContents.on("new-window", (e, url) => {
        if (url != mainWindow.webContents.getURL()) {
            e.preventDefault();
            shell.openExternal(url);
        }
    });

    mainWindow.on("unresponsive", ( e: string ) => {
        electronLog["default"].error("Window unresponsive", {e: e});
    });

    /** Hook up IPCRequest.ts Channels **/
    [
        new WriteTrackInfoChannel(),
        new PickFileChannel(mainWindow),
        new GlobalShortcutChannel(mainWindow)
    ].forEach((channel) => {
        console.log("Setting up IPCRequest.ts Channel: ", channel.getName());
        ipcMain.on(<string>channel.getName(), (event, request) => {
            return channel.handle(event, request);
        });
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
        mainWindow.loadURL(appUrl + "/" + handleableUrl);
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
    electronLog["default"].transports.file.file = logPath;
    electronLog["default"].transports.file.maxSize = 5 * 1024 * 1024;
    electronLog["default"].transports.file.level = "info";
    electronLog["default"].transports.console.level = "info";
};

protocol.registerSchemesAsPrivileged([
    {scheme: "pretzel", privileges: {secure: true}},
    {scheme: "pretzel-desktop", privileges: {secure: true}}
]);

app.on("ready", () => {
    let menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
    setUpLogging();
    // app.removeListener('open-url', handleCustomProtocolLaunch);
    // setUpCustomHandler();
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

ipcMain.on("applyAppSettings", (event, data) => {
    if (data) {
        mainWindow.setAlwaysOnTop(data.alwaysOnTop || false);
    }
});

process.on("uncaughtException", (e) => {
    electronLog["default"].error("uncaughtException", {e: e});
});