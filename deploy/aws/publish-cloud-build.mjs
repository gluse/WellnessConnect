// Runs only in the build-only CodeBuild project; it cannot deploy the service.
import fs from 'node:fs';
import { buildImage, command, project, region, requireValue, service, sha256, uploadImage, verifyContext } from './publish-image.mjs';

async function aws(args) {
  return JSON.parse(await command('aws', [...args, '--region', region, '--output', 'json', '--no-cli-pager'], { env: { ...process.env, AWS_MAX_ATTEMPTS: '1' } }));
}
try {
  requireValue(process.env.CODEBUILD_BUILD_ID && process.env.TARGET_SERVICE === service && process.env.REGION === region, 'BUILDER_TARGET_REJECTED');
  requireValue((await aws(['sts', 'get-caller-identity'])).Account === project, 'WRONG_AWS_PROJECT');
  const manifest = JSON.parse(fs.readFileSync('publish-source-manifest.json', 'utf8'));
  requireValue(manifest.sha256 === process.env.SOURCE_MANIFEST_SHA256 && sha256(JSON.stringify(manifest.files)) === manifest.sha256, 'CLOUD_SOURCE_HASH_CHANGED');
  // Metadata stays outside the reviewed build context and never enters an image.
  fs.unlinkSync('publish-source-manifest.json');
  verifyContext({ context: process.cwd(), manifest });
  const label = process.env.IMAGE_LABEL;
  requireValue(/^src[a-f0-9]{24}$/.test(label || ''), 'IMAGE_LABEL_REJECTED');
  const image = await buildImage({ context: process.cwd(), label });
  const login = (await aws(['lightsail', 'create-container-service-registry-login'])).registryLogin;
  const digest = await uploadImage({ ...image, label, login });
  const registered = (await aws(['lightsail', 'register-container-image', '--service-name', service, '--label', label, '--digest', digest])).containerImage;
  requireValue(registered.digest === digest && registered.image.startsWith(`:${service}.${label}.`), 'REGISTERED_IMAGE_CHANGED');
  console.log(JSON.stringify({ image: registered.image, digest, sourceManifestSha256: manifest.sha256, isolatedChecksPassed: true, deployed: false }));
} catch (error) {
  console.error(JSON.stringify({ error: /^[A-Z_]+$/.test(error.message) ? error.message : 'CLOUD_BUILD_FAILED',
    registryReason: /^[A-Z_]+$/.test(error.registryReason || '') ? error.registryReason : undefined,
    registryHttpStatus: Number.isInteger(error.registryHttpStatus) ? error.registryHttpStatus : undefined,
    retryPerformed: false, deployed: false }));
  process.exitCode = 1;
}
