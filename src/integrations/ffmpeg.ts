import axios from "axios";
import ffmpegPath from "ffmpeg-static";
import ffprobePath from "ffprobe-static";
import ffmpeg from "fluent-ffmpeg";
import fs from "node:fs/promises";
import path from "node:path";
import { Logger } from "../utils/logger";
import { REEL_DURATION, REEL_MARGIN } from "../utils/environment";

ffmpeg.setFfmpegPath(ffmpegPath || "");
ffmpeg.setFfprobePath(ffprobePath.path || "");

export class FFMPEG {
  private readonly logger = new Logger();

  async makeReelFromImage(imageUrl: string, narrationMp3?: Buffer) {
    this.logger.info(`Making Reel from image...`);
    const workdir = path.join(process.cwd(), ".work");
    await fs.rm(workdir, { recursive: true, force: true }).catch(() => {});
    await fs.mkdir(workdir, { recursive: true });
    const imgPath = path.join(workdir, `img-${Date.now()}.jpg`);
    const mp3Path = path.join(workdir, `vox-${Date.now()}.mp3`);
    const outPath = path.join(workdir, `reel-${Date.now()}.mp4`);
    const resp = await axios.get(imageUrl, { responseType: "arraybuffer" });
    await fs.writeFile(imgPath, Buffer.from(resp.data));
    let haveAudio = false;
    if (narrationMp3 && narrationMp3.length > 0) {
      await fs.writeFile(mp3Path, narrationMp3);
      haveAudio = true;
    }
    const vfs = [
      `scale=${1080 - 2 * REEL_MARGIN}:${
        1920 - 2 * REEL_MARGIN
      }:force_original_aspect_ratio=decrease`,
      `pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black`,
      `zoompan=z='min(zoom+0.0015,1.12)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`,
      `format=yuv420p`,
    ];
    await new Promise<void>((resolve, reject) => {
      const cmd = ffmpeg()
        .input(imgPath)
        .loop(REEL_DURATION)
        .inputOptions([`-t ${REEL_DURATION}`])
        .videoFilters(vfs)
        .fps(30)
        .size("1080x1920")
        .videoCodec("libx264")
        .outputOptions([
          "-preset veryfast",
          "-profile:v high",
          "-pix_fmt yuv420p",
          "-movflags +faststart",
          "-b:v 5000k",
        ]);
      if (haveAudio) {
        cmd
          .input(mp3Path)
          .audioCodec("aac")
          .audioBitrate("128k")
          .audioFilters(["adelay=0|0"]);
      } else {
        cmd
          .input("anullsrc=r=48000:cl=stereo")
          .inputFormat("lavfi")
          .audioCodec("aac")
          .audioBitrate("64k")
          .audioFilters(["volume=0.02"]);
      }
      cmd
        .duration(REEL_DURATION)
        .output(outPath)
        .on("end", () => resolve())
        .on("error", (err: any) => reject(err))
        .run();
    });
    this.logger.info(`Reel video ready at: ${outPath}`);
    return outPath;
  }

  async combineVideos(paths: string[], outPath?: string) {
    if (!paths || paths.length < 2) {
      throw new Error("combineVideos: provide at least two input files.");
    }
    const workdir = path.join(process.cwd(), ".work");
    await fs.rm(workdir, { recursive: true, force: true }).catch(() => {});
    await fs.mkdir(workdir, { recursive: true });
    const output = outPath || path.join(workdir, `combined-${Date.now()}.mp4`);
    const probes = await Promise.all(
      paths.map(
        (p) =>
          new Promise<{
            path: string;
            vcodec?: string;
            acodec?: string;
            width?: number;
            height?: number;
            fps?: number;
            hasAudio: boolean;
          }>((resolve, reject) => {
            ffmpeg.ffprobe(p, (err, data) => {
              if (err) return reject(err);
              const vs = data.streams.find(
                (s: any) => s.codec_type === "video"
              );
              const as = data.streams.find(
                (s: any) => s.codec_type === "audio"
              );
              const r = (vs?.r_frame_rate || "0/0").split("/");
              const fps =
                r.length === 2 && Number(r[1]) !== 0
                  ? Number(r[0]) / Number(r[1])
                  : undefined;
              resolve({
                path: p,
                vcodec: vs?.codec_name,
                acodec: as?.codec_name,
                width: vs?.width,
                height: vs?.height,
                fps,
                hasAudio: !!as,
              });
            });
          })
      )
    );
    const first = probes[0];
    const allSameVideoCodec = probes.every((s) => s.vcodec === first.vcodec);
    const allSameAudioPresence = probes.every(
      (s) => s.hasAudio === first.hasAudio
    );
    const allSameAudioCodec =
      !first.hasAudio || probes.every((s) => s.acodec === first.acodec);
    const allSameSize = probes.every(
      (s) => s.width === first.width && s.height === first.height
    );
    const allSameFps = probes.every((s) =>
      s.fps && first.fps
        ? Math.abs(s.fps - first.fps) < 0.01
        : s.fps === first.fps
    );
    const canFastConcat =
      allSameVideoCodec &&
      allSameAudioPresence &&
      allSameAudioCodec &&
      allSameSize &&
      allSameFps;
    if (canFastConcat) {
      this.logger.info("FFmpeg: using fast concat (-f concat -c copy)...");
      const listPath = path.join(workdir, `concat-${Date.now()}.txt`);
      const listContent = paths
        .map((p) => `file '../${p.replace(/'/g, "'\\''")}'`)
        .join("\n");
      await fs.writeFile(listPath, listContent);
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(listPath)
          .inputOptions(["-f concat", "-safe 0"])
          .outputOptions(["-c copy", "-movflags +faststart"])
          .on("end", () => resolve())
          .on("error", (err) => reject(err))
          .save(output);
      });
      this.logger.info(`Combined video ready (fast path): ${output}`);
      return output;
    }
    this.logger.info(
      "FFmpeg: inputs differ; re-encoding with concat filter..."
    );
    const allHaveAudio = probes.every((p) => p.hasAudio);
    await new Promise<void>((resolve, reject) => {
      const cmd = ffmpeg();
      paths.forEach((p) => cmd.input(p));
      if (allHaveAudio) {
        const inputs = paths.map((_, i) => `[${i}:v:0][${i}:a:0]`).join("");
        const filter = `${inputs}concat=n=${paths.length}:v=1:a=1[outv][outa]`;
        cmd
          .complexFilter([filter])
          .map("[outv]")
          .map("[outa]")
          .videoCodec("libx264")
          .audioCodec("aac")
          .outputOptions([
            "-preset veryfast",
            "-profile:v high",
            "-pix_fmt yuv420p",
            "-movflags +faststart",
            "-b:v 5000k",
          ])
          .on("end", () => resolve())
          .on("error", (err) => reject(err))
          .save(output);
      } else {
        const inputs = paths.map((_, i) => `[${i}:v:0]`).join("");
        const filter = `${inputs}concat=n=${paths.length}:v=1:a=0[outv]`;
        cmd
          .complexFilter([filter])
          .map("[outv]")
          .input("anullsrc=r=48000:cl=stereo")
          .inputFormat("lavfi")
          .audioCodec("aac")
          .audioBitrate("64k")
          .audioFilters(["volume=0.02"])
          .outputOptions([
            "-preset veryfast",
            "-profile:v high",
            "-pix_fmt yuv420p",
            "-movflags +faststart",
            "-b:v 5000k",
          ])
          .map(`${paths.length}:a:0`)
          .videoCodec("libx264")
          .on("end", () => resolve())
          .on("error", (err) => reject(err))
          .save(output);
      }
    });
    this.logger.info(`Combined video ready (re-encode): ${output}`);
    return output;
  }
}
