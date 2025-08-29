import "dotenv/config";
import dotenv from "dotenv";
import cron from "node-cron";
import { setTimeout as sleep } from "timers/promises";
import { Logger, CAPTION_SUFFIX, CREATE_MEDIA, CRON_EXPR, TZ } from "./utils";
import { AWS, FFMPEG, Instagram, OpenAi } from "./integrations";

dotenv.config();

const logger = new Logger();
const openai = new OpenAi();
const aws = new AWS();
const ffmpeg = new FFMPEG();
const instagram = new Instagram();

async function run() {
  try {
    const identity = await instagram.getIdentity();
    await sleep(500);

    const token = await instagram.getLongLivedToken();
    await sleep(500);

    logger.info(`Instagram identity verified: ${JSON.stringify(identity)}`);
    logger.info(`Long-lived token retrieved: ${token.access_token}`);

    const niche = openai.pickNiche();
    const text = await openai.generateFact(niche);
    await sleep(500);

    const img = (await openai.generatePosterWithText(text, niche)) ?? "";
    await sleep(500);

    const imgPath = `posters/${niche.replace(/ /g, "_")}_${Date.now()}.png`;
    const imgUrl = await aws.uploadImageFromOpenAiToS3(img, imgPath);
    await sleep(500);

    const tts = await openai.synthesizeVoiceover(text);
    await sleep(500);

    const vidPath = await ffmpeg.makeReelFromImage(imgUrl, tts);
    const vidName = `reels/reel-${Date.now()}.mp4`;
    const vidUrl = await aws.uploadReelToS3FromFilePath(vidPath, vidName);
    await sleep(500);

    const caption = `${text}\n\n${CAPTION_SUFFIX}`.trim();
    if (CREATE_MEDIA.includes("post")) {
      await instagram.publishPhotoPost(imgUrl, caption);
      await sleep(500);
    }

    if (CREATE_MEDIA.includes("reel")) {
      await instagram.publishVideoReel(vidUrl, caption);
      await sleep(500);
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
  cron.schedule(CRON_EXPR, async () => await run(), { timezone: TZ });
  logger.info(`Cron scheduled: "${CRON_EXPR}" (${TZ}).`);
})().catch((err) => {
  logger.error("Fatal", err);
  process.exit(1);
});
