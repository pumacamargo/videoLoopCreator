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
   * Creates a perfect loop version of a video
   * Splits video in half, reverses the order with overlap, and applies crossfade
   * @param {string} inputPath - input video file path
   * @param {string} outputPath - output video file path (optional, will be generated from inputPath if not provided)
   * @param {number} overlapDuration - duration of overlap/crossfade in seconds (default 1.0)
   * @returns {Promise<string>} path to the created loop video
   */
  async createPerfectLoop(inputPath, outputPath = null, overlapDuration = 1.0) {
    // Si no se proporciona outputPath, generar uno con sufijo _loop
    if (!outputPath) {
      const dir = path.dirname(inputPath);
      const ext = path.extname(inputPath);
      const basename = path.basename(inputPath, ext);
      outputPath = path.join(dir, `${basename}_loop${ext}`);
    }
    const videoDuration = await this.getMediaDuration(inputPath);
    const midpoint = videoDuration / 2;

    // Segment 1: from 0 to midpoint (sin overlap adicional)
    const seg1Start = 0;
    const seg1End = midpoint;
    const seg1Duration = seg1End - seg1Start;

    // Segment 2: from midpoint to end (sin overlap adicional)
    const seg2Start = midpoint;
    const seg2End = videoDuration;
    const seg2Duration = seg2End - seg2Start;

    const tempDir = path.join(path.dirname(outputPath), `.temp_loop_${Date.now()}`);
    await fs.ensureDir(tempDir);

    try {
      const seg1Path = path.join(tempDir, 'segment1.mp4');
      const seg2Path = path.join(tempDir, 'segment2.mp4');

      // Extract segment 1
      await new Promise((resolve, reject) => {
        this.ffmpeg()
          .input(inputPath)
          .inputOption('-ss', seg1Start.toString())
          .inputOption('-t', seg1Duration.toString())
          .outputOption('-c', 'copy')
          .output(seg1Path)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      // Extract segment 2
      await new Promise((resolve, reject) => {
        this.ffmpeg()
          .input(inputPath)
          .inputOption('-ss', seg2Start.toString())
          .inputOption('-t', seg2Duration.toString())
          .outputOption('-c', 'copy')
          .output(seg2Path)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      // Merge segments with crossfade: segment2 + segment1
      // El crossfade debe ocurrir al final del seg2 (que es donde comienza seg1)
      // offset es donde empieza la transición dentro del primer video
      const offset = seg2Duration - overlapDuration;

      console.log(`📊 Seg2 duration: ${seg2Duration}s, Crossfade offset: ${offset}s, Overlap: ${overlapDuration}s`);

      await new Promise((resolve, reject) => {
        this.ffmpeg()
          .input(seg2Path)
          .input(seg1Path)
          .complexFilter(
            `[0:v]scale=1920:1080[v0];[1:v]scale=1920:1080[v1];[v0][v1]xfade=transition=fade:duration=${overlapDuration}:offset=${offset}[vout]`,
            'vout'
          )
          .outputOption('-c:v', 'libx264')
          .outputOption('-preset', 'fast')
          .outputOption('-pix_fmt', 'yuv420p')
          .output(outputPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

    } finally {
      // Clean up temporary directory
      await fs.remove(tempDir);
    }

    return outputPath;
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
