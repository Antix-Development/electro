/*
Electro - A basic single page Electron application template.
Copyright (c) Cliff Earl, Antix Development, 2022.
MIT License:
*/

'use-strict';

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {

  // 
  // Functions that `ipcMain` can call on `ipcRenderer`
  // 

  resized: (channel, func) => ipcRenderer.on(channel, func),

  // 
  // Functions that `ipcRenderer` can call on `ipcMain`
  // 

  // General
  getPlatform: () => (ipcRenderer.sendSync('getPlatform')),
  setWindowIcon: (dataURL) => (ipcRenderer.sendSync('setWindowIcon', dataURL)),

  quitApplication: () => (ipcRenderer.sendSync('quitApplication')),
  enableConfig: (state) => (ipcRenderer.sendSync('enableConfig', state)),
  launchURL: (url) => (ipcRenderer.sendSync('launchURL', url)),

  // File system operations
  exists: (path) => (ipcRenderer.sendSync('exists', path)),
  deleteFile: (path) => (ipcRenderer.sendSync('unlinksync', path)),
  createFolder: (path) => (ipcRenderer.sendSync('createFolder', path)),
  fileInfo: (path) => (ipcRenderer.sendSync('fileInfo', path)),
  currentDirectory: (path) => (ipcRenderer.sendSync('currentDirectory', path)),
  newFileName: (...parts) => (ipcRenderer.sendSync('newFileName', ...parts)),

  loadTextFile: (path) => (ipcRenderer.sendSync('loadTextFile', path)),
  saveTextFile: (path, data) => (ipcRenderer.sendSync('saveTextFile', {path: path, data : data})),
  saveBinaryFile: (path, data) => (ipcRenderer.sendSync('saveBinaryFile', {path: path, data : data})),
  saveCanvas: (path, dataURL) => (ipcRenderer.sendSync('saveCanvas', {path : path, dataURL: dataURL})),

  showSingleFileDialog: (options) => (ipcRenderer.sendSync('showSingleFileDialog', {title: options.title, defaultPath : options.path, filters: [options.filter]})),
  showMultipleFileDialog: (options) => (ipcRenderer.sendSync('showMultipleFileDialog', {title: options.title, defaultPath : options.path, filters: [options.filter]})),
  showSaveFileDialog: (options) => (ipcRenderer.sendSync('showSaveFileDialog', {title: options.title, defaultPath : options.path, filters: [options.filter]})),

  // Title bar and menus
  setWindowTitle: () => (ipcRenderer.sendSync('setWindowTitle')),
  maximizeWindow: () => ipcRenderer.send('maximize'),
  minimizeWindow: () => ipcRenderer.send('minimize'),
  quitApplication: () => ipcRenderer.send('close'),
});
