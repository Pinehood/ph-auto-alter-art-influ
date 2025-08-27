import "dotenv/config";
import dotenv from "dotenv";
import cron from "node-cron";
import { CAPTION_SUFFIX, CREATE_MEDIA, CRON_EXPR, TZ } from "./environment";
import { Logger } from "./logger";
import { OpenAi } from "./openai";
import { AWS } from "./aws";
import { FFMPEG } from "./ffmpeg";
import { Instagram } from "./instagram";

dotenv.config();

const logger = new Logger();
const openai = new OpenAi();
const aws = new AWS();
const ffmpeg = new FFMPEG();
const instagram = new Instagram();

async function runOnce() {
  try {
    const longLived = await instagram.getLongLivedToken();
    logger.info(`Long-lived token retrieved: ${longLived}`);

    const niche = openai.pickNiche();
    const text = await openai.generateFact(niche);
    const img = (await openai.generatePosterWithText(text, niche)) ?? "";

    let tts: Buffer | undefined;
    try {
      tts = await openai.synthesizeVoiceover(text);
    } catch (e) {
      logger.error(
        `[OpenAI] TTS failed, will generate reel with low-volume tone, error: ${e}`
      );
    }

    const imgPath = `posters/${niche.replace(/ /g, "_")}_${Date.now()}.png`;
    const imgUrl = await aws.uploadImageFromOpenAiToS3(img, imgPath);

    const vidPath = await ffmpeg.makeReelFromImage(imgUrl, tts);
    const vidName = `reels/reel-${Date.now()}.mp4`;
    const vidUrl = await aws.uploadToS3AndPresign(
      vidPath,
      vidName,
      "video/mp4"
    );

    const caption = `${text}\n\n${CAPTION_SUFFIX}`.trim();
    if (CREATE_MEDIA.includes("post")) {
      const post = await instagram.publishPhotoPost(imgUrl, caption);
    }

    if (CREATE_MEDIA.includes("reel")) {
      const reel = await instagram.publishVideoReel(vidUrl, caption);
    }
  } catch (err: any) {
    logger.error("ERROR", err?.response?.data || err?.message || err);
  }
}

(async function main() {
  logger.info(
    "Pinehood's Automatic Alternative Artificial Influencer (Photo + Reel) starting..."
  );
  await runOnce();
  cron.schedule(CRON_EXPR, async () => await runOnce(), { timezone: TZ });
  logger.info(`Cron scheduled: "${CRON_EXPR}" (${TZ}) - runs every hour.`);
})().catch((err) => {
  logger.error("Fatal", err);
  process.exit(1);
});
