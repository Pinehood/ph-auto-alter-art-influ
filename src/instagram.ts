import axios from "axios";
import { Logger } from "./logger";
import {
  IG_GRAPH_BASE,
  IG_USER_ID,
  IG_ACCESS_TOKEN,
  IG_APP_ID,
  IG_APP_SECRET,
} from "./environment";

export class Instagram {
  private readonly logger = new Logger();

  async getIdentity() {
    const response = await axios.get(`${IG_GRAPH_BASE}/${IG_USER_ID}`, {
      params: { fields: "id,username", access_token: IG_ACCESS_TOKEN },
    });
    return response.data;
  }

  async getLongLivedToken() {
    const params = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: IG_APP_ID,
      client_secret: IG_APP_SECRET,
      fb_exchange_token: IG_ACCESS_TOKEN,
    });
    const { data } = await axios.post(
      `${IG_GRAPH_BASE}/oauth/access_token`,
      params
    );
    return data as {
      access_token: string;
      token_type: string;
      expires_in: number;
    };
  }

  async publishPhotoPost(imageUrl: string, caption: string) {
    this.logger.info(`Publishing Photo Post...`);
    const containerRes = await axios.post(
      `${IG_GRAPH_BASE}/${IG_USER_ID}/media`,
      null,
      {
        params: {
          image_url: imageUrl,
          caption,
          access_token: IG_ACCESS_TOKEN,
        },
      }
    );
    const creationId = containerRes.data.id as string;
    if (!creationId) throw new Error("No creation_id from Instagram.");
    const publishRes = await axios.post(
      `${IG_GRAPH_BASE}/${IG_USER_ID}/media_publish`,
      null,
      {
        params: {
          creation_id: creationId,
          access_token: IG_ACCESS_TOKEN,
        },
      }
    );
    const post = publishRes.data;
    this.logger.info(`Photo Post published: ${post.id}`);
    return post;
  }

  async publishVideoReel(videoUrl: string, caption: string) {
    this.logger.info(`Publishing Video Reel...`);
    const create = await axios.post(
      `${IG_GRAPH_BASE}/${IG_USER_ID}/media`,
      null,
      {
        params: {
          media_type: "REELS",
          video_url: videoUrl,
          caption,
          access_token: IG_ACCESS_TOKEN,
        },
      }
    );
    const creationId = create.data.id as string;
    if (!creationId) throw new Error("No creation_id for Reel");
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const status = await axios.get(`${IG_GRAPH_BASE}/${creationId}`, {
        params: { fields: "status_code,status", access_token: IG_ACCESS_TOKEN },
      });
      const code = status.data?.status_code || status.data?.status;
      if (code === "FINISHED") break;
      if (code === "ERROR")
        throw new Error("Reel container error while processing.");
      if (i === 19) throw new Error("Timeout waiting for Reel processing.");
    }
    const publish = await axios.post(
      `${IG_GRAPH_BASE}/${IG_USER_ID}/media_publish`,
      null,
      {
        params: {
          creation_id: creationId,
          access_token: IG_ACCESS_TOKEN,
        },
      }
    );
    const reel = publish.data;
    this.logger.info(`Video Reel published: ${reel.id}`);
    return reel;
  }
}
