// Esperar a que el API esté disponible
window.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

// Variables globales
let videos = [];
let audios = [];
let outputDirectory = '';

// Inicializar la aplicación
function initializeApp() {
  window.api.initialize();

  setupEventListeners();
  setupDragAndDrop();
}

// Configurar eventos
function setupEventListeners() {
  // Botones de selección de archivos
  document.getElementById('btn-browse-videos').addEventListener('click', () => selectFiles('videos'));
  document.getElementById('btn-browse-audios').addEventListener('click', () => selectFiles('audios'));

  // Seleccionar directorio de salida
  document.getElementById('btn-select-dir').addEventListener('click', async () => {
    console.log('🗂️ Botón cambiar directorio clickeado');
    try {
      const dir = await window.api.selectOutputDirectory();
      console.log('🗂️ Directorio seleccionado:', dir);
      if (dir) {
        outputDirectory = dir;
        document.getElementById('output-dir').value = dir;
        console.log('✅ Output directory actualizado:', outputDirectory);
      } else {
        console.log('📁 No se seleccionó directorio');
      }
    } catch (error) {
      console.error('❌ Error seleccionando directorio:', error);
    }
  });

  // Crear video
  document.getElementById('btn-create').addEventListener('click', createVideo);

  // Crear otro video
  document.getElementById('btn-again').addEventListener('click', resetForm);

  // Listeners para progreso y errores
  window.api.onProgress((data) => updateProgress(data));
  window.api.onVideoCreated((data) => showResult(data));
  window.api.onError((data) => showError(data));
}

// Configurar drag and drop
function setupDragAndDrop() {
  console.log('✅ setupDragAndDrop iniciado - v2.0');
  const videoZone = document.getElementById('video-drop-zone');
  const audioZone = document.getElementById('audio-drop-zone');

  const setupZone = (zone, type) => {
    console.log(`📁 Configurando zona de ${type}`);

    zone.addEventListener('dragenter', (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.add('drag-over');
      console.log(`🎯 dragenter en ${type}`);
    });

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    zone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Solo remover clase si se sale completamente de la zona
      if (e.target === zone) {
        zone.classList.remove('drag-over');
        console.log(`👋 dragleave en ${type}`);
      }
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove('drag-over');

      console.log(`📥 drop detectado en ${type}`);

      let files = [];

      // Usar dataTransfer.files que funciona mejor en Electron
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        console.log('Usando dataTransfer.files');

        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          const file = e.dataTransfer.files[i];
          console.log(`File ${i}:`, {
            name: file.name,
            path: file.path,
            type: file.type,
            size: file.size,
            webkitRelativePath: file.webkitRelativePath
          });

          // En Electron, file.path contiene la ruta real del archivo
          if (file.path && file.path !== '' && !file.path.startsWith('/')) {
            files.push(file.path);
            console.log(`✅ Archivo agregado (path): ${file.path}`);
          }
          // Si no hay path válida, guardar como objeto File
          else {
            files.push({
              type: 'File',
              name: file.name,
              file: file
            });
            console.log(`✅ Archivo agregado (File object): ${file.name}`);
          }
        }
      }

      // Método alternativo: usar dataTransfer.items si files no funcionó
      if (files.length === 0 && e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        console.log('Usando dataTransfer.items (alternativo)');

        for (let i = 0; i < e.dataTransfer.items.length; i++) {
          const item = e.dataTransfer.items[i];

          if (item.kind === 'file') {
            const file = item.getAsFile();
            if (file) {
              console.log(`File from item ${i}:`, {
                name: file.name,
                type: file.type,
                size: file.size
              });

              files.push({
                type: 'File',
                name: file.name,
                file: file
              });
              console.log(`✅ Archivo agregado: ${file.name}`);
            }
          }
        }
      }

      console.log(`📥 Total archivos en drop: ${files.length}`, files);

      if (files.length > 0) {
        addFiles(type, files);
      } else {
        console.warn('⚠️ No se encontraron archivos en el drop');
      }
    });
  };

  setupZone(videoZone, 'videos');
  setupZone(audioZone, 'audios');
  console.log('✅ setupDragAndDrop completado');
}

// Seleccionar archivos
async function selectFiles(type) {
  console.log(`🎯 Seleccionando ${type}...`);
  try {
    const files = await window.api.selectFiles(type);
    console.log(`✅ Archivos seleccionados:`, files);
    if (files && files.length > 0) {
      addFiles(type, files);
    }
  } catch (error) {
    console.error(`❌ Error seleccionando ${type}:`, error);
    showErrorMessage(`Error al seleccionar ${type}: ${error.message}`);
  }
}

// Agregar archivos a la lista
function addFiles(type, newFiles) {
  console.log(`➕ addFiles llamado para ${type}:`, newFiles);
  console.log(`   Tipo de newFiles:`, typeof newFiles, Array.isArray(newFiles));

  const list = type === 'videos' ? videos : audios;
  const container = type === 'videos' ? 'video-list' : 'audio-list';
  const countElement = type === 'videos' ? 'video-count' : 'audio-count';

  // Asegurar que es un array
  const filesArray = Array.isArray(newFiles) ? newFiles : [newFiles];
  console.log(`   Array de archivos:`, filesArray);

  // Agregar archivos únicos
  filesArray.forEach((file, index) => {
    console.log(`   Procesando archivo ${index}:`, file, typeof file);

    if (!list.includes(file)) {
      console.log(`✅ Agregando ${type}: ${file}`);
      list.push(file);
      renderFileItem(file, type, container);
    } else {
      console.log(`⏭️  Ya existe ${type}: ${file}`);
    }
  });

  // Actualizar contador
  updateCount(countElement, list.length);
  console.log(`📊 Total ${type}: ${list.length}`);
}

// Renderizar item de archivo
function renderFileItem(fileData, type, container) {
  console.log(`🎨 renderFileItem para ${type}:`, fileData);

  let filePath, fileName;

  // Manejar tanto strings como objetos File
  if (typeof fileData === 'string') {
    filePath = fileData;
    fileName = filePath.split('\\').pop().split('/').pop();
  } else if (typeof fileData === 'object' && fileData.type === 'File') {
    filePath = fileData; // Guardar el objeto completo
    fileName = fileData.name;
  } else {
    console.error(`❌ Formato de archivo inválido:`, fileData);
    return;
  }

  if (!fileName || fileName === '') {
    console.error(`❌ Nombre de archivo inválido: ${fileName}`);
    return;
  }

  const list = document.getElementById(container);
  if (!list) {
    console.error(`❌ No se encontró contenedor: ${container}`);
    return;
  }

  const fileItem = document.createElement('div');
  fileItem.className = 'file-item';

  // Usar un ID único basado en índice
  const uniqueId = `file-${Date.now()}-${Math.random()}`;
  fileItem.id = uniqueId;

  console.log(`📄 Nombre del archivo: ${fileName}`);

  fileItem.innerHTML = `
    <span class="file-item-name" title="${fileName}">${fileName}</span>
    <button class="file-item-remove">✕</button>
  `;

  const removeBtn = fileItem.querySelector('.file-item-remove');
  removeBtn.addEventListener('click', () => {
    console.log(`🗑️  Removiendo: ${fileName}`);
    removeFile(filePath, type, container);
  });

  list.appendChild(fileItem);
  console.log(`✅ Elemento agregado al DOM para ${type}`);
}

// Eliminar archivo
function removeFile(fileData, type, container) {
  const list = type === 'videos' ? videos : audios;
  const countElement = type === 'videos' ? 'video-count' : 'audio-count';
  const containerElement = document.getElementById(container);

  let fileName;

  // Obtener el nombre del archivo según el tipo de dato
  if (typeof fileData === 'string') {
    fileName = fileData.split('\\').pop().split('/').pop();
  } else if (typeof fileData === 'object' && fileData.type === 'File') {
    fileName = fileData.name;
  } else {
    console.error('❌ Tipo de archivo inválido para remover');
    return;
  }

  // Buscar y remover de la lista
  const index = list.findIndex(item => {
    if (typeof item === 'string') {
      return item.split('\\').pop().split('/').pop() === fileName;
    } else if (typeof item === 'object' && item.type === 'File') {
      return item.name === fileName;
    }
    return false;
  });

  if (index > -1) {
    list.splice(index, 1);
    console.log(`✅ Removido de lista: ${fileName}`);
  }

  // Buscar y remover del DOM
  const items = containerElement.querySelectorAll('.file-item');
  items.forEach(item => {
    if (item.textContent.includes(fileName)) {
      item.remove();
      console.log(`✅ Removido del DOM: ${fileName}`);
    }
  });

  updateCount(countElement, list.length);
}

// Actualizar contador
function updateCount(elementId, count) {
  const element = document.getElementById(elementId);
  const text = count === 1 ? '1 archivo' : `${count} archivos`;
  element.textContent = text;
}

// Crear video
async function createVideo() {
  // Validar
  if (videos.length === 0) {
    showErrorMessage('You must select at least one video');
    return;
  }

  if (audios.length === 0) {
    showErrorMessage('You must select at least one audio');
    return;
  }

  // Obtener valores de tiempo
  const hours = parseInt(document.getElementById('duration-hours').value) || 0;
  const minutes = parseInt(document.getElementById('duration-minutes').value) || 0;
  const seconds = parseInt(document.getElementById('duration-seconds').value) || 0;

  // Calcular duración total en segundos
  let durationSeconds = hours * 3600 + minutes * 60 + seconds;

  if (durationSeconds <= 0) {
    showErrorMessage('Duration must be greater than 0');
    return;
  }

  const outputFile = document.getElementById('output-file').value || 'video_final';

  // Deshabilitar botón
  const btnCreate = document.getElementById('btn-create');
  btnCreate.disabled = true;

  // Mostrar progreso
  document.getElementById('progress-section').style.display = 'block';
  document.getElementById('result-section').style.display = 'none';

  // Procesar archivos (rutas directas del diálogo o arrastrados)
  const convertToPath = async (fileArray) => {
    const paths = [];

    for (const item of fileArray) {
      if (typeof item === 'string') {
        // Ruta directa del diálogo de Electron
        console.log('📁 Ruta de archivo:', item);
        paths.push(item);
      } else if (typeof item === 'object' && item.type === 'File' && item.file) {
        // Archivo arrastrado (File object del navegador)
        try {
          console.log('📋 Copiando archivo arrastrado:', item.name);
          const tempPath = await window.api.copyFileToTemp(item);
          console.log('✅ Archivo temporal creado:', tempPath);
          paths.push(tempPath);
        } catch (error) {
          console.error('❌ Error copiando archivo:', error);
          console.error('Stack:', error.stack);
          throw new Error(`Could not copy ${item.name}: ${error.message}`);
        }
      } else {
        console.warn('⚠️  Formato de item desconocido:', item);
      }
    }

    return paths;
  };

  // Crear video
  try {
    const videoPaths = await convertToPath(videos);
    const audioPaths = await convertToPath(audios);

    const config = {
      videos: videoPaths,
      audios: audioPaths,
      duration: durationSeconds,
      outputFile: outputDirectory ? `${outputDirectory}/${outputFile}` : outputFile
    };

    console.log('🎬 Enviando config:', config);
    window.api.createVideo(config);
  } catch (error) {
    console.error('❌ Error en conversión:', error);
    showErrorMessage('Error processing files: ' + error.message);
    btnCreate.disabled = false;
  }
}

// Actualizar progreso
function updateProgress(data) {
  const message = document.getElementById('progress-message');
  const bar = document.getElementById('progress-bar');
  const percent = document.getElementById('progress-percent');

  message.textContent = data.message || '';

  if (data.percent) {
    bar.style.width = `${Math.min(100, data.percent)}%`;
    percent.textContent = `${Math.round(data.percent)}%`;
  }
}

// Mostrar resultado
function showResult(data) {
  // Habilitar botón
  document.getElementById('btn-create').disabled = false;

  // Mostrar resultado
  document.getElementById('progress-section').style.display = 'none';
  document.getElementById('result-section').style.display = 'block';

  const resultContent = document.getElementById('result-content');
  resultContent.innerHTML = `
    <div class="result-success">✅</div>
    <h2 class="result-title">Video created successfully</h2>
    <p class="result-message">Your video is ready to download</p>
    <div class="result-file">${data.file}</div>
  `;
}

// Mostrar error
function showError(data) {
  document.getElementById('btn-create').disabled = false;
  document.getElementById('progress-section').style.display = 'none';

  const resultContent = document.getElementById('result-content');
  resultContent.innerHTML = `
    <div class="result-success" style="font-size: 3rem; color: #ef4444;">❌</div>
    <h2 class="result-title" style="color: #ef4444;">Error creating video</h2>
    <p class="result-message">${data.message || 'An unknown error occurred'}</p>
  `;

  document.getElementById('result-section').style.display = 'block';
}

// Mostrar mensaje de error
function showErrorMessage(message) {
  const resultContent = document.getElementById('result-content');
  resultContent.innerHTML = `
    <div class="error">
      <h3>⚠️ Error</h3>
      <p>${message}</p>
    </div>
  `;

  document.getElementById('progress-section').style.display = 'none';
  document.getElementById('result-section').style.display = 'block';
}

// Resetear formulario
function resetForm() {
  videos = [];
  audios = [];

  document.getElementById('video-list').innerHTML = '';
  document.getElementById('audio-list').innerHTML = '';
  document.getElementById('duration-hours').value = '0';
  document.getElementById('duration-minutes').value = '1';
  document.getElementById('duration-seconds').value = '0';
  document.getElementById('output-file').value = 'video_final';

  updateCount('video-count', 0);
  updateCount('audio-count', 0);

  document.getElementById('progress-section').style.display = 'none';
  document.getElementById('result-section').style.display = 'none';
}
