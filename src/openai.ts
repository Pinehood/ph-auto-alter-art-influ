import OpenAI from "openai";
import { Logger } from "./logger";
import {
  OPENAI_API_KEY,
  NICHES_CSV,
  OPENAI_FACT_MODEL,
  OPENAI_IMAGE_MODEL,
  OPENAI_TTS_MODEL,
  OPENAI_TTS_VOICE,
} from "./environment";

const FACTS_PROMPT = `
    You produce one quirky, accurate, 15-25 word fact or text or whatever needed in the given niche.
    - Keep it family-friendly and brand-safe.
    - Avoid sensitive/medical/financial claims.
    - No hashtags or emojis.
    - Return only the sentence.
  `;

const POSTER_PROMPT = (fact: string, niche: string) => `
    Design a clean, square poster for Instagram about "${niche}".
    Prominently overlay this exact text centered with good contrast and large, readable typography:

    "${fact}"

    Use a simple, modern color palette. 
    Include subtle, relevant illustration or background that fits the topic.
    Do not include watermarks or logos.
  `;

export class OpenAi {
  private readonly logger = new Logger();
  private readonly client: OpenAI;

  constructor() {
    this.client = new OpenAI({ apiKey: OPENAI_API_KEY });
  }

  pickNiche(nichesCsv?: string) {
    const csv = nichesCsv || NICHES_CSV;
    const list = csv
      .replace(/\n/g, "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const niche = list[Math.floor(Math.random() * list.length)];
    this.logger.info(`Niche selected: ${niche}`);
    return niche;
  }

  async generateFact(niche: string) {
    this.logger.info("Generating fact...");
    const response = await this.client.responses.create({
      model: OPENAI_FACT_MODEL,
      input: [
        { role: "system", content: FACTS_PROMPT },
        { role: "user", content: `Niche: ${niche}. Generate the fact.` },
      ],
    });
    const text = (response.output_text || "Did you know?")
      .trim()
      .replace(/^["“]|["”]$/g, "");
    this.logger.info(`Generated fact: ${text}`);
    return text;
  }

  async generatePosterWithText(fact: string, niche: string) {
    this.logger.info("Generating image poster...");
    const image = await this.client.images.generate({
      model: OPENAI_IMAGE_MODEL,
      prompt: POSTER_PROMPT(fact, niche),
      size: "1024x1024",
      output_format: "png",
    });
    const imageData = image?.data?.[0]?.b64_json;
    this.logger.info(
      `Generated image poster: ${imageData ? "success" : "failed"}`
    );
    return imageData;
  }

  async synthesizeVoiceover(text: string) {
    this.logger.info("Synthesizing TTS...");
    const speech = await this.client.audio.speech.create({
      model: OPENAI_TTS_MODEL,
      voice: OPENAI_TTS_VOICE,
      input: text,
    });
    const arrayBuffer = await speech.arrayBuffer();
    this.logger.info(`Synthesized TTS, bytes size: ${arrayBuffer.byteLength}`);
    return Buffer.from(arrayBuffer);
  }
}
