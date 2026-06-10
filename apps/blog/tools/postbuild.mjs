// @ts-check
// Renames the extensionless opengraph-image emitted by Next's ImageResponse to
// opengraph-image.png so S3BucketFolder can detect and upload it with the correct
// content-type (image/png). Run after `next build`. Part of `nx run blog:postbuild`.
import { existsSync, renameSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const src = resolve(dir, '../out/opengraph-image');
const dest = resolve(dir, '../out/opengraph-image.png');

if (existsSync(src)) {
  renameSync(src, dest);
  console.log('postbuild: opengraph-image → opengraph-image.png');
} else if (existsSync(dest)) {
  console.log('postbuild: opengraph-image.png already present');
} else {
  console.warn('postbuild: out/opengraph-image not found — build blog first');
}
