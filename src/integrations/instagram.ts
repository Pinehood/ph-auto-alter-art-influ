import axios from "axios";
import { setTimeout as sleep } from "timers/promises";
import { Logger } from "../utils/logger";
import {
  IG_GRAPH_BASE,
  IG_USER_ID,
  IG_ACCESS_TOKEN,
  IG_APP_ID,
  IG_APP_SECRET,
} from "../utils/environment";

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

  async publishCarouselPost(
    items: { url: string; type: "image" | "video" }[],
    caption: string
  ) {
    if (items.length < 2 || items.length > 10) {
      throw new Error("Carousel must have between 2 and 10 items.");
    }

    this.logger.info(`Creating ${items.length} carousel child containers...`);
    const childIds: string[] = [];
    for (const it of items) {
      if (it.type === "image") {
        const id = await this.createImageItem(it.url);
        childIds.push(id);
      } else {
        const id = await this.createVideoItem(it.url);
        childIds.push(id);
      }
    }
    this.logger.info("Creating carousel container...");
    const { data: carousel } = await axios.post(
      `${IG_GRAPH_BASE}/${IG_USER_ID}/media`,
      null,
      {
        params: {
          media_type: "CAROUSEL",
          caption,
          children: childIds.join(","),
          access_token: IG_ACCESS_TOKEN,
        },
      }
    );
    const carouselId = carousel.id as string;
    for (let i = 0; i < 12; i++) {
      const { data: st } = await axios.get(`${IG_GRAPH_BASE}/${carouselId}`, {
        params: { fields: "status,status_code", access_token: IG_ACCESS_TOKEN },
      });
      const code = st?.status_code || st?.status;
      if (code === "FINISHED" || code === "READY") break;
      if (code === "ERROR")
        throw new Error("Carousel container failed processing");
      await sleep(2500);
    }
    this.logger.info("Publishing carousel...");
    const { data: published } = await axios.post(
      `${IG_GRAPH_BASE}/${IG_USER_ID}/media_publish`,
      null,
      { params: { creation_id: carouselId, access_token: IG_ACCESS_TOKEN } }
    );
    this.logger.info(`Carousel published: ${published.id}`);
    return published;
  }

  private async createImageItem(url: string) {
    const { data } = await axios.post(
      `${IG_GRAPH_BASE}/${IG_USER_ID}/media`,
      null,
      {
        params: {
          image_url: url,
          is_carousel_item: true,
          access_token: IG_ACCESS_TOKEN,
        },
      }
    );
    return data.id as string;
  }

  private async createVideoItem(url: string) {
    const { data } = await axios.post(
      `${IG_GRAPH_BASE}/${IG_USER_ID}/media`,
      null,
      {
        params: {
          media_type: "VIDEO",
          video_url: url,
          is_carousel_item: true,
          access_token: IG_ACCESS_TOKEN,
        },
      }
    );
    const id = data.id as string;
    for (let i = 0; i < 30; i++) {
      const { data: st } = await axios.get(`${IG_GRAPH_BASE}/${id}`, {
        params: { fields: "status,status_code", access_token: IG_ACCESS_TOKEN },
      });
      const code = st?.status_code || st?.status;
      if (code === "FINISHED") break;
      if (code === "ERROR") throw new Error("Video child failed processing");
      await sleep(2500);
      if (i === 29)
        throw new Error("Timeout waiting for video child processing");
    }
    return id;
  }
}
