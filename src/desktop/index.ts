import MenuItem = Electron.MenuItem;
import MenuItemConstructorOptions = Electron.MenuItemConstructorOptions;
import { app, BrowserWindow, shell, ipcMain, Menu, globalShortcut, protocol } from 'electron';
import log from 'electron-log';
import windowStateKeeper from 'electron-window-state';
import jetpack from 'fs-jetpack';
import * as path from 'path';
import { AccountInfoChannel } from "./channels/AccountInfoChannel";
import { GlobalShortcutChannel } from "./channels/GlobalShortcutChannel";
import { PickFileChannel } from "./channels/PickFileChannel";
import { WriteTrackInfoChannel } from "./channels/WriteTrackInfoChannel";
import WebSocketServerService from "./websocket-service";
import { enable, initialize } from '@electron/remote/main';
import isDev from 'electron-is-dev';
import environment from "./environments/environment.prod";

const Console = require('console').Console;
const console = new Console(process.stdout, process.stderr);
let mainWindow: BrowserWindow;
let appUrl: string;
let launchUrl: string;
let willQuitApp = false;
let webSocketService: WebSocketServerService;

const isPrimary = app.requestSingleInstanceLock();

if (!isPrimary) {
  app.quit();
}

app.on('second-instance', (event, commandLine, workingDirectory) => {
  let handleableUrl;
  if (process.platform == 'win32') {
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

const template: Array<MenuItemConstructorOptions | MenuItem> = [
  {
    label: 'Edit',
    submenu: [
      {
        role: 'undo',
      },
      {
        role: 'redo',
      },
      {
        type: 'separator',
      },
      {
        role: 'cut',
      },
      {
        role: 'copy',
      },
      {
        role: 'paste',
      },
      {
        role: 'delete',
      },
      {
        role: 'selectAll',
      },
    ],
  },
  {
    role: 'window',
    submenu: [
      {
        role: 'minimize',
      },
      {
        role: 'close',
      },
    ],
  },
  {
    role: 'help',
    submenu: [
      {
        label: 'Pretzel on the web.',
        click() {
          shell.openExternal('https://www.pretzel.rocks');
        },
      },
      {
        type: 'separator',
      },
      {
        label: 'Debug',
        submenu: [
          {
            role: 'toggleDevTools',
          },
        ],
      },
    ],
  },
];

if (process.platform === 'darwin') {
  const name = app.getName();
  template.unshift({
    label: name,
    submenu: [
      {
        label: 'About ' + name,
        role: 'about',
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
        click() {
          app.quit();
        },
      },
    ],
  });
}

const createWindow = () => {
  const mainWindowState = windowStateKeeper({
    defaultWidth: 1000,
    defaultHeight: 800,
  });

  initialize();

  mainWindow = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    minWidth: process.platform === 'darwin' ? 310 : 326,
    minHeight: process.platform === 'darwin' ? 485 : 502,
    resizable: true,
    maximizable: true,
    frame: true,
    autoHideMenuBar: true,
    // backgroundColor: '#29B2A4',
    backgroundColor: '#262b2a',
    title: 'Pretzel',
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  mainWindowState.manage(mainWindow);
  if (isDev) {
    if (process.env['USE_PROD_UI'] !== 'true' || !environment.USE_PROD_UI) {
      // @ts-ignore
      const port = parseInt(process.env['PORT'], 10) || 3002;
      appUrl = `http://play.pretzel.wtf:${port}`;
      console.log(`Dev connecting to ${appUrl}`);
    }
  }
  if (!appUrl) {
    appUrl = process.env['SITE'] || environment.site || `https://play.pretzel.rocks`;
  }
  if (process.platform == 'win32') {
    const launchArgs = process.argv.slice(1);
    if (launchArgs.length > 0 && (launchArgs[0].indexOf('pretzel://') === 0 || launchArgs[0].indexOf('pretzel-desktop://') === 0)) {
      launchUrl = `/${launchArgs[0].replace('pretzel-desktop://', '').replace('pretzel://', '').replace('/?', '?')}`;
    }
  }
  console.log('MainWindow Loading: ', launchUrl ? `${appUrl}${launchUrl}` : appUrl);
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
    log.error('webContents', { e, killed });
  });

  mainWindow.webContents.on('new-window', (e, url) => {
    if (url != mainWindow.webContents.getURL()) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on('unresponsive', (e: any) => {
    // console.log('Window unresponsive', e);
    log.error('Window unresponsive', { e });
  });

  /** @electron/remote is the cheater IPC **/
  enable(mainWindow.webContents);

  /** Hook up IPC Channels **/
  [new WriteTrackInfoChannel(), new PickFileChannel(mainWindow), new GlobalShortcutChannel(mainWindow), new AccountInfoChannel()].forEach(
    (channel) => {
      console.log('Setting up IPC Channel: ', channel.getName());
      let names = channel.getName();
      if (!Array.isArray(names)) {
        names = [names];
      }
      names.forEach((name) => {
        ipcMain.on(name, (event, request) => channel.handle(event, request));
      });
    }
  );
};

const handleCustomProtocolLaunch = (event: Event, url: string) => {
  const handlebaleUrl = url.replace('pretzel-desktop://', '').replace('pretzel://', '').replace('/?', '?');
  const logMessage = `handling launch URL: ${url}`;
  console.log(logMessage);

  if (mainWindow) {
    mainWindow.loadURL(`${appUrl}/${handlebaleUrl}`);
  } else {
    launchUrl = `/${handlebaleUrl}`;
  }
};

const setUpLogging = () => {
  const logPath = path.join(app.getPath('userData'), 'pretzel-current-session.log');
  const prevLogPath = path.join(app.getPath('userData'), 'pretzel-last-session.log');
  if (jetpack.exists(logPath)) {
    jetpack.copy(logPath, prevLogPath, { overwrite: true });
  }
  const startLine = `${app.getName()} - ${app.getVersion()} \n`;
  jetpack.write(logPath, startLine);
  log.transports.file.file = logPath;
  log.transports.file.maxSize = 5 * 1024 * 1024;
  log.transports.file.level = 'info';
  log.transports.console.level = 'info';
};

protocol.registerSchemesAsPrivileged([
  { scheme: 'pretzel', privileges: { secure: true } },
  { scheme: 'pretzel-desktop', privileges: { secure: true } },
]);

app.on('ready', (): void => {
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  setUpLogging();
  webSocketService = new WebSocketServerService(parseInt(process.env['WEBSOCKET_PORT'] || environment.WEBSOCKET_PORT));
  createWindow();
});

app.setAsDefaultProtocolClient('pretzel');
app.setAsDefaultProtocolClient('pretzel-desktop');

app.on('open-url', handleCustomProtocolLaunch);

app.on('before-quit', (): void => {
  webSocketService.close();
  willQuitApp = true;
  globalShortcut.unregisterAll();
  // protocol.unregisterProtocol('pretzel');
  // protocol.unregisterProtocol('pretzel-desktop');
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

ipcMain.on('applyAppSettings', (event, data) => {
  if (data) {
    mainWindow.setAlwaysOnTop(data.alwaysOnTop || false);
  }
});

process.on('uncaughtException', (e) => {
  // console.error(e);
  log.error('uncaughtException', { e });
});
