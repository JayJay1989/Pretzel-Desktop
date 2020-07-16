const path = require('path');
const electron = require('electron');
const jsonfile = require('jsonfile');
const mkdirp = require('mkdirp');
const deepEqual = require('deep-equal');

module.exports = function (options) {
  const app = electron.app || electron.remote.app;
  const screen = electron.screen || electron.remote.screen;
  let state;
  let winRef;
  let stateChangeTimer;
  const eventHandlingDelay = 100;

  const config = Object.assign({
    file: 'window-state.json',
    path: app.getPath('userData'),
  }, options);

  const fullStoreFileName = path.join(config.path, config.file);

  function isNormal(win) {
    return !win.isMaximized() && !win.isMinimized() && !win.isFullScreen();
  }

  function hasBounds() {
    return state &&
      Number.isInteger(state.x) &&
      Number.isInteger(state.y);
  }

  function validateState() {
    const isValid = state && (hasBounds() || state.isMaximized || state.isFullScreen);
    if (!isValid) {
      state = null;
      return;
    }

    if (hasBounds() && state.displayBounds) {
      // Check if the display where the window was last open is still available
      try {
        const displayBounds = screen.getDisplayMatching(state).bounds;
        const sameBounds = deepEqual(state.displayBounds, displayBounds, {strict: true});
        if (!sameBounds) {
          if (displayBounds.width < state.displayBounds.width) {
            if (state.x > displayBounds.width) {
              state.x = 0;
            }
          }

          if (displayBounds.height < state.displayBounds.height) {
            if (state.y > displayBounds.height) {
              state.y = 0;
            }
          }
        }
      } catch (e) {
        console.log('Window state parsing failed', state, e);
        state.x = undefined;
        state.y = undefined;
      }
    }
  }

  function setWindowBounds(pWin) {
    const win = pWin || winRef;
    if (!win) {
      return;
    }
    try {
      var winBounds = win.getBounds();
      if (isNormal(win)) {
        state.width = winBounds.width;
        state.height = winBounds.height;
      }
    } catch (err) {}
  }

  function updateState(pWin) {
    const win = pWin || winRef;
    if (!win) {
      return;
    }
    try {
      var winBounds = win.getBounds();
      if (isNormal(win)) {
        state.x = winBounds.x;
        state.y = winBounds.y;
      }
      state.displayBounds = screen.getDisplayMatching(winBounds).bounds;
    } catch (err) {}
  }

  function saveState() {
    try {
      mkdirp.sync(path.dirname(fullStoreFileName));
      jsonfile.writeFileSync(fullStoreFileName, state);
    } catch (err) {
      console.log(err);
    }
  }

  function stateChangeHandler() {
    clearTimeout(stateChangeTimer);
    stateChangeTimer = setTimeout(updateState, eventHandlingDelay);
  }

  function closeHandler() {
    clearTimeout(stateChangeTimer);
    updateState();
  }

  function closedHandler() {
    // Unregister listeners and save state
    unmanage();
    saveState();
  }

  function manage(win) {
    win.on('move', stateChangeHandler);
    win.on('close', closeHandler);
    win.on('closed', closedHandler);
    winRef = win;
  }

  function unmanage() {
    if (winRef) {
      clearTimeout(stateChangeTimer);
      winRef.removeListener('move', stateChangeHandler);
      winRef.removeListener('close', closeHandler);
      winRef.removeListener('closed', closedHandler);
      winRef = null;
    }
  }

  // Load previous state
  try {
    state = jsonfile.readFileSync(fullStoreFileName);
  } catch (err) {
    // Don't care
  }

  // Check state validity
  validateState();

  // Set state fallback values
  state = Object.assign({
    x: undefined,
    y: undefined,
  }, state);

  return {
    get x() { return state.x; },
    get y() { return state.y; },
    get width() { return state.width; },
    get height() { return state.height; },
    saveState,
    unmanage,
    manage,
    setWindowBounds
  };
};
