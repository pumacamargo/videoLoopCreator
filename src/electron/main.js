const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { VideoLoopCreator } = require('../videoLoopCreator');

let mainWindow;
let videoCreator;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false
    }
  });

  const startUrl = path.join(__dirname, '../ui/index.html');
  mainWindow.loadFile(startUrl);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Handlers IPC para la comunicación entre frontend y backend
ipcMain.on('initialize', (event) => {
  videoCreator = new VideoLoopCreator();
  event.reply('initialized', true);
});

ipcMain.on('select-files', async (event, type) => {
  try {
    console.log(`📂 select-files recibido para tipo: ${type}`);

    const filter = type === 'videos'
      ? [
          { name: 'Videos', extensions: ['mp4', 'avi', 'mov', 'mkv', 'flv', 'wmv'] },
          { name: 'Todos', extensions: ['*'] }
        ]
      : [
          { name: 'Audios', extensions: ['mp3', 'wav', 'aac', 'm4a', 'flac', 'ogg'] },
          { name: 'Todos', extensions: ['*'] }
        ];

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: filter
    });

    console.log(`📂 Dialog result:`, result);

    event.reply('files-selected', {
      type,
      files: result.filePaths,
      cancelled: result.canceled
    });

    console.log(`📂 Responded with ${result.filePaths.length} files`);
  } catch (error) {
    console.error('❌ Error in select-files:', error);
    event.reply('error', error.message);
  }
});

ipcMain.on('create-video', async (event, config) => {
  try {
    const path = require('path');

    // Enviar progreso inicial
    event.reply('progress', {
      step: 'starting',
      message: 'Iniciando proceso de creación de video...',
      percent: 0
    });

    // Usar ruta completa o carpeta actual por defecto
    let outputPath = config.outputFile;
    console.log('🎬 outputFile recibido:', config.outputFile);
    console.log('🎬 ¿Es ruta absoluta?:', path.isAbsolute(outputPath));

    if (!path.isAbsolute(outputPath)) {
      // Si es una ruta relativa, guardar en el escritorio del usuario
      const desktopPath = require('electron').app.getPath('desktop');
      outputPath = path.join(desktopPath, config.outputFile);
      console.log('🎬 Usando ruta relativa, guardando en escritorio:', outputPath);
    } else {
      console.log('🎬 Usando ruta absoluta:', outputPath);
    }

    // Ejecutar creación de video
    await videoCreator.createVideo(
      config.videos,
      config.audios,
      config.duration,
      outputPath,
      (progress) => {
        event.reply('progress', progress);
      }
    );

    event.reply('video-created', {
      success: true,
      file: `${outputPath}.mp4`
    });
  } catch (error) {
    event.reply('error', {
      step: 'creation',
      message: error.message
    });
  }
});

ipcMain.on('select-output-directory', async (event) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });

    event.reply('output-directory-selected', {
      directory: result.filePaths[0],
      cancelled: result.canceled
    });
  } catch (error) {
    event.reply('error', error.message);
  }
});

ipcMain.on('copy-file-to-temp', async (event, fileData) => {
  try {
    const fs = require('fs-extra');
    const os = require('os');

    // Crear directorio temporal
    const tempDir = path.join(os.tmpdir(), 'video-loop-creator');
    await fs.ensureDir(tempDir);

    let tempPath;

    if (fileData.type === 'path') {
      // Si es una ruta de archivo del sistema
      const fileName = path.basename(fileData.path);
      tempPath = path.join(tempDir, fileName);
      await fs.copy(fileData.path, tempPath);
    } else if (fileData.type === 'buffer') {
      // Si es un array de bytes del navegador
      const fileName = fileData.name;
      tempPath = path.join(tempDir, fileName);
      // fileData.buffer es un array de números, convertir a Buffer
      const buffer = Buffer.from(fileData.buffer);
      console.log(`✅ Escribiendo archivo desde buffer: ${fileName} (${buffer.length} bytes)`);
      await fs.writeFile(tempPath, buffer);
    } else {
      throw new Error('Tipo de archivo inválido');
    }

    console.log('✅ Archivo copiado a:', tempPath);
    event.reply('file-copied', {
      success: true,
      tempPath: tempPath
    });
  } catch (error) {
    console.error('❌ Error copiando archivo:', error);
    event.reply('file-copied', {
      success: false,
      error: error.message
    });
  }
});
