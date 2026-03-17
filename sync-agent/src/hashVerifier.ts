import { createHash } from 'crypto';
import { createReadStream } from 'fs';

export async function verifyHash(filePath: string, expectedHash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);

    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => {
      const computed = hash.digest('hex');
      resolve(computed === expectedHash.toLowerCase());
    });
    stream.on('error', reject);
  });
}
