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
   * Concatenates videos with smooth crossfade transitions by processing iteratively
   * Uses xfade on pairs of videos to maintain all videos in sequence
   * @param {Array} playlist - array of video objects with path and duration
   * @param {number} fadeDuration - duration of fade transition in seconds
   * @param {string} outputPath - output video file path
   * @param {string} tempDir - temporary directory for intermediate files
   * @param {Function} onProgress - callback to report progress
   * @returns {Promise<void>}
   */
  async createVideoWithCrossfade(playlist, fadeDuration, outputPath, tempDir, onProgress = null) {
    const logProgress = (message, percent = null) => {
      if (onProgress) {
        onProgress({ message, percent, step: 'processing' });
      }
    };

    if (playlist.length === 0) {
      throw new Error('Playlist is empty');
    }

    if (playlist.length === 1) {
      // Single video - just copy it
      logProgress('Copying single video...', 22);
      await new Promise((resolve, reject) => {
        this.ffmpeg()
          .input(playlist[0].path)
          .outputOption('-c', 'copy')
          .output(outputPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });
      logProgress('Video processing complete', 44);
      return;
    }

    // Process videos iteratively: merge pairs with xfade until only one remains
    let currentVideos = [...playlist];
    let iteration = 0;
    const totalIterations = Math.ceil(Math.log2(playlist.length)); // Calculate total iterations needed

    logProgress(`Processing ${playlist.length} videos with crossfade transitions...`, 21);

    while (currentVideos.length > 1) {
      const nextVideos = [];
      const pairsInIteration = Math.ceil(currentVideos.length / 2);

      // Process pairs of videos
      for (let i = 0; i < currentVideos.length; i += 2) {
        if (i + 1 < currentVideos.length) {
          // We have a pair - merge them with xfade
          const video1 = currentVideos[i];
          const video2 = currentVideos[i + 1];
          const pairIndex = Math.floor(i / 2);
          const outputFile = path.join(tempDir, `merged_${iteration}_${pairIndex}.mp4`);

          const progressPercent = 22 + (iteration * 8 / totalIterations) + (pairIndex * 4 / (totalIterations * pairsInIteration));
          logProgress(`Merging videos (iteration ${iteration + 1}/${totalIterations}, pair ${pairIndex + 1}/${pairsInIteration})...`, Math.min(43, progressPercent));

          const offset = video1.duration - fadeDuration;

          await new Promise((resolve, reject) => {
            this.ffmpeg()
              .input(video1.path)
              .input(video2.path)
              .complexFilter(
                `[0:v]scale=1920:1080[v0];[1:v]scale=1920:1080[v1];[v0][v1]xfade=transition=fade:duration=${fadeDuration}:offset=${offset}[vout]`,
                'vout'
              )
              .outputOption('-c:v', 'libx264')
              .outputOption('-preset', 'fast')
              .outputOption('-pix_fmt', 'yuv420p')
              .output(outputFile)
              .on('end', resolve)
              .on('error', reject)
              .run();
          });

          // Add merged video to next iteration
          // Duration calculation: video1 full duration + video2 full duration - overlap (fade creates overlap)
          const mergedDuration = video1.duration + video2.duration - fadeDuration;

          nextVideos.push({
            path: outputFile,
            duration: mergedDuration
          });
        } else {
          // Odd one out - just add it to the next iteration
          nextVideos.push(currentVideos[i]);
        }
      }

      currentVideos = nextVideos;
      iteration++;
    }

    // The final merged video
    const finalVideo = currentVideos[0];

    // Copy the final result to output path
    logProgress('Finalizing crossfade video...', 44);
    await new Promise((resolve, reject) => {
      this.ffmpeg()
        .input(finalVideo.path)
        .outputOption('-c', 'copy')
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    logProgress('Crossfade processing complete', 44);
  }

  /**
   * Creates the final video with smooth crossfade transitions between loops
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

      // Fade transition duration in seconds
      const FADE_DURATION = 1;

      // Create temporary folder
      const tempDir = path.join(process.cwd(), '.temp_video_loop');
      await fs.ensureDir(tempDir);

      // Create playlists
      // Para videos con fades, necesitamos más duración porque cada fade quita tiempo
      // Si tenemos N videos, tenemos N-1 transiciones, cada una quita fadeDuration
      // Estimamos: targetDuration / numVideos * 1.2 para compensar
      logProgress('Creating video playlist...', 10);
      const videoPlaylist = await this.createPlaylist(videos, targetDuration * 1.5);
      logProgress('Creating audio playlist...', 15);
      const audioPlaylist = await this.createPlaylist(audios, targetDuration);

      // Create video with crossfade transitions
      logProgress('Creating video with crossfade transitions...', 20);
      const concatVideosOutput = path.join(tempDir, 'concat_videos_with_crossfade.mp4');
      await this.createVideoWithCrossfade(videoPlaylist, FADE_DURATION, concatVideosOutput, tempDir, onProgress);

      logProgress('Video with crossfades created', 45);

      // Create concatenation file for audio
      logProgress('Processing audio...', 55);
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

      logProgress('Audio concatenated', 65);

      // Merge video and audio with specific duration
      logProgress('Merging video and audio...', 70);

      await new Promise((resolve, reject) => {
        this.ffmpeg()
          .input(concatVideosOutput)
          .input(concatAudiosOutput)
          .inputOption('-t', targetDuration.toString())
          .outputOption('-c:v', 'copy')
          .outputOption('-c:a', 'aac')
          .outputOption('-shortest')
          .output(`${outputFile}.mp4`)
          .on('end', resolve)
          .on('error', reject)
          .on('progress', (progress) => {
            if (progress.percent) {
              const finalPercent = 70 + (progress.percent * 0.3);
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
