import axios from "axios";
import ffmpegPath from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";
import fs from "node:fs/promises";
import path from "node:path";
import { Logger } from "./logger";
import { REEL_DURATION, REEL_MARGIN } from "./environment";

ffmpeg.setFfmpegPath(ffmpegPath || "");

export class FFMPEG {
  private readonly logger = new Logger();

  async makeReelFromImage(imageUrl: string, narrationMp3?: Buffer) {
    this.logger.info(`Making Reel from image...`);
    const workdir = path.join(process.cwd(), ".work");
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
}
