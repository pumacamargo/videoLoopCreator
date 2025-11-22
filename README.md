# Video Loop Creator 🎬

A modern application to concatenate multiple videos and audio into a video of specified duration.
Available with both graphical interface (GUI) and command-line interface (CLI).

## Features

✨ **Main features:**
- ✅ Modern graphical interface with drag & drop
- ✅ Command-line interface for advanced users
- ✅ Select multiple videos and audio files
- ✅ Specify desired video duration
- ✅ Automatically concatenate files in a loop
- ✅ Synchronize videos and audio
- ✅ Real-time progress indicator
- ✅ Cross-platform support (Windows, macOS, Linux)

## Requirements

- **Node.js** (v12 or higher)
- **FFmpeg** (installed and in system PATH)

### Install FFmpeg

**Windows (with Chocolatey):**
```bash
choco install ffmpeg
```

**Windows (manual download):**
1. Download from https://ffmpeg.org/download.html
2. Extract the file
3. Add the `bin` folder to environment variables

**macOS (with Homebrew):**
```bash
brew install ffmpeg
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install ffmpeg
```

## Installation

1. Clone or download the project
2. Navigate to the project directory:
```bash
cd videoLoopCreator
```

3. Install dependencies:
```bash
npm install
```

## Usage

### Graphical Interface (GUI) - Recommended

Run the graphical application with:
```bash
npm start
```

**Features:**
- 🖱️ Drag and drop files directly
- 🎨 Modern and responsive interface
- 📊 Visual progress indicator
- 🎯 Output folder selection

### Command-Line Interface (CLI)

Run the CLI version with:
```bash
npm run cli
```

**Advantages:**
- ⚡ Faster for advanced users
- 🔧 Easy to integrate into scripts
- 📝 Visible history of all operations

### Application Flow

**GUI:**
1. Drag videos to the videos area (or click to select)
2. Drag audio to the audio area
3. Specify the duration
4. Choose the output folder (optional)
5. Click "Create Video"

**CLI:**
1. Run `npm run cli`
2. Select how you want to import videos
3. Select how you want to import audio
4. Specify the duration in seconds
5. Name the output file

## Supported Formats

**Videos:** MP4, AVI, MOV, MKV, FLV, WMV
**Audio:** MP3, WAV, AAC, M4A, FLAC, OGG

## Technical Features

- **Automatic Concatenation**: Videos and audio are looped until the specified duration is reached
- **Synchronization**: Video and audio are synchronized correctly
- **Efficiency**: Uses stream copying when possible for fast encoding
- **Auto Cleanup**: Removes temporary files after completion
- **Error Handling**: Validates input and provides clear error messages

## Troubleshooting

### "ffmpeg not found"
- Make sure FFmpeg is installed and in your PATH
- Verify with: `ffmpeg -version`

### "File does not exist"
- Verify that the paths are correct (use absolute paths if possible)
- On Windows, use backslashes `\` or forward slashes `/`

### Video duration is not exact
- The final duration will be as close as possible to the specified one
- If the last files don't fit exactly, they will be cut off

## Project Structure

```
videoLoopCreator/
├── src/
│   ├── electron/          # Electron main process
│   ├── ui/               # User interface
│   ├── cli/              # Command-line interface
│   └── videoLoopCreator.js   # Core logic
├── package.json          # Dependencies
├── README.md             # This file
└── .gitignore           # Ignored files
```

## Dependencies

- **fluent-ffmpeg**: FFmpeg wrapper
- **chalk**: Console colors
- **fs-extra**: File system utilities
- **electron**: GUI framework

## License

MIT

## Author

Created with ❤️ to make looping video creation easy

---

**Need help?** Check the examples or create an issue on GitHub.
