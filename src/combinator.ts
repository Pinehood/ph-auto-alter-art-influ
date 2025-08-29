import "dotenv/config";
import dotenv from "dotenv";
import * as fs from "node:fs";
import * as path from "node:path";
import { setTimeout as sleep } from "timers/promises";
import { CAPTION_SUFFIX, COMBO_MODE } from "./environment";
import { Logger } from "./logger";
import { AWS } from "./aws";
import { FFMPEG } from "./ffmpeg";
import { Instagram } from "./instagram";

dotenv.config();

const logger = new Logger();
const aws = new AWS();
const ffmpeg = new FFMPEG();
const instagram = new Instagram();

function listFiles(dir: string) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(dir, entry.name));
}

async function run() {
  try {
    const identity = await instagram.getIdentity();
    await sleep(500);

    const token = await instagram.getLongLivedToken();
    await sleep(500);

    logger.info(`Instagram identity verified: ${JSON.stringify(identity)}`);
    logger.info(`Long-lived token retrieved: ${token.access_token}`);

    const reels = listFiles(".reels").sort();
    if (reels.length < 2) {
      logger.warn("Not enough reels to combine");
      return;
    }

    const caption =
      `Random interesting facts compilation.\n\n${CAPTION_SUFFIX}`.trim();
    if (COMBO_MODE === "reel") {
      const vidPath = await ffmpeg.combineVideos(reels);
      const vidName = `combined/combined-${Date.now()}.mp4`;
      const vidUrl = await aws.uploadReelToS3FromFilePath(vidPath, vidName);
      await instagram.publishVideoReel(vidUrl, caption);
    } else if (COMBO_MODE === "carousel") {
      const reelsUrls = await Promise.all(
        reels.map((reel) => {
          return aws.getPresignedS3Url(
            `reels/${reel.substring(reel.lastIndexOf("/") + 1)}`
          );
        })
      );
      await instagram.publishCarouselPost(
        reelsUrls.map((url) => ({ type: "video", url })),
        caption
      );
    }
  } catch (err: any) {
    logger.error("ERROR", err?.response?.data || err?.message || err);
  }
}

(async function main() {
  logger.info(
    'Starting "Pinehood\'s Automatic Alternative Artificial Influencer (Photo + Reel)"'
  );
  await run();
})().catch((err) => {
  logger.error("Fatal", err);
  process.exit(1);
});
