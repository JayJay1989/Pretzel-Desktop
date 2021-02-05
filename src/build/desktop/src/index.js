"use strict";
var electron = require("electron");
var electron_log = require("electron-log");
var WriteTrackInfoChannel_1 = require("./channels/WriteTrackInfoChannel");
var path = require("path");
var jetpack = require("fs-jetpack");
var PickFileChannel = require("./channels/PickFileChannel");
var Console = require("console").Console;
var console = new Console(process.stdout, process.stderr);
var windowStateKeeper = require("electron-window-state");
var GlobalShortcutChannel = require("./channels/GlobalShortcutChannel");
var isDev = false;

var mainWindow;
var appUrl;
var launchUrl;
var willQuitApp = false;
var appUpdateTimer;

require("electron-debug")({ showDevTools: false });

require("electron-context-menu")({
    prepend: function (params, browserWindow) { return [
        {
            label: "Debug",
            submenu: [
                {
                    label: "Toggle verbose logging",
                    click: function () {
                        mainWindow.webContents.executeJavaScript("pretzel_debug.toggleVerbose()");
                    }
                },
                {
                    type: "separator"
                },
                {
                    label: "Simulate 2 hour playback refresh",
                    click: function () {
                        mainWindow.webContents.executeJavaScript("pretzel_debug.force2Hours()");
                    }
                },
                {
                    label: "Simulate 3 hour paused refresh",
                    click: function () {
                        mainWindow.webContents.executeJavaScript("pretzel_debug.force3Hours()");
                    }
                }
            ]
        }
    ]; },
    shouldShowMenu: function (event, params) {
        if (params.mediaType === "image") {
            return false;
        }
        return true;
    }
});

var isPrimary = electron.app.requestSingleInstanceLock();
if (!isPrimary) {
    electron.app.quit();
}

electron.app.on("second-instance", function (event, commandLine, workingDirectory) {
    var handleableUrl;
    if (process.platform == "win32") {
        var launchArgs = commandLine.slice(1);
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

var template = [
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
                click: function () {
                    electron.shell.openExternal("https://www.pretzel.rocks");
                }
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

if (process.platform === "darwin") {
    var name = electron.app.getName();
    template.unshift({
        label: name,
        submenu: [
            {
                label: "About " + name,
                role: "about"
            },
            { type: "separator" },
            { role: "services", submenu: [] },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            {
                label: "Quit",
                accelerator: "Command+Q",
                click: function () {
                    electron.app.quit();
                }
            }
        ]
    });
}
var createWindow = function () {
    var mainWindowState = windowStateKeeper({
        defaultWidth: 1000,
        defaultHeight: 800
    });
    mainWindow = new electron.BrowserWindow({
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
        console.log("ENV", require("dotenv").config());
    }
    catch (e) { }

    appUrl = "https://play.pretzel.rocks";

    if (process.platform == "win32") {
        var launchArgs = process.argv.slice(1);
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

    mainWindow.on("close", function (e) {
        if (process.platform === "darwin") {
            if (!willQuitApp) {
                e.preventDefault();
                mainWindow.hide();
            }
        }
    });
    mainWindow.on("closed", function () {
        mainWindow = null;
    });
    mainWindow.on("ready-to-show", function () {
        mainWindow.show();
    });

    mainWindow.webContents.on("crashed", function (e, killed) {
        electron_log["default"].error("webContents", { e: e, killed: killed });
    });

    mainWindow.webContents.on("new-window", function (e, url) {
        if (url != mainWindow.webContents.getURL()) {
            e.preventDefault();
            electron.shell.openExternal(url);
        }
    });

    mainWindow.on("unresponsive", function (e) {
        electron_log["default"].error("Window unresponsive", { e: e });
    });

    /** Hook up IPC Channels **/
    [
        new WriteTrackInfoChannel_1.WriteTrackInfoChannel(),
        new PickFileChannel.PickFileChannel(mainWindow),
        new GlobalShortcutChannel.GlobalShortcutChannel(mainWindow)
    ].forEach(function (channel) {
        console.log("Setting up IPC Channel: ", channel.getName());
        electron.ipcMain.on(channel.getName(), function (event, request) {
            return channel.handle(event, request);
        });
    });
};

var handleCustomProtocolLaunch = function (event, url) {
    var handlebaleUrl = url
        .replace("pretzel-desktop://", "")
        .replace("pretzel://", "")
        .replace("/?", "?");
    var logMessage = "handling launch URL: " + url;
    console.log(logMessage);
    if (mainWindow) {
        mainWindow.loadURL(appUrl + "/" + handlebaleUrl);
    }
    else {
        launchUrl = "/" + handlebaleUrl;
    }
};

var setUpLogging = function () {
    var logPath = path.join(electron.app.getPath("userData"), "pretzel-current-session.log");
    var prevLogPath = path.join(electron.app.getPath("userData"), "pretzel-last-session.log");
    if (jetpack.exists(logPath)) {
        jetpack.copy(logPath, prevLogPath, { overwrite: true });
    }
    var startLine = electron.app.getName() + " - " + electron.app.getVersion() + " \n";
    jetpack.write(logPath, startLine);
    electron_log["default"].transports.file.file = logPath;
    electron_log["default"].transports.file.maxSize = 5 * 1024 * 1024;
    electron_log["default"].transports.file.level = "info";
    electron_log["default"].transports.console.level = "info";
};

electron.protocol.registerSchemesAsPrivileged([
    { scheme: "pretzel", privileges: { secure: true } },
    { scheme: "pretzel-desktop", privileges: { secure: true } }
]);

electron.app.on("ready", function () {
    var menu = electron.Menu.buildFromTemplate(template);
    electron.Menu.setApplicationMenu(menu);
    setUpLogging();
    // app.removeListener('open-url', handleCustomProtocolLaunch);
    // setUpCustomHandler();
    createWindow();
});

electron.app.setAsDefaultProtocolClient("pretzel");

electron.app.setAsDefaultProtocolClient("pretzel-desktop");

electron.app.on("open-url", handleCustomProtocolLaunch);

electron.app.on("before-quit", function () {
    willQuitApp = true;
    electron.globalShortcut.unregisterAll();
    clearInterval(appUpdateTimer);
});

electron.app.on("window-all-closed", function () {
    if (process.platform !== "darwin") {
        electron.app.quit();
    }
});

electron.app.on("activate", function () {
    if (mainWindow === null) {
        createWindow();
    }
    else {
        mainWindow.show();
    }
});

electron.ipcMain.on("applyAppSettings", function (event, data) {
    if (data) {
        mainWindow.setAlwaysOnTop(data.alwaysOnTop || false);
    }
});

process.on("uncaughtException", function (e) {
    electron_log["default"].error("uncaughtException", { e: e });
});