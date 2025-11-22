const inquirer = require('inquirer');
const chalk = require('chalk');
const { VideoLoopCreator } = require('../videoLoopCreator');

async function main() {
  console.clear();
  console.log(chalk.cyan.bold('\n╔════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║   VIDEO LOOP CREATOR - v1.0.0          ║'));
  console.log(chalk.cyan.bold('║       Command Line Interface            ║'));
  console.log(chalk.cyan.bold('╚════════════════════════════════════════╝\n'));

  try {
    const creator = new VideoLoopCreator();

    // Get videos
    console.log(chalk.yellow('📹 Select the VIDEOS you want to use:'));
    const videos = await selectFiles('videos');

    if (videos.length === 0) {
      console.log(chalk.red('\n❌ You must select at least one video.'));
      process.exit(1);
    }

    // Get audio
    console.log(chalk.yellow('\n🔊 Select the AUDIO you want to use:'));
    const audios = await selectFiles('audio');

    if (audios.length === 0) {
      console.log(chalk.red('\n❌ You must select at least one audio file.'));
      process.exit(1);
    }

    // Get desired duration
    const { duration } = await inquirer.prompt([
      {
        type: 'input',
        name: 'duration',
        message: '⏱️  Duration of final video in seconds:',
        validate: (input) => {
          const num = parseFloat(input);
          if (isNaN(num) || num <= 0) {
            return 'Please enter a positive number.';
          }
          return true;
        }
      }
    ]);

    const durationSeconds = parseFloat(duration);

    // Get output filename
    const { outputFile } = await inquirer.prompt([
      {
        type: 'input',
        name: 'outputFile',
        message: '💾 Output filename (without extension):',
        default: 'output_video'
      }
    ]);

    console.log(chalk.blue('\n⚙️  Processing files...\n'));

    // Process with progress callback
    await creator.createVideo(
      videos,
      audios,
      durationSeconds,
      outputFile,
      (progress) => {
        console.log(chalk.blue(`📊 ${progress.message}`));
        if (progress.percent) {
          console.log(chalk.cyan(`   Progress: ${Math.round(progress.percent)}%`));
        }
      }
    );

    console.log(chalk.green.bold('\n✅ Video created successfully!'));
    console.log(chalk.green(`📁 Location: ${outputFile}.mp4\n`));

  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error.message);
    process.exit(1);
  }
}

/**
 * Allows manual file selection or folder scanning
 */
async function selectFiles(type) {
  const fs = require('fs-extra');
  const path = require('path');

  const isVideo = type === 'videos';
  const extensions = isVideo
    ? ['mp4', 'avi', 'mov', 'mkv', 'flv', 'wmv']
    : ['mp3', 'wav', 'aac', 'm4a', 'flac', 'ogg'];

  const { method } = await inquirer.prompt([
    {
      type: 'list',
      name: 'method',
      message: `How do you want to select ${type}?`,
      choices: [
        'Enter paths manually',
        'Search in a folder',
        'Both options'
      ]
    }
  ]);

  let files = [];

  if (method === 'Enter paths manually' || method === 'Both options') {
    console.log(chalk.gray(`\nEnter the ${type} paths (one per line, press empty Enter to finish):`));

    let moreFiles = true;
    while (moreFiles) {
      const { filePath } = await inquirer.prompt([
        {
          type: 'input',
          name: 'filePath',
          message: `Path of ${type.slice(0, -1)}:`,
          validate: (input) => {
            if (input === '') return true;
            if (!fs.existsSync(input)) {
              return `File does not exist: ${input}`;
            }
            return true;
          }
        }
      ]);

      if (filePath === '') {
        moreFiles = false;
      } else {
        files.push(filePath);
        console.log(chalk.green(`✓ ${filePath} added`));
      }
    }
  }

  if (method === 'Search in a folder' || method === 'Both options') {
    const { folderPath } = await inquirer.prompt([
      {
        type: 'input',
        name: 'folderPath',
        message: `Path to the folder containing ${type}:`,
        validate: (input) => {
          if (!fs.existsSync(input)) {
            return `Folder does not exist: ${input}`;
          }
          return true;
        }
      }
    ]);

    const folderFiles = fs.readdirSync(folderPath)
      .filter(file => {
        const ext = path.extname(file).slice(1).toLowerCase();
        return extensions.includes(ext);
      })
      .map(file => path.join(folderPath, file));

    if (folderFiles.length > 0) {
      console.log(chalk.green(`\nFound ${folderFiles.length} ${type}:`));
      folderFiles.forEach(f => console.log(chalk.gray(`  • ${path.basename(f)}`)));

      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Add these ${folderFiles.length} ${type}?`,
          default: true
        }
      ]);

      if (confirm) {
        files = [...files, ...folderFiles];
      }
    } else {
      console.log(chalk.yellow(`\nNo ${type} found in the folder.`));
    }
  }

  return files;
}

main();
