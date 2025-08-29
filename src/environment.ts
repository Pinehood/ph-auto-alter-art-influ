const TZ = process.env.TZ || "Europe/Zagreb";
const CRON_EXPR = process.env.CRON_EXPR || "0 */6 * * *";
const NICHES_CSV = process.env.NICHES || "random interesting facts";
const CAPTION_SUFFIX = process.env.CAPTION_SUFFIX || "";
const REEL_DURATION = parseInt(process.env.REEL_DURATION || "12", 10);
const REEL_MARGIN = parseInt(process.env.REEL_MARGIN || "24", 10);
const CREATE_MEDIA = (process.env.CREATE_MEDIA?.split(",") || [
  "post",
  "reel",
]) as ("post" | "reel")[];

const COMBO_MODE = (process.env.COMBO_MODE || "carousel") as
  | "carousel"
  | "reel";

const AWS_REGION = process.env.S3_REGION || "eu-central-1";
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID!;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY!;
const AWS_S3_TTL = parseInt(
  process.env.AWS_S3_PRESIGN_TTL_SECONDS || "3600",
  10
);
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET || "your-default-bucket-name";

const IG_GRAPH_BASE =
  process.env.IG_GRAPH_BASE || "https://graph.facebook.com/v23.0";
const IG_USER_ID = process.env.IG_USER_ID!;
const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN!;
const IG_APP_ID = process.env.IG_APP_ID!;
const IG_APP_SECRET = process.env.IG_APP_SECRET!;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL || "tts-1";
const OPENAI_TTS_VOICE = process.env.OPENAI_TTS_VOICE || "alloy";
const OPENAI_FACT_MODEL = process.env.OPENAI_FACT_MODEL || "gpt-4o-mini";
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";

export {
  TZ,
  CRON_EXPR,
  NICHES_CSV,
  CAPTION_SUFFIX,
  REEL_DURATION,
  REEL_MARGIN,
  CREATE_MEDIA,
  COMBO_MODE,
  AWS_REGION,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_S3_TTL,
  AWS_S3_BUCKET,
  IG_GRAPH_BASE,
  IG_USER_ID,
  IG_ACCESS_TOKEN,
  IG_APP_ID,
  IG_APP_SECRET,
  OPENAI_API_KEY,
  OPENAI_TTS_MODEL,
  OPENAI_TTS_VOICE,
  OPENAI_FACT_MODEL,
  OPENAI_IMAGE_MODEL,
};
