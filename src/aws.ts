import { S3, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "node:crypto";
import fs from "node:fs";
import { Logger } from "./logger";
import {
  AWS_REGION,
  AWS_S3_BUCKET,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_S3_TTL,
} from "./environment";

export class AWS {
  private readonly logger = new Logger();
  private readonly client: S3;

  constructor() {
    this.client = new S3({
      region: AWS_REGION,
      credentials:
        AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY
          ? {
              accessKeyId: AWS_ACCESS_KEY_ID,
              secretAccessKey: AWS_SECRET_ACCESS_KEY,
            }
          : undefined,
    });
  }

  async uploadImageFromOpenAiToS3(base64Json: string, key: string) {
    this.logger.info(`[AWS] Uploading image to S3 and generating URL...`);
    const buf = this.decodeStrictBase64(base64Json);
    fs.writeFileSync("image.png", buf);
    await this.client.send(
      new PutObjectCommand({
        Bucket: AWS_S3_BUCKET,
        Key: key.replace(/^\/+/, ""),
        Body: fs.createReadStream("image.png"),
        ContentType: "image/png",
        ContentLength: buf.byteLength,
        ContentMD5: crypto.createHash("md5").update(buf).digest("base64"),
        ContentDisposition: `inline; filename="image.png"`,
        ServerSideEncryption: "AES256",
      })
    );
    fs.rmSync("image.png");
    const presigned = await getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: AWS_S3_BUCKET,
        Key: key,
      }),
      { expiresIn: AWS_S3_TTL }
    );
    this.logger.info(`Presigned URL generated: ${presigned}`);
    return presigned;
  }

  async uploadReelToS3FromFilePath(path: string, key: string) {
    this.logger.info(`Uploading file to S3 and generating URL...`);
    await this.client.send(
      new PutObjectCommand({
        Bucket: AWS_S3_BUCKET,
        Key: key,
        Body: fs.createReadStream(path),
        ContentType: "video/mp4",
      })
    );
    const presigned = await getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: AWS_S3_BUCKET,
        Key: key,
      }),
      { expiresIn: AWS_S3_TTL }
    );
    this.logger.info(`Presigned URL generated: ${presigned}`);
    return presigned;
  }

  private decodeStrictBase64(b64: string) {
    let s = b64
      .replace(/\s+/g, "")
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .replace(/ /g, "+");
    const pad = s.length % 4;
    if (pad) {
      s += "=".repeat(4 - pad);
    }
    const buf = Buffer.from(s, "base64");
    if (buf.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
      throw new Error("Not a PNG (magic header mismatch).");
    }
    return buf;
  }
}
