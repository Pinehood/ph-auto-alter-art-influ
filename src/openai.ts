import OpenAI from "openai";
import {
  OPENAI_API_KEY,
  NICHES_CSV,
  OPENAI_FACT_MODEL,
  OPENAI_IMAGE_MODEL,
  OPENAI_TTS_MODEL,
  OPENAI_TTS_VOICE,
} from "./environment";

const FACTS_PROMPT = `
    You produce one quirky, accurate, 15-25 word fact in the given niche.
    - Keep it family-friendly and brand-safe.
    - Avoid sensitive/medical/financial claims.
    - No hashtags or emojis.
    - Return only the sentence.
  `;

const POSTER_PROMPT = (fact: string, niche: string) => `
    Design a clean, square poster for Instagram about "${niche}".
    Prominently overlay this exact text centered with good contrast and large, readable typography:

    "${fact}"

    Use a simple, modern color palette. Include subtle, relevant illustration/background that fits the topic.
    Do not include watermarks or logos.
  `;

export class OpenAi {
  private readonly client: OpenAI;

  constructor() {
    this.client = new OpenAI({ apiKey: OPENAI_API_KEY });
  }

  pickNiche(nichesCsv?: string) {
    const csv = nichesCsv || NICHES_CSV;
    const list = csv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return list[Math.floor(Math.random() * list.length)];
  }

  async generateFact(niche: string) {
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
    return { text, niche };
  }

  async generatePosterWithText(fact: string, niche: string) {
    const image = await this.client.images.generate({
      model: OPENAI_IMAGE_MODEL,
      prompt: POSTER_PROMPT(fact, niche),
      size: "1024x1024",
      output_format: "png",
    });
    return image?.data?.[0]?.b64_json;
  }

  async synthesizeVoiceover(text: string) {
    const speech = await this.client.audio.speech.create({
      model: OPENAI_TTS_MODEL,
      voice: OPENAI_TTS_VOICE,
      input: text,
    });
    const arrayBuffer = await speech.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
