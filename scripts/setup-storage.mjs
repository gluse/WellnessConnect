import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const bucket = process.env.SUPABASE_STORAGE_BUCKET || "service-images";
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SECRET_KEY first.");
  process.exit(1);
}
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const options = { public: false, fileSizeLimit: 10 * 1024 * 1024, allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] };
const { data: buckets, error: listError } = await client.storage.listBuckets();
if (listError) { console.error("Unable to list storage buckets. Check the Supabase secret key."); process.exit(1); }
const existing = buckets.find(item => item.name === bucket);
const { error } = existing
  ? await client.storage.updateBucket(bucket, options)
  : await client.storage.createBucket(bucket, options);
if (error) { console.error("Unable to configure the image bucket."); process.exit(1); }
console.log(`Configured private bucket ${bucket} with a 10 MB image limit.`);
