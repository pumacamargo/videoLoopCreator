const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Enviar eventos
  send: (channel, data) => {
    ipcRenderer.send(channel, data);
  },

  // Recibir eventos
  on: (channel, callback) => {
    ipcRenderer.on(channel, (event, data) => callback(data));
  },

  // Operaciones comunes
  selectFiles: (type) => {
    return new Promise((resolve) => {
      const handler = (event, data) => {
        console.log('📂 selectFiles handler recibió:', data);
        if (!data.cancelled && data.files) {
          console.log('📂 selectFiles resolviendo con:', data.files);
          resolve(data.files);
        } else {
          console.log('📂 selectFiles cancelado o sin datos');
          resolve([]); // Retornar array vacío si se cancela
        }
        ipcRenderer.removeListener('files-selected', handler);
      };

      console.log('📂 Registrando listener para files-selected');
      ipcRenderer.on('files-selected', handler);

      console.log('📂 Enviando select-files para tipo:', type);
      ipcRenderer.send('select-files', type);
    });
  },

  selectOutputDirectory: () => {
    return new Promise((resolve) => {
      const handler = (event, data) => {
        console.log('📁 selectOutputDirectory handler recibió:', data);
        if (!data.cancelled && data.directory) {
          console.log('📁 Resolviendo con directorio:', data.directory);
          resolve(data.directory);
        } else {
          console.log('📁 Selección cancelada');
          resolve(null);
        }
        ipcRenderer.removeListener('output-directory-selected', handler);
      };

      console.log('📁 Registrando listener para output-directory-selected');
      ipcRenderer.on('output-directory-selected', handler);

      console.log('📁 Enviando select-output-directory');
      ipcRenderer.send('select-output-directory');
    });
  },

  // Copiar archivo a ubicación temporal y retornar la ruta real
  copyFileToTemp: async (fileData) => {
    console.log('📋 copyFileToTemp recibido:', fileData);
    return new Promise((resolve, reject) => {
      // Si es un string con ruta válida, enviar directamente
      if (typeof fileData === 'string') {
        console.log('📋 Es string, enviando path');
        ipcRenderer.send('copy-file-to-temp', {
          type: 'path',
          path: fileData
        });
      } else if (fileData && fileData.file) {
        // Si es un objeto File, leer como Blob y enviar
        console.log('📋 Es File object, leyendo como Blob');
        const reader = new FileReader();

        reader.onload = (e) => {
          console.log('📋 FileReader completó, enviando buffer');
          // Convertir ArrayBuffer a array de bytes para enviarlo por IPC
          const buffer = new Uint8Array(e.target.result);
          const bufferArray = Array.from(buffer);

          ipcRenderer.send('copy-file-to-temp', {
            type: 'buffer',
            name: fileData.name,
            buffer: bufferArray
          });
        };

        reader.onerror = (error) => {
          console.error('❌ FileReader error:', error);
          reject(error);
        };

        console.log('📋 Iniciando lectura del archivo');
        reader.readAsArrayBuffer(fileData.file);
      } else {
        reject(new Error('Tipo de datos inválido'));
      }

      const handler = (data) => {
        console.log('📋 file-copied handler recibido:', data);
        if (data.success) {
          resolve(data.tempPath);
        } else {
          reject(new Error(data.error));
        }
        ipcRenderer.removeListener('file-copied', handler);
      };

      ipcRenderer.on('file-copied', handler);
    });
  },

  // Validar si un archivo existe
  fileExists: (filePath) => {
    try {
      return fs.existsSync(filePath);
    } catch (e) {
      return false;
    }
  },

  createVideo: (config) => {
    ipcRenderer.send('create-video', config);
  },

  createPerfectLoops: (videoFiles) => {
    ipcRenderer.send('create-perfect-loops', videoFiles);
  },

  onProgress: (callback) => {
    ipcRenderer.on('progress', (event, data) => callback(data));
  },

  onVideoCreated: (callback) => {
    ipcRenderer.on('video-created', (event, data) => callback(data));
  },

  onLoopsCreated: (callback) => {
    ipcRenderer.on('loops-created', (event, data) => callback(data));
  },

  onError: (callback) => {
    ipcRenderer.on('error', (event, data) => callback(data));
  },

  initialize: () => {
    ipcRenderer.send('initialize');
  }
});
