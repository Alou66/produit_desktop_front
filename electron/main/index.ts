import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'

import { registerProductsIpc } from './ipc/products.ipc'
import { shutdownPowerSync } from './powersync'
import { registerPowerSyncIpc } from './powersync/ipc'

// On this machine's hybrid Intel/NVIDIA GPU setup, Chromium's Viz compositor
// fails to produce frames regardless of which GPU it's bound to (verified via
// webContents.capturePage() throwing "UnknownVizError" both with the default
// GPU selection and with an explicit Intel render-node override): the window
// loads and its DOM renders correctly, but nothing ever gets painted to
// screen, leaving a blank white window. Falling back to Chromium's software
// compositor sidesteps the broken GPU path entirely and reliably paints.
if (process.platform === 'linux') {
  app.disableHardwareAcceleration()
}

// Electron's native Wayland Ozone backend segfaults on window creation with
// this Chromium build under some compositors (reproduced deterministically
// via gdb: SIGSEGV at a fixed offset inside the main process on every
// BrowserWindow creation when the process starts under a Wayland session).
// Ozone platform selection happens at native process startup, before any of
// this file runs, so app.commandLine.appendSwitch() here is always too late
// to change it. In dev/preview, package.json already passes
// `-- --ozone-platform=x11` to electron-vite so this never triggers there
// (triggering it there would make our own process exit to relaunch, and
// electron-vite kills its whole dev server the moment the electron process
// it spawned closes). For a packaged production build (no electron-vite
// supervising this process), relaunching with the switch actually present on
// argv is the only way to force it.
const needsOzoneRelaunch =
  process.platform === 'linux' && app.commandLine.getSwitchValue('ozone-platform') !== 'x11'

if (needsOzoneRelaunch) {
  app.relaunch({
    args: process.argv.slice(1).filter((arg) => !arg.startsWith('--ozone-platform')).concat(['--ozone-platform=x11'])
  })
  app.exit(0)
} else {
  function createMainWindow(): void {
    const mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false,
      autoHideMenuBar: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })

    mainWindow.once('ready-to-show', () => {
      mainWindow.show()
    })

    if (process.env.ELECTRON_RENDERER_URL) {
      mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    } else {
      mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
  }

  app.whenReady().then(() => {
    registerPowerSyncIpc()
    registerProductsIpc()
    createMainWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow()
      }
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('before-quit', () => {
    void shutdownPowerSync()
  })
}
