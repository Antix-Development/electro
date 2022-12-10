/*
Electro - A basic single page Electron application template.
Copyright (c) Cliff Earl, Antix Development, 2022.
MIT License:
*/

'use-strict';

const 
path = require('path'),
fs = require('fs'),

{app, ipcMain, BrowserWindow, Menu, dialog, nativeImage, shell } = require('electron'),

CONFIG_NAME = path.join(__dirname, '.electro'),

DEFAULT_WIDTH = 800,
DEFAULT_HEIGHT = 600;

let mainWindow,
config;

// Application ready handler
app.on('ready', () => {

  loadConfig(); // Load configuration

  // Create menu template. NOTE: This menu will NOT be visible because we are creating a `frameless` window, but the hotkeys will still work
  const mainMenuTemplate = [
    {
      label: 'Tools',
      submenu: [

        // {
        //   label: 'Reload Page',
        //   role: 'reload',
        //   accelerator: 'F5',
        // },

        // {
        //   label: 'Dev Tools',
        //   accelerator: 'F12',
        //   click() {
        //     mainWindow.toggleDevTools();
        //   }
        // },

        {
          label: 'Toggle FullSceen',
          role: 'togglefullscreen',
          accelerator: 'F11',
        },
      ]
    },
  ],
  mainMenu = Menu.buildFromTemplate(mainMenuTemplate);
  Menu.setApplicationMenu(mainMenu);

  // Create the main window
  let mainWindowTemplate = {
    frame: false,
    show: false,

    x: 0,
    y: 0,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,

    minWidth: 400,
    minHeight: 300,

    resizable: true,
    movable: true,

    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    }
  };
  (config) ? mainWindow = new BrowserWindow(Object.assign(mainWindowTemplate, config)) : mainWindow = new BrowserWindow(mainWindowTemplate); // Apply config if required and open window

  mainWindow.loadFile(path.join(__dirname, 'index.html')); // Load index.html into the window

  // 
  // Window event handlers
  // 

  // Don't show the window until it has fully loaded (avoiding ugly flashing) (https://www.electronjs.org/docs/api/browser-window#showing-window-gracefully)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (config && config.electro_maximized) mainWindow.maximize();
  });

    // Save configuration before exiting
  mainWindow.on('close', () => {
    if (config) saveConfig();
  });

  // Exit
  mainWindow.on('closed', () => app.quit());

  // 
  // Window resize event handlers
  // Raise events on the ipcRenderer process for each type of resize event to address the browsers inability to handle such events correctly.
  // 

  mainWindow.on('enter-full-screen', () => mainWindow.webContents.send('resized', 'entered-full-screen'));

  mainWindow.on('leave-full-screen', () => mainWindow.webContents.send('resized', 'exited-full-screen'));

  mainWindow.on('restore', () => mainWindow.webContents.send('resized', 'restored'));

  mainWindow.on('minimize', () => mainWindow.webContents.send('resized', 'minimized'));

  mainWindow.on('maximize', () => {
    if (config) config.electro_maximized = true; // Also save for next launch if required
    mainWindow.webContents.send('resized', 'maximized');
  });

  mainWindow.on('unmaximize', () => {
    if (config) config.electro_maximized = false; // Also save for next launch if required
    mainWindow.webContents.send('resized', 'unmaximized');
  });

}); // End application ready handler

// 
// The remaining code contains methods that `ipcRenderer` process can invoke through the context-bridge (https://www.electronjs.org/docs/latest/api/context-bridge)
// 

ipcMain.on('quitApplication', () => process.exit(0));

ipcMain.on('launchURL', (e, url) => {
  shell.openExternal(url); // Open the given URL in the systems default browser
  e.returnValue = true;
});

// 
// User interface
// 

ipcMain.on('minimize', () => mainWindow.isMinimized() ? mainWindow.restore() : mainWindow.minimize());

ipcMain.on('maximize', () => (mainWindow.isMaximized()) ? mainWindow.restore() : mainWindow.maximize());

ipcMain.on('getPlatform', (e) => e.returnValue = process.platform);

ipcMain.on('close', () => mainWindow.close());

ipcMain.on('setWindowIcon', (e, name) => {
  mainWindow.setIcon(name);
  e.returnValue = true;
});

// 
// Native Dialogs
// 

ipcMain.on('showSingleFileDialog', (e, options) => {
  const fileNames = dialog.showOpenDialogSync(mainWindow, Object.assign({properties: ['openFile']}, options));
  e.returnValue = (fileNames) ? fileNames[0] : null;
});

ipcMain.on('showMultipleFileDialog', (e, options) => e.returnValue = dialog.showOpenDialogSync(mainWindow, Object.assign({properties: ['openFile', 'multiSelections']}, options)));

ipcMain.on('showSaveFileDialog', (e, options) => e.returnValue = dialog.showSaveDialogSync(mainWindow, options));

ipcMain.on('showChooseFolderDialog', (e, options) => e.returnValue = dialog.showOpenDialogSync(mainWindow, Object.assign({properties: ['openDirectory']}, options)));

// 
// File system
// 

ipcMain.on('exists', (e, name) => e.returnValue = fs.existsSync(name));

ipcMain.on('deleteFile', (e, name) => e.returnValue = fs.unlinkSync(name));

ipcMain.on('createFolder', (e, name) => e.returnValue = fs.mkdirSync(name, { recursive: true }));

ipcMain.on('fileInfo', (e, name) => e.returnValue = path.parse(name));

ipcMain.on('currentDirectory', (e, name) => {
  if (!name) { // Get the current directory
    e.returnValue = process.cwd();

  } else { // Change the current directory
    try {
      process.chdir(name);
      e.returnValue = true;
    } catch (err) {
      e.returnValue = false;
    }
  }
});

ipcMain.on('newFileName', (e, ...parts) => e.returnValue = path.join(...parts));

ipcMain.on('loadTextFile', (e, path) => {
  try {
    e.returnValue = fs.readFileSync(path, 'utf8');
  } catch (err) {
    e.returnValue = null;
  }
});

ipcMain.on('saveTextFile', (e, file) => e.returnValue = fs.writeFileSync(file.path, file.data, {encoding: 'utf8'}));

ipcMain.on('saveBinaryFile', (e, file) => e.returnValue = fs.writeFileSync(file.path, file.data, {encoding: 'binary'}));

// Convert the given dataURL to a PNG image and save it with the given name
ipcMain.on('saveCanvas', (e, data) => {
  const 
  img = nativeImage.createFromDataURL(data.dataURL),
  pngFile = img.toPNG();

  fs.writeFileSync(data.path, pngFile, {encoding: 'binary'})

  e.returnValue = true
});

// 
// Configuration Management
// 

ipcMain.on('enableConfig', (e, state) => {

  if (state) {
    if (!fs.existsSync(CONFIG_NAME)) createConfig(); // Enable

  } else {
    if (fs.existsSync(CONFIG_NAME)) deleteConfig(); // Disable
  }

  e.returnValue = true;
});

const 

loadConfig = () => {
  if (fs.existsSync(CONFIG_NAME)) config = JSON.parse(fs.readFileSync(CONFIG_NAME, 'utf8'))
},

createConfig = () => config = {
  x: 0, 
  y: 0, 
  width: DEFAULT_WIDTH,
  height: DEFAULT_HEIGHT,
  electro_maximized: false
},

deleteConfig = () => fs.unlinkSync(CONFIG_NAME),

saveConfig = () => {
  if (mainWindow.isMinimized() || mainWindow.isFullScreen()) return;

  if (!config.electro_maximized) config = Object.assign(config, mainWindow.getContentBounds()); // Overwrite bounds

  fs.writeFileSync(CONFIG_NAME, JSON.stringify(config), {encoding: 'utf8'});
};
