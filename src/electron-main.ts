import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { exec } from 'child_process';

let mainWindow: BrowserWindow;

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
    }
  });

  // 🔹 Načítaj Angular frontend
  mainWindow.loadFile(path.join(__dirname, 'dist/dashboard/index.html'));

  // 🔹 Spusti backend (ak máš `server.exe`)
  exec(path.join(__dirname, 'server.exe'));
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
