import fs from 'node:fs';

export async function writeStreamToFile(stream: any, destinationPath: string): Promise<void> {
  const dest = fs.createWriteStream(destinationPath);
  await new Promise<void>((resolve, reject) => {
    stream.on('end', resolve).on('error', reject).pipe(dest);
  });
}
