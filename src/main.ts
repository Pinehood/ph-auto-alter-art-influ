import "dotenv/config";
import dotenv from "dotenv";
import cron from "node-cron";
import { CAPTION_SUFFIX, CREATE_MEDIA, CRON_EXPR, TZ } from "./environment";
import { OpenAi } from "./openai";
import { AWS } from "./aws";
import { FFMPEG } from "./ffmpeg";
import { Instagram } from "./instagram";

dotenv.config();

const openai = new OpenAi();
const aws = new AWS();
const ffmpeg = new FFMPEG();
const instagram = new Instagram();

async function runOnce() {
  try {
    const longLived = await instagram.getLongLivedToken();
    console.log(`Long-lived token: ${longLived.access_token}`);

    const niche = openai.pickNiche();
    console.log(`[OpenAI] Niche: ${niche}`);

    console.log(`[OpenAI] Generating fact...`);
    const { text } = await openai.generateFact(niche);
    console.log(`[OpenAI] Generated fact: ${text}`);

    console.log(`[OpenAI] Generating image poster...`);
    const img = (await openai.generatePosterWithText(text, niche)) ?? "";
    console.log(`[OpenAI] Image poster generated`);

    console.log(`[OpenAI] Synthesizing TTS...`);
    let tts: Buffer | undefined;
    try {
      tts = await openai.synthesizeVoiceover(text);
      console.log(`[OpenAI] TTS bytes: ${tts.length}`);
    } catch (e) {
      console.warn(
        `[OpenAI] TTS failed, will generate reel with low-volume tone.`,
        e
      );
    }

    console.log(`[S3] Generating image url...`);
    const imgPath = `posters/${niche.replace(/ /g, "_")}_${Date.now()}.png`;
    const imgUrl = await aws.uploadImageFromOpenAiToS3(
      img,
      imgPath,
      "image/png"
    );
    console.log(`[S3] Image URL: ${imgUrl}`);

    console.log(`[FFMPEG] Making Reel video...`);
    const vidPath = await ffmpeg.makeReelFromImage(imgUrl, tts);
    console.log(`[FFMPEG] Reel video ready at ${vidPath}`);

    console.log(`[S3] Uploading Reel to S3 and presigning...`);
    const vidName = `reels/reel-${Date.now()}.mp4`;
    const vidUrl = await aws.uploadToS3AndPresign(
      vidPath,
      vidName,
      "video/mp4"
    );
    console.log(`[S3] Presigned video URL: ${vidUrl}`);

    const caption = `${text}\n\n${CAPTION_SUFFIX}`.trim();
    if (CREATE_MEDIA.includes("post")) {
      console.log(`[Instagram] Publishing Photo Post...`);
      const post = await instagram.publishPhotoPost(imgUrl, caption);
      console.log(`[Instagram] Photo published: ${post.id}`);
    }

    if (CREATE_MEDIA.includes("reel")) {
      console.log(`[Instagram] Publishing Reel...`);
      const reel = await instagram.publishVideoReel(vidUrl, caption);
      console.log(`[Instagram] Reel published: ${reel.id}`);
    }
  } catch (err: any) {
    console.error("ERROR:", err?.response?.data || err?.message || err);
  }
}

(async function main() {
  console.log(
    "[Main] Pinehood's Automatic Alternative Artificial Influencer (Photo + Reel) starting..."
  );
  await runOnce();
  cron.schedule(CRON_EXPR, async () => await runOnce(), { timezone: TZ });
  console.log(
    `[Main] Cron scheduled: "${CRON_EXPR}" (${TZ}) - runs every hour.`
  );
})().catch((err) => {
  console.error("[Main] Fatal:", err);
  process.exit(1);
});
