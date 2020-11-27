'use strict'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
process.env.ELECTRON_IS_DEV = '0';

const path = require('path');
const electron = require('electron');
const isDev = require('electron-is-dev');
const jetpack = require('fs-jetpack');
const log = require('electron-log');
const request = require('request-promise');
const windowStateKeeper = require('./windowPositionManager');

global.pretzel = 'pretzelIDstring';

const { app, BrowserWindow, shell, ipcMain, dialog, Menu, globalShortcut } = electron;

global.appVersion = app.getVersion();
global.appName = app.getName();

let wsClient;
let mainWindowState;

let shouldTerminateSalt = false;

require('electron-context-menu')({
    prepend: (params, browserWindow) => [{
        label: 'Debug',
        submenu: [
            {
                label: 'Toggle verbose logging',
                click: () => {
                    mainWindow.webContents.executeJavaScript('pretzel_debug.toggleVerbose()');
                }
            },
            {
                type: 'separator'
            },
            {
                label: 'Simulate 2 hour playback refresh',
                click: () => {
                    mainWindow.webContents.executeJavaScript('pretzel_debug.force2Hours()');
                }
            },
            {
                label: 'Simulate 3 hour paused refresh',
                click: () => {
                    mainWindow.webContents.executeJavaScript('pretzel_debug.force3Hours()');
                }
            },
            {
                label: 'Devtools',
                click(){
                    mainWindow.webContents.openDevTools();
                }
            }
        ]
    }],
    shouldShowMenu: (event, params) => {
        if (params.mediaType === 'image') {
            return false;
        }
        return true;
    }
});

let mainWindow;
let loginWindow;
let appUrl;
let launchUrl;
let willQuitApp = false;
let appUpdateTimer;

const shouldQuit = app.makeSingleInstance((commandLine, workingDirectory) => {
    let handleableUrl;
    if (process.platform === 'win32') {
        const launchArgs = commandLine.slice(1);
        if (launchArgs.length > 0 && (launchArgs[0].indexOf('pretzel://') === 0 || launchArgs[0].indexOf('pretzel-desktop://') === 0)) {
            handleableUrl = launchArgs[0].replace('pretzel-desktop://', '').replace('pretzel://', '').replace('/?', '?');
        }
    }
    if (mainWindow) {
        if (handleableUrl) {
            mainWindow.loadURL(`${appUrl}/${handleableUrl}`);
        }
        if (mainWindow.isMinimized()) mainWindow.restore();
        if (!mainWindow.isVisible()) mainWindow.show();
        mainWindow.focus();
    }
});

if (shouldQuit) {
    app.quit();
}

let template = [
    {
        label: 'Edit',
        submenu: [
            {
                role: 'undo'
            },
            {
                role: 'redo'
            },
            {
                type: 'separator'
            },
            {
                role: 'cut'
            },
            {
                role: 'copy'
            },
            {
                role: 'paste'
            },
            {
                role: 'delete'
            },
            {
                role: 'selectall'
            }
        ]
    },
    {
        role: 'window',
        submenu: [
            {
                role: 'minimize'
            },
            {
                role: 'close'
            }
        ]
    },
    {
        role: 'help',
        submenu: [
            {
                label: 'Pretzel on the web.',
                click() {
                    electron.shell.openExternal('https://www.pretzel.rocks')
                }
            },
            {
                type: 'separator'
            },
            {
                label: 'Debug',
                submenu: [
                    {
                        role: 'toggledevtools'
                    }
                ]
            }
        ]
    }
];
if (process.platform === 'darwin') {
    const name = app.getName();
    template.unshift({
        label: name,
        submenu: [
            {
                label: 'About ' + name,
                role: 'about'
            },
            {type: 'separator'},
            {role: 'services', submenu: []},
            {type: 'separator'},
            {role: 'hide'},
            {role: 'hideothers'},
            {role: 'unhide'},
            {type: 'separator'},
            {
                label: 'Quit',
                accelerator: 'Command+Q',
                click() {
                    app.quit();
                }
            },
        ]
    })
}

const createWindow = () => {

    const {x, y} = mainWindowState;
    mainWindow = new BrowserWindow({
        x,
        y,
        width: 1000,
        height: 800,
        minWidth: 800,
        minHeight: process.platform === 'darwin' ? 470 : 500,
        resizable: true,
        maximizable: true,
        frame: true,
        autoHideMenuBar: true,
        backgroundColor: '#262b2a',
        title: 'Pretzel',
        show: false,
        preload: './logger.js',
    });

    mainWindowState.setWindowBounds(mainWindow);
    if (x && y) {
        mainWindow.setPosition(x, y);
    }
    mainWindowState.manage(mainWindow);
    if (isDev) {
        const port = parseInt(process.env.PORT, 10) || 3001;
        appUrl = `http://app.pretzel.wtf:${port}`;
    } else {
        appUrl = `https://play.pretzel.rocks`;
    }
    if (process.platform == 'win32') {
        const launchArgs = process.argv.slice(1);
        if (launchArgs.length > 0 && (launchArgs[0].indexOf('pretzel://') === 0 || launchArgs[0].indexOf('pretzel-desktop://') === 0)) {
            launchUrl = `/${launchArgs[0].replace('pretzel-desktop://', '').replace('pretzel://', '').replace('/?', '?')}`;
        }
    }
    mainWindow.loadURL(launchUrl ? `${appUrl}${launchUrl}` : appUrl);
    mainWindow.on('close', (e) => {
        if (process.platform === 'darwin') {
            if (!willQuitApp) {
                e.preventDefault();
                mainWindow.hide();
            }
        }
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
    mainWindow.on('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.webContents.on('crashed', (e, killed) => {
        // console.log('webContents crashed', e, killed);
        log.error('webContents', {e, killed});
    });

    mainWindow.webContents.on('will-navigate', (e, url) => {
        if (url != mainWindow.webContents.getURL()) {
            let apiBase = 'https://api.pretzel.rocks';
            if (isDev) {
                apiBase = 'http://api.pretzel.wtf:3000'
            }
            if (url.indexOf(`${apiBase}/auth/`) === 0) {
                e.preventDefault();
                loginWindow = new BrowserWindow({
                    useContentSize: true,
                    center: true,
                    show: true,
                    resizable: false,
                    standardWindow: true,
                    autoHideMenuBar: true,
                    title: 'Pretzel Auth',
                    height: 580,
                    parent: mainWindow,
                    webPreferences: {
                        nodeIntegration: false,
                        contextIsolation: true,
                        sandbox: true,
                        partition: 'tempLogin',
                        nativeWindowOpen: true,
                        sharedSiteInstances: true
                    }
                });
                const loginContent = loginWindow.webContents;
                loginWindow.on('page-title-updated', (e) => e.preventDefault());

                loginContent.session.webRequest.onHeadersReceived({
                    urls: ['https://app.pretzel.rocks/login', 'http://app.pretzel.wtf:3001/login'],
                }, ({url}, cb) => {
                    let res = {}
                    if (url.indexOf(`${appUrl}/login`) === 0) {
                        mainWindow.loadURL(url);
                        loginWindow.close();
                        res = {
                            cancel: true,
                        };
                    }
                    cb(res);
                })

                loginWindow.on('closed', () => {
                    mainWindow.webContents.send('desktopLogin');
                    loginWindow = null;
                });
                loginWindow.once('ready-to-show', () => {
                    loginWindow.show();
                });
                loginWindow.loadURL(url);
            }
        }
    });

    mainWindow.webContents.on('new-window', (e, url) => {
        if (url != mainWindow.webContents.getURL()) {
            e.preventDefault();
            shell.openExternal(url);
        }
    });

    mainWindow.on('unresponsive', (e) => {
        log.error('Window unresponsive', {e});
    });
}

const handleCustomProtocolLaunch = (event, url) => {
    const handlebaleUrl = url.replace('pretzel-desktop://', '').replace('pretzel://', '').replace('/?', '?');
    const logMessage = `handling launch URL: ${url}`;
    console.log(logMessage);
    if (mainWindow) {
        mainWindow.loadURL(`${appUrl}/${handlebaleUrl}`);
    } else {
        launchUrl = `/${handlebaleUrl}`;
    }
}

const notifyAppUpdate = (data) => {
    mainWindow.webContents.send('newUpdate', data);
}

const setUpLogging = () => {
    const logPath = path.join(app.getPath('userData'), 'pretzel-current-session.log');
    const prevLogPath = path.join(app.getPath('userData'), 'pretzel-last-session.log');
    if (jetpack.exists(logPath)) {
        jetpack.copy(logPath, prevLogPath, {overwrite: true});
    }
    const startLine = `${app.getName()} - ${app.getVersion()} \n`;
    jetpack.write(logPath, startLine);
    log.transports.file.file = logPath;
    log.transports.file.maxSize = 5 * 1024 * 1024;
    log.transports.file.level = 'info';
    log.transports.console.level = 'info';
}

const setupKeybinds = (bindOptions) => {
    globalShortcut.unregisterAll();
    let mediaError = false;
    const keybindErrors = [];
    const missingConfig = [];
    if (bindOptions && bindOptions.useMediaKeys) {
        const playPause = globalShortcut.register('MediaPlayPause', () => mainWindow.webContents.send('globalShortcut', {action: 'togglePause'}));
        const next = globalShortcut.register('MediaNextTrack', () => mainWindow.webContents.send('globalShortcut', {action: 'next'}));
        const prev = globalShortcut.register('MediaPreviousTrack', () => mainWindow.webContents.send('globalShortcut', {action: 'prev'}));
        if (!playPause || !next || !prev) {
            mediaError = true;
        }
    }
    if (bindOptions && bindOptions.keybinds) {
        log.log(bindOptions.keybinds);
        bindOptions.keybinds.forEach((keybind, index) => {
            if (keybind.accelerator && keybind.payload) {
                if (keybind.disabled) {
                    missingConfig.push(index);
                } else if (!globalShortcut.isRegistered(keybind.accelerator)) {
                    const bound = globalShortcut.register(keybind.accelerator, () => mainWindow.webContents.send('globalShortcut', keybind.payload));
                    if (!bound) {
                        keybindErrors.push(index);
                    }
                } else {
                    keybindErrors.push(index);
                }
            } else {
                missingConfig.push(index);
            }
        });
        const countBound = `${bindOptions.keybinds.length - keybindErrors.length - missingConfig.length} keybinds successfully bound.`;
        const mkBound = `Media keys bound: ${bindOptions.useMediaKeys && !mediaError}`;
        // console.log(countBound);
        log.info(countBound);
        // console.log(mkBound);
        log.info(mkBound);
    }
    mainWindow.webContents.send('keybindErrors', {keybindErrors, mediaError});
}

const disableKeybinds = () => {
    globalShortcut.unregisterAll();
}

app.setAsDefaultProtocolClient('pretzel');
app.setAsDefaultProtocolClient('pretzel-desktop');

app.on('ready', () => {
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
    mainWindowState = windowStateKeeper();
    setUpLogging();
    createWindow();
});

app.on('open-url', handleCustomProtocolLaunch);

app.on('before-quit', () => {
    willQuitApp = true;
    if (shouldTerminateSalt && wsClient) {
        const msg = {
            source: 'desktop',
            action: 'request-exit',
            data: ''
        };
        wsClient.send(JSON.stringify(msg));
    }
    globalShortcut.unregisterAll();
    clearInterval(appUpdateTimer);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    } else {
        mainWindow.show();
    }
});

ipcMain.on('openSaveDialog', (event, data) => {
    const config = {
        title: 'Set Now Playing label file',
        message: 'Set Now Playing label file',
        filters: [
            {name: 'Text', extensions: ['txt']}
        ],
    };
    if (data) {
        config.defaultPath = data;
    }
    dialog.showSaveDialog(mainWindow, config, (fileName) => {
        let enforcedFileName;
        if (fileName) {
            const parsedFileName = fileName.split('.');
            if (parsedFileName[parsedFileName.length - 1] !== 'txt') {
                parsedFileName.push('txt');
            }
            enforcedFileName = parsedFileName.join('.');
            jetpack.file(enforcedFileName);
        }
        event.sender.send('setFilePath', enforcedFileName);
    });
});

ipcMain.on('openSaveDialogAlbum', (event, data) => {
    const config = {
        title: 'Set Album Cover file',
        message: 'Set Album Cover file',
        filters: [
            {name: 'Image', extensions: ['jpg']}
        ],
    };
    if (data) {
        config.defaultPath = data;
    }
    dialog.showSaveDialog(mainWindow, config, (fileName) => {
        let enforcedFileName;
        if (fileName) {
            const parsedFileName = fileName.split('.');
            if (parsedFileName[parsedFileName.length - 1] !== 'jpg') {
                parsedFileName.push('jpg');
            }
            enforcedFileName = parsedFileName.join('.');
            jetpack.file(enforcedFileName);
        }
        event.sender.send('setAlbumCoverFilePath', enforcedFileName);
    });
});

ipcMain.on('updateNowPlaying', (event, data) => {
    if (data && data.albumFilePath && data.nowPlayingAlbumUrl && data.needsArtFetch) {
        request(data.nowPlayingAlbumUrl, {encoding: null}).then((body) => {
            jetpack.file(data.albumFilePath);
            jetpack.write(data.albumFilePath, body);
        });
    }
    if (data && data.filePath && data.nowPlaying !== null) {
        jetpack.file(data.filePath);
        jetpack.write(data.filePath, data.nowPlaying);
    }
});

ipcMain.on('receiveLogin', (event, data) => {
    if (data) {
        loginWindow.close();
        mainWindow.webContents.send('desktopLogin', (data));
    }
});

ipcMain.on('applyUpdate', (event, data) => {
    if (data) {
        willQuitApp = true;
    }
});

ipcMain.on('checkForUpdates', (event) => {
});

ipcMain.on('applyAppSettings', (event, data) => {
    if (data) {
        mainWindow.setAlwaysOnTop(data.alwaysOnTop || false);
    }
});

ipcMain.on('openAllSettings', (event) => {
    const [width, height] = mainWindow.getContentSize();
    mainWindow.setMaximumSize(696, height);
    mainWindow.setMinimumSize(696, height);
    mainWindow.setSize(696, height, true);
});

ipcMain.on('closeAllSettings', (event) => {
    const [width, height] = mainWindow.getContentSize();
    mainWindow.setMaximumSize(304, height);
    mainWindow.setMinimumSize(304, height);
    mainWindow.setSize(304, height);
});

ipcMain.on('setupKeybinds', (event, data) => {
    setupKeybinds(data);
});

ipcMain.on('disableKeybinds', (evet) => {
    disableKeybinds();
});

process.on('uncaughtException', (e) => {
    log.error('uncaughtException', {e});
});
