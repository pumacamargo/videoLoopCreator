const inquirer = require('inquirer');
const chalk = require('chalk');
const { VideoLoopCreator } = require('./videoLoopCreator');

async function main() {
  console.clear();
  console.log(chalk.cyan.bold('\n╔════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║   VIDEO LOOP CREATOR - v1.0.0          ║'));
  console.log(chalk.cyan.bold('╚════════════════════════════════════════╝\n'));

  try {
    const creator = new VideoLoopCreator();

    // Obtener videos
    console.log(chalk.yellow('📹 Selecciona los VIDEOS que deseas usar:'));
    const videos = await creator.selectFiles('videos');

    if (videos.length === 0) {
      console.log(chalk.red('\n❌ Debes seleccionar al menos un video.'));
      process.exit(1);
    }

    // Obtener audios
    console.log(chalk.yellow('\n🔊 Selecciona los AUDIOS que deseas usar:'));
    const audios = await creator.selectFiles('audios');

    if (audios.length === 0) {
      console.log(chalk.red('\n❌ Debes seleccionar al menos un audio.'));
      process.exit(1);
    }

    // Obtener duración deseada
    const { duration } = await inquirer.prompt([
      {
        type: 'input',
        name: 'duration',
        message: '⏱️  Duración del video final en segundos:',
        validate: (input) => {
          const num = parseFloat(input);
          if (isNaN(num) || num <= 0) {
            return 'Por favor ingresa un número positivo.';
          }
          return true;
        }
      }
    ]);

    const durationSeconds = parseFloat(duration);

    // Obtener nombre del archivo de salida
    const { outputFile } = await inquirer.prompt([
      {
        type: 'input',
        name: 'outputFile',
        message: '💾 Nombre del archivo de salida (sin extensión):',
        default: 'output_video'
      }
    ]);

    console.log(chalk.blue('\n⚙️  Procesando archivos...\n'));

    // Procesar
    await creator.createVideo(
      videos,
      audios,
      durationSeconds,
      outputFile
    );

    console.log(chalk.green.bold('\n✅ ¡Video creado exitosamente!'));
    console.log(chalk.green(`📁 Ubicación: ${outputFile}.mp4\n`));

  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error.message);
    process.exit(1);
  }
}

main();
