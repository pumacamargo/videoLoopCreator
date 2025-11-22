const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs-extra');
const path = require('path');

class VideoLoopCreator {
  constructor() {
    // Automatically finds FFmpeg
    // On Windows systems, ensure FFmpeg is in your PATH
    this.ffmpeg = ffmpeg;
  }

  /**
   * Gets the duration of a media file
   * @param {string} filePath
   * @returns {Promise<number>} duration in seconds
   */
  getMediaDuration(filePath) {
    return new Promise((resolve, reject) => {
      this.ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata.format.duration || 0);
      });
    });
  }

  /**
   * Creates a concatenated playlist
   * @param {Array} items - array of file paths
   * @param {number} targetDuration - desired duration in seconds
   * @returns {Promise<Array>} array of repeated items
   */
  async createPlaylist(items, targetDuration) {
    console.log('📋 Calculating playlist...');

    let totalDuration = 0;
    const durations = [];

    // Calculate durations
    for (const item of items) {
      const duration = await this.getMediaDuration(item);
      durations.push(duration);
      totalDuration += duration;
    }

    console.log(`📊 Total file duration: ${totalDuration.toFixed(2)}s`);
    console.log(`🎯 Target duration: ${targetDuration}s`);

    // Create repeated playlist
    const playlist = [];
    let currentDuration = 0;
    let itemIndex = 0;

    while (currentDuration < targetDuration) {
      const item = items[itemIndex];
      const itemDuration = durations[itemIndex];

      playlist.push({ path: item, duration: itemDuration });
      currentDuration += itemDuration;

      itemIndex = (itemIndex + 1) % items.length;
    }

    console.log(`✓ Playlist created with ${playlist.length} items`);
    return playlist;
  }

  /**
   * Creates the final video
   * @param {Array} videos
   * @param {Array} audios
   * @param {number} targetDuration
   * @param {string} outputFile
   * @param {Function} onProgress - callback to report progress
   */
  async createVideo(videos, audios, targetDuration, outputFile, onProgress = null) {
    try {
      const logProgress = (message, percent = null) => {
        if (onProgress) {
          onProgress({ message, percent, step: 'processing' });
        }
      };

      // Create temporary folder
      const tempDir = path.join(process.cwd(), '.temp_video_loop');
      await fs.ensureDir(tempDir);

      // Create playlists
      logProgress('Creating video playlist...', 10);
      const videoPlaylist = await this.createPlaylist(videos, targetDuration);
      logProgress('Creating audio playlist...', 15);
      const audioPlaylist = await this.createPlaylist(audios, targetDuration);

      // Create concatenation file for videos
      logProgress('Processing videos...', 20);
      const videoFile = path.join(tempDir, 'concat_videos.txt');
      const videoContent = videoPlaylist
        .map(item => `file '${path.resolve(item.path).replace(/\\/g, '/')}'`)
        .join('\n');
      fs.writeFileSync(videoFile, videoContent);

      const concatVideosOutput = path.join(tempDir, 'concat_videos.mp4');

      await new Promise((resolve, reject) => {
        this.ffmpeg()
          .input(videoFile)
          .inputOption('-f', 'concat')
          .inputOption('-safe', '0')
          .outputOption('-c', 'copy')
          .output(concatVideosOutput)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      logProgress('Videos concatenated', 35);

      // Create concatenation file for audio
      logProgress('Processing audio...', 40);
      const audioFile = path.join(tempDir, 'concat_audios.txt');
      const audioContent = audioPlaylist
        .map(item => `file '${path.resolve(item.path).replace(/\\/g, '/')}'`)
        .join('\n');
      fs.writeFileSync(audioFile, audioContent);

      const concatAudiosOutput = path.join(tempDir, 'concat_audios.wav');

      await new Promise((resolve, reject) => {
        this.ffmpeg()
          .input(audioFile)
          .inputOption('-f', 'concat')
          .inputOption('-safe', '0')
          .outputOption('-c:a', 'pcm_s16le')
          .output(concatAudiosOutput)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      logProgress('Audio concatenated', 55);

      // Merge video and audio with specific duration
      logProgress('Merging video and audio...', 60);

      await new Promise((resolve, reject) => {
        this.ffmpeg()
          .input(concatVideosOutput)
          .input(concatAudiosOutput)
          .inputOption('-t', targetDuration.toString())
          .outputOption('-c:v', 'libx264')
          .outputOption('-c:a', 'aac')
          .outputOption('-shortest')
          .outputOption('-pix_fmt', 'yuv420p')
          .output(`${outputFile}.mp4`)
          .on('end', resolve)
          .on('error', reject)
          .on('progress', (progress) => {
            if (progress.percent) {
              const finalPercent = 60 + (progress.percent * 0.4);
              logProgress('Finalizing...', Math.min(99, finalPercent));
            }
          })
          .run();
      });

      logProgress('Video and audio merged', 90);

      // Clean temporary files
      logProgress('Cleaning temporary files...', 95);
      await fs.remove(tempDir);

      logProgress('Video created successfully!', 100);

    } catch (error) {
      // Clean up on error
      const tempDir = path.join(process.cwd(), '.temp_video_loop');
      await fs.remove(tempDir);
      throw error;
    }
  }
}

module.exports = { VideoLoopCreator };
