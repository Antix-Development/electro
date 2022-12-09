/*
Electro - A basic single page Electron application template.
Copyright (c) Cliff Earl, Antix Development, 2022.
MIT License:
*/

'use-strict';

let 
autoExpandMenus, // True when user clicks on a menu title. If true, menus will auto-expand when the user hovers the mouse pointer over their associated menu title
activeMenu, // Menu that is currently open

notifyContainer, // Div containing other notify HTML elements
notifyBadge, // HTML img containing the SVG badge
notifyText, // HTML SPAN containing the notify text
notifyTimeoutID, // Setinterval ID

inDialog, // True if a dialog is currently open
dialogYesCallback, // Callback functions
dialogNoCallback,
dialogVignette, // The full screen vignette that sits behind the dialog
dialogContainer,
dialogTitleContainer,
dialogBadge,
dialogTitle,
dialogBody,
dialogButtonContainer,
dialogYesButton,
dialogNoButton,
dialogSingleButtonMode,

currentDir, // Current directory retrieved from nodeJS `process.cwd()`

electroDirectory, // Folder where Electro lives

resizeCallback;

const 
TYPE_INFORMATION  = 0, // Notification and dialog types
TYPE_WARNING      = 1,
TYPE_ERROR        = 2,

TYPE_NONE         = 0b0000, // Bit masks for combo keys
TYPE_CTRL         = 0b0001,
TYPE_ALT          = 0b0010,
TYPE_SHIFT        = 0b0100,
TYPE_META         = 0b1000,

ALL_FILES_FILTER = {name: 'All Files', extensions: ['*']},

electronAPI = window.electronAPI, // ElectronJS context-bridge

platform = electronAPI.getPlatform(), // Get platform

isMac = platform === 'darwin', // Flag for if this is being run on a Mac

globalHotkeys = [], // Collection of global hotkeys

/** Get the HTML element with the given id
 * @param {string} id 
 * @return {object} element
 */
getByID = (id) => (document.getElementById(id)),

/** Create a new HTML element of the given type or an HTML DIV if no type is given
 * @param {string} type
 */
createElement = (type = 'div') => (document.createElement(type)),

/** Show or hide the given HTML element according to the given state, always showing if no state is given
 * @param {boolean} state
 */
showElement = (el, state = true) => (state) ? el.style.display = 'inherit' : el.style.display = 'none',

/** Load the CSS with the given name and attach it to the head of the document
 * @param {boolean} state
 */
loadStyleSheet = (name) => {
  const link  = createElement('link');
  link.rel  = 'stylesheet';
  link.type = 'text/css';
  link.media = 'all';
  link.href = name;
  document.getElementsByTagName('head')[0].appendChild(link);
},

/** Get the string that represents the given type
 * type {number} type
 */
typeToString = (type) => (['information', 'warning', 'error'][type]),

// Greate a new global hotkey
/**
 * @param {string} key Key required to activate hotkey (https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values)
 * @param {bitmask} comboKeys Extra keys required to activate the hotkey
 * @param {function} callback Code to execute when hotkey activates
 * @param {boolean} isMenu True if the hotkey is a menu hotkey, default is FALSE
 */
newHotkey = (key, comboKeys, callback, isMenu = false) => {
  globalHotkeys.push({
    comboKeys: comboKeys,
    key: key.toLowerCase(), // Convert to lower case
    click: callback,
    isMenu: isMenu,
  });
},

// 
// Core Methods
// 

// Initialize Electro
initialize = (options = {}) => {

  currentDir = currentDirectory(); // Get the current directory

  electroDirectory = newFileName(currentDir, 'modules', 'electro'); // Create for internal use
  
  loadStyleSheet(newFileName(electroDirectory, 'css', 'electro.css'));

  // create title bar div and insert at head of document body
  const titleBarDiv = createElement(); // By default createElement
  titleBarDiv.id = 'title-bar';
  titleBarDiv.addEventListener('dragstart', () => (false));
  document.body.prepend(titleBarDiv);

  // Create app icon and attach it to the title bar
  const titleBarIconImg  = createElement('img');
  titleBarIconImg.id = 'title-bar-icon';
  // titleBarIconImg.src = 'img/app-icon.svg';
  titleBarDiv.appendChild(titleBarIconImg); // First element is the app-icon

  // Create menu div and attach it to the title bar
  const titleBarMenusDiv = createElement();
  titleBarMenusDiv.id = 'title-bar-menus';
  titleBarDiv.appendChild(titleBarMenusDiv);

  // Create menu container and attach it to the menu
  const titleBarMenuContainerDiv = createElement('ul');
  titleBarMenuContainerDiv.id = 'title-bar-menu-container';
  titleBarMenusDiv.appendChild(titleBarMenuContainerDiv);
  
  // Create title bar buttons container and attach it to the title bar
  const titleBarButtonsDiv = createElement();
  titleBarButtonsDiv.id = 'title-bar-buttons';
  titleBarDiv.appendChild(titleBarButtonsDiv);
  
  // Create title bar drag bar and attach it to the title bar
  const titleBarDragBarDiv = createElement();
  titleBarDragBarDiv.id = 'title-bar-drag-bar';
  titleBarDiv.appendChild(titleBarDragBarDiv);

  const temp = createElement(),

  // Load the SVG image with the given name, set it's various styles, and append it to the title bar window buttons container
  loadSVG = (name, ...classes) => {
    temp.innerHTML = loadTextFile(newFileName(electroDirectory, 'img', `${name}.svg`)); // Load SVG file overwrite the temp DIV HTML with it
    let svgImage = temp.firstElementChild; // Get the now valid HTML SVG image element from the temp DIV
    svgImage.id = name; // Set id
    svgImage.classList.add(...classes); // And classes

    // Find all paths for the current SVG image and set their stroke styles so they can be recolored using CSS styles
    const svgPaths = svgImage.getElementsByTagName('path');
    for (let i = 0; i < svgPaths.length; i++) {
      svgPaths[i].classList.add('title-bar-button-color');
    }
  
    titleBarButtonsDiv.appendChild(svgImage); // Apend to final destination

    return svgImage;
  },

  // Load window control buttons
  windowCloseButton = loadSVG('window-close-button', 'title-bar-button', 'title-bar-window-close-button'),
  windowMaximizeButton = loadSVG('window-maximize-button', 'title-bar-button'),
  windowRestoreButton = loadSVG('window-restore-button', 'title-bar-button'),
  windowMinimizeButton = loadSVG('window-minimize-button', 'title-bar-button');

  // If a menu is open and user clicks outside of it, close it and disable auto menu expanding
  document.addEventListener('click', () => {
    if (activeMenu) {
      showElement(activeMenu, false);
      activeMenu = null;
      autoExpandMenus = false;
    }
  });

  // Darken title bar when the window loses focus
  window.addEventListener('blur', () => titleBarDiv.classList.add('title-bar-blurred'));

  // Undarken title bar when the window receives focus
  window.addEventListener('focus', () => titleBarDiv.classList.remove('title-bar-blurred'));

  // Install keyboard handler
  document.addEventListener('keyup', (e) => {
    
    // console.log(e);

    const key = e.key.toLowerCase();

    // Close dialog and execute callback when specific keys pressed while dialog is open
    if (inDialog) {
      e.preventDefault();

      if (key === 'escape') {
        if (!dialogSingleButtonMode) dialogNoButtonClicked();

      } else if (key === 'enter') {
        dialogYesButtonClicked();
      }

      return;
    }

    // Close current menu and forbid auto menu opening when "escape" key pressed
    if (activeMenu && key === 'escape') {
      showElement(activeMenu, false);
      activeMenu = null;
      autoExpandMenus = false;
      e.preventDefault();
      return;
    }

    // Locate and execute code attached to hotkeys (which are in turn, attached to menu items)
    for (let i = 0; i < globalHotkeys.length; i++) {
      const hotKey = globalHotkeys[i];
      if (key === hotKey.key) { // Was a matching hotkey found?
        // Determine what combokeys are being held
        let comboKeys = 0;
        if (e.ctrlKey) comboKeys += TYPE_CTRL;
        if (e.altKey) comboKeys += TYPE_ALT;
        if (e.shiftKey) comboKeys += TYPE_SHIFT;
        if (e.metaKey) comboKeys += TYPE_META;

        if (comboKeys == hotKey.comboKeys && hotKey.click) hotKey.click(); // Execute code

        if (activeMenu) showElement(activeMenu, false);
        activeMenu = null;
        autoExpandMenus = false;

        e.preventDefault();
      }
    }
  });

  // Show maximize button, hide restore button
  const showMaximizeHideRestore = () => {
    showElement(windowMaximizeButton);
    showElement(windowRestoreButton, false);
  },
  // Show restore button, hide maximize button
  showRestoreHideMaximize = () => {
    showElement(windowMaximizeButton, false);
    showElement(windowRestoreButton);
  };

  // Hide when window first opened
  showElement(windowRestoreButton, false);

  // Send events to ipcMain (main.js) when title bar icons clicked
  windowMaximizeButton.addEventListener('click', electronAPI.maximizeWindow);
  windowRestoreButton.addEventListener('click', electronAPI.maximizeWindow);
  windowCloseButton.addEventListener('click', electronAPI.quitApplication);
  windowMinimizeButton.addEventListener('click', electronAPI.minimizeWindow);

  // Set correct imagery for minimize/restore title bar icon when window is resized by double-clicking the title bar
  window.addEventListener('resize', () => (screen.availWidth - window.innerWidth === 0) ? showRestoreHideMaximize() : showMaximizeHideRestore());

  // 
  // Initialize notify
  // 

  notifyContainer = createElement();
  notifyContainer.id = 'notify-container';
  document.body.appendChild(notifyContainer);

  notifyBadge = createElement('img')
  notifyBadge.id = 'notify-badge';
  notifyContainer.appendChild(notifyBadge);

  notifyText = createElement('span')
  notifyText.id = 'notify-text';
  notifyContainer.appendChild(notifyText);

  notifyTimeoutID = null;

  // 
  // Initialize dialog
  // 

  dialogVignette = createElement();
  dialogVignette.id = 'dialog-vignette';
  document.body.appendChild(dialogVignette);

  dialogContainer = createElement();
  dialogContainer.id = 'dialog-container';
  dialogVignette.appendChild(dialogContainer);

  dialogTitleContainer = createElement();
  dialogTitleContainer.id = 'dialog-title-bar';
  dialogContainer.appendChild(dialogTitleContainer);

  dialogBadge = createElement('img');
  dialogBadge.id = 'dialog-badge';
  dialogTitleContainer.appendChild(dialogBadge);

  dialogTitle  = createElement('span');
  dialogTitle.id = 'dialog-title';
  dialogTitleContainer.appendChild(dialogTitle);

  dialogBody = createElement();
  dialogBody.id = 'dialog-body';
  dialogContainer.appendChild(dialogBody);

  dialogButtonContainer = createElement();
  dialogButtonContainer.id = 'dialog-buttons';
  dialogContainer.appendChild(dialogButtonContainer);

  dialogYesButton = createElement('a');
  dialogYesButton.id = 'dialog-yes-button';
  dialogYesButton.classList.add('dialog-button');
  dialogButtonContainer.appendChild(dialogYesButton);
  dialogYesButton.addEventListener('click', dialogYesButtonClicked);

  dialogNoButton = createElement('a');
  dialogNoButton.id = 'dialog-no-button';
  dialogNoButton.classList.add('dialog-button');
  dialogButtonContainer.appendChild(dialogNoButton);
  dialogNoButton.addEventListener('click', dialogNoButtonClicked);

  // 
  // Apply settings from options (if any)
  // 

  if (options.icon) setIcon(options.icon);
  if (options.font) setFont(options.font);
  if (options.title) setTitle(options.title);
  if (options.colors) setColors(options.colors);
  if (options.menus) setMenus(options.menus);

  // 
  // Setup window resize event callback
  // 

  electronAPI.resized('resized', (e,  type) => {
    // console.log(`window resze event > ${type}`);

    if (type === 'entered-full-screen') {
      showElement(titleBarButtonsDiv, false); // Hide buttons on fullscreen

    } else if (type === 'exited-full-screen') {
      showElement(titleBarButtonsDiv); // Show buttons on un-fullscreen
    }

    if (resizeCallback) resizeCallback(type); // Execute callback
  });

},

/** Set code to execute when window resized
 * @param {function} callback
 */
setResizeCallback = (callback) => resizeCallback = callback,

/** Create and attach given menus to title bar, replacing any existing menus
 * @param {object} menus
 */
setMenus = (menus) => {
  let 
  maxMenuWidth = 0,
  currentMenuWidth = 0;

  // Create canvas so we can get a strings width using the current font
  const 
  canvas = createElement('canvas'),
  context = canvas.getContext('2d');
  context.font = getComputedStyle(getByID('title-bar')).font;

  // Create a new HTML <a> element with the given HTML text
  const newAnchor = (html) => {
    const a = createElement('a');
    // a.setAttribute('href', '#');
    a.innerHTML = html;
    return a;
  },

  // Create a new menu item using the given definition
  newMenuItem = (def) => {
    if (Object.keys(def).length === 0) return createElement('hr'); // Return a new HTML <hr> element if the menu item is a separator

    const menuItem = createElement('li'), // container
    label = newAnchor(def.label);
    menuItem.appendChild(label); // First child of any menu is it's title

    currentMenuWidth = context.measureText(def.label).width; // reset current menu width

    if (def.key != '') { // Check if menuItems code can be executed by pressing some key, or combination of keys

      newHotkey(def.key, def.comboKeys, def.click, true);

      // Now determine what combokeys are used..
      let span = createElement('span'),
      comboKeysText = '',
      comboKeys = def.comboKeys;

      // Generate combokeys text

        // Switch CTRL for META when Mac is detected. This code untested on any apple device, please send me one to test on ;)
        if (comboKeys & TYPE_CTRL) {
        if (isMac) {
          comboKeysText += 'Cmd+';
          comboKeys &= (TYPE_ALT + TYPE_SHIFT); // Exclude CTRL for Mac, as it uses META (command on Mac keyboard)
          comboKeys += TYPE_META;

        } else {
          comboKeysText += 'Ctrl+'; // Use CTRL key combo for Windows
        }
      }

      if (comboKeys & TYPE_SHIFT) comboKeysText += 'Shift+';
      if (comboKeys & TYPE_ALT) comboKeysText += 'Alt+';

      const spanText = `${comboKeysText}${def.key}`

      span.innerHTML = spanText;

      currentMenuWidth += context.measureText(spanText).width; // Add to current menu width

      label.appendChild(span);
    }

    // When menu item clicked, close menu and execute any click code
    menuItem.addEventListener('click', () => {
      showElement(menuItem.parentElement, false);
      if (def.click) def.click();
      activeMenu = null;
      autoExpandMenus = false;
    })

    return menuItem;
  };

  const menuContainer = getByID('title-bar-menu-container');

  menuContainer.innerHTML = ''; // Clear old menus

  // Remove old menu item hotkeys
  if (globalHotkeys.length > 0) {
    for (let i = globalHotkeys.length - 1; i >= 0; i--) {
      if (globalHotkeys[i].isMenu) globalHotkeys.splice(i, 1);
    }
  }

  // 
  // Create the menus
  // 

  for (let i = 0; i < menus.length; i++) {
    const menu = menus[i];

    maxMenuWidth = 0;

    let menuTitle = createElement('li'), 
    menuItems = createElement('ul'); // All sub items will be in here
    menuTitle.innerHTML = `<a>${menu.label}</a>`;
    menuTitle.appendChild(menuItems);

    // If auto expanding of menus is enabled, close any other open menu and expand this menu
    menuTitle.addEventListener('mouseenter', () => {
      if (autoExpandMenus) {
        showElement(activeMenu, false);
        showElement(menuItems);
        activeMenu = menuItems;
      }
    });

    // Toggle this menus visibility when menu title clicked
    menuTitle.addEventListener('click', (e) => {
      if (autoExpandMenus) {
        showElement(menuItems, false);
        activeMenu = null;
        autoExpandMenus = false;

      } else {
        showElement(menuItems);
        activeMenu = menuItems;
        autoExpandMenus = true;
      }
      e.stopImmediatePropagation();
    });

    // Create menu subitems
    for (let j = 0; j < menu.items.length; j++) {
      menuItems.appendChild(newMenuItem(menu.items[j])); // Add a new menu item

      if (currentMenuWidth > maxMenuWidth) maxMenuWidth = currentMenuWidth;
    }
    menuContainer.appendChild(menuTitle); // Append to menu container

    menuItems.style.width = `${maxMenuWidth + 80}px`; // +80 to include some whitespace and menu container horizontal padding

    // Stop expanded menu closing when empty space or separator is clicked
    menuItems.addEventListener('click', (e) => e.stopPropagation());
  }

},

/** Set colors to the given HTML color strings (excluding #)
 * @param {object} colors
 */
setColors = (colors) => {
  const roots = {
    title_background:'--title-bar-background-color', 
    title_label: '--title-bar-label-color', 
    highlight: '--title-bar-highlight-color', 
    menu_label: '--menu-label-color',
    item_highlight: '--menu-item-highlight-color', 
    item_label: '--menu-item-label-color',
    separator: '--menu-separator-color',
    close_highlight: '--close-window-button-highlight-color',
    notify_background: '--notify-background-color',
    notify_text: '--notify-text-color',
    dialog_background: '--dialog-background-color',
    dialog_yes: '--dialog-yes-button-color',
    dialog_no: '--dialog-no-button-color',
    dialog_text: '--dialog-text-color',
  };

  for (let key of Object.keys(colors)) {
    document.documentElement.style.setProperty(roots[key], `#${colors[key]}`); // Remap and set color style
  }
},

/** Set window title to the given title
 * @param {string} title
 */
setTitle = (title) => {
  getByID('title-bar-drag-bar').innerHTML = title;
  document.title = title;
},

/** Set font for all elements to the given font
 * @param {string} name
 */
setFont = (name) => {
  getByID('title-bar').style.fontFamily = name;
  notifyContainer.style.fontFamily = name;
  dialogContainer.style.fontFamily = name;
},

/** Set the windows title bar app icon to the given SVG image
 * @param {string} name
 */
setIcon = (name) => {

  let extension = 'png'; // Extension for Linux

  if (platform === 'darwin') {
    extension = 'icns'; // Icon file extension for Mac
  } else if (platform === 'win32') {
    extension = 'ico';  // Icon file extension for Windows
  }

  const baseName = name.substr(0, name.lastIndexOf('.')) || name, // Strip extension

  img = getByID('title-bar-icon');

  if (electronAPI.exists(`${baseName}.${extension}`)) {
    // Corresponding icon exists.. change both
    img.src = name;
    electronAPI.setWindowIcon(`${baseName}.${extension}`);

  } else {
    // Force default icons
    img.src = newFileName(electroDirectory, 'img', 'electro.svg');
    electronAPI.setWindowIcon(newFileName(electroDirectory, 'img', `electro.${extension}`));
  }
},

// 
// Dialogs and Notifications
// 

/** Show a popup notify notification using the given text and of the given type
 * @param {string} text default = TYPE_INFORMATION
 * @param {number} type
 */
notify = (text, type = TYPE_INFORMATION) => {
  if (notifyTimeoutID) clearTimeout(notifyTimeoutID); // Cancel any previous timout

  notifyBadge.src = newFileName(electroDirectory, 'img', `${typeToString(type)}.svg`);
  notifyText.innerHTML = text;

  notifyContainer.classList.add('active'); // Set the notify "active" which causes it to begin scrolling

  notifyTimeoutID = setTimeout(() => { notifyContainer.classList.remove('active') }, 1337); // Set notify to scroll back down after 2 seconds
},

/** Show a modal dialog using the given options
 * @param {object} options
 */
dialog = (options = {}) => {

  // Get the dialog type as a string
  const dialogType = (options.type) ? typeToString(options.type) : typeToString(TYPE_INFORMATION);

  // Setup badge
  dialogBadge.src = newFileName(electroDirectory, 'img', `${dialogType}.svg`);

  // Setup title and body
  (options.title) ? dialogTitle.innerHTML = options.title : dialogTitle.innerHTML = dialogType;
  (options.body) ? dialogBody.innerHTML = options.body : dialogBody.innerHTML = '';

  // Setup yes button
  (options.yesText) ? dialogYesButton.innerHTML = options.yesText : dialogYesButton.innerHTML = 'YES';
  (options.yesCallback) ? dialogYesCallback = options.yesCallback : dialogYesCallback = null;

  // Setup no button
  (options.noText) ? dialogNoButton.innerHTML = options.noText : dialogNoButton.innerHTML = 'NO';
  (options.noCallback) ? dialogNoCallback = options.noCallback : dialogNoCallback = null;

  (options.singleButton) ? showElement(dialogNoButton, false) : dialogNoButton.style.display = 'inline-block';

  dialogSingleButtonMode = options.singleButton; // Stop "escape" key closing a single button dialog (only "enter" will close them)
  
  // Override HTML link behaviors, causing all links inside the dialog's body to open in the default system browser, and not a new ElectronJS window instance
  let links = dialogBody.getElementsByTagName('a');
  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    link.addEventListener('click', (e) => {
      e.preventDefault();
      launchURL(link.href);
    });
  }

  dialogVignette.style.display = 'block';
  inDialog = true;
},

// Close the currently open dialog and execute the given callback
closeDialog = (callback) => {
  dialogVignette.style.display = 'none';
  if (callback) callback();
  dialogYesCallback = null;
  inDialog = false;
},

// Dialog "no" button was clicked
dialogNoButtonClicked = () => closeDialog(dialogNoCallback),

// Dialog "yes" button was clicked
dialogYesButtonClicked = () => closeDialog(dialogYesCallback),

// 
// Electron functions follow
// 

enableConfig = (state = true) => (electronAPI.enableConfig(state)),

quitApplication = () => (electronAPI.quitApplication()),

launchURL = (url) => (electronAPI.launchURL(url)),

// 
// Native Dialogs
// 

mergeOptions = (options, title) => (Object.assign({title: title, filter: ALL_FILES_FILTER, path: currentDir}, options)), // Merge given options with default options

showSingleFileDialog = (options = {}) => (electronAPI.showSingleFileDialog(mergeOptions(options, 'Open File'))),
showMultipleFileDialog = (options = {}) => (electronAPI.showMultipleFileDialog(mergeOptions(options, 'Open Files'))),
showSaveFileDialog = (options = {}) => (electronAPI.showSaveFileDialog(mergeOptions(options, 'Save File'))),

// 
// Native File System Access 
// 

exists = (path) => (electronAPI.exists(path)),
deleteFile = (path) => (electronAPI.deleteFile(path)),
createFolder = (path) => (electronAPI.createFolder(path)),
fileInfo = (path) => (electronAPI.fileInfo(path)),
currentDirectory = (path = null) => (electronAPI.currentDirectory(path)),
newFileName = (...parts) => (electronAPI.newFileName(...parts)),

loadTextFile = (path) => (electronAPI.loadTextFile(path)),
saveTextFile = (path, data) => electronAPI.saveTextFile(path, data),
saveBinaryFile = (path, data) => electronAPI.saveBinaryFile(path, data),

saveCanvas = (path, data) => electronAPI.saveCanvas(path, data);

export {
  TYPE_INFORMATION,
  TYPE_WARNING,
  TYPE_ERROR,

  TYPE_NONE,
  TYPE_CTRL,
  TYPE_ALT,
  TYPE_SHIFT,
  TYPE_META,

  isMac,
  platform,
  currentDir,

  initialize,
  quitApplication,
  enableConfig,
  launchURL,

  newHotkey,
  setResizeCallback,

  notify,
  dialog,

  setMenus,
  setTitle,
  setColors,
  setFont,
  setIcon,

  showSingleFileDialog,
  showMultipleFileDialog,
  showSaveFileDialog,

  exists,
  deleteFile,
  createFolder,
  fileInfo,
  currentDirectory,
  newFileName,

  loadTextFile,
  saveTextFile,
  saveBinaryFile,
  
  saveCanvas,
};
