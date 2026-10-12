import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { services } from "@shared/schema";
import { db } from "./db";
import { storageBucket, supabaseAdmin } from "./supabase";

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
const objectPattern = /^\/objects\/([a-zA-Z0-9_-]+)\/([a-f0-9-]{36}\.(?:jpg|png|webp|gif))$/;

export class ImageStorageError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function objectKey(objectPath: string) {
  if (!objectPattern.test(objectPath)) throw new ImageStorageError(400, "Invalid image path");
  return objectPath.slice("/objects/".length);
}

export function assertImageOwner(objectPath: string, userId: string) {
  const key = objectKey(objectPath);
  if (key.split("/")[0] !== userId) throw new ImageStorageError(403, "You do not own this image");
  return key;
}

export async function createImageUpload(userId: string, contentType: string, size: number) {
  if (!extensions[contentType] || !Number.isInteger(size) || size < 1 || size > MAX_IMAGE_SIZE) {
    throw new ImageStorageError(400, "Choose a JPEG, PNG, WebP, or GIF image up to 10 MB");
  }
  const path = `${userId}/${randomUUID()}.${extensions[contentType]}`;
  const { data, error } = await supabaseAdmin.storage.from(storageBucket).createSignedUploadUrl(path, { upsert: false });
  if (error || !data) throw new ImageStorageError(503, "Image storage is unavailable");
  return { signedUrl: data.signedUrl, objectPath: `/objects/${path}` };
}

function imageType(bytes: Buffer) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6))) return "image/gif";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

export async function downloadImage(objectPath: string) {
  const { data, error } = await supabaseAdmin.storage.from(storageBucket).download(objectKey(objectPath));
  if (error || !data) throw new ImageStorageError(404, "Image not found");
  if (data.size > MAX_IMAGE_SIZE || data.size < 1) throw new ImageStorageError(400, "Invalid image size");
  const bytes = Buffer.from(await data.arrayBuffer());
  const contentType = imageType(bytes);
  if (!contentType || !objectPath.endsWith(`.${extensions[contentType]}`)) throw new ImageStorageError(400, "The uploaded file is not a supported image");
  return { bytes, contentType };
}

export async function validateOwnedImage(objectPath: string, userId: string) {
  assertImageOwner(objectPath, userId);
  await downloadImage(objectPath);
}

export async function canReadImage(objectPath: string, userId: string) {
  const key = objectKey(objectPath);
  if (key.split("/")[0] === userId) return true;
  const published = await db.select({ id: services.id }).from(services)
    .where(and(eq(services.imageUrl, objectPath), eq(services.isActive, true))).limit(1);
  return published.length > 0;
}
