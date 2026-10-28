/**
 * Builds a 300-label batch in load-test/ for trying the batch screen at peak
 * season size: 300 images (each sample stamped with a lot number, so no two
 * are byte-identical) and applications.csv. The CSV is deliberately a little
 * messy, the way real ones are, so the reconciliation has something to show:
 * two applications with no image, two images with no application, and one
 * row that names the file with the wrong extension.
 * Run: npm run load-batch
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { applicationsToCsv } from "../src/lib/csv";
import { SAMPLES, sampleImageUrl } from "../src/lib/samples";

const COUNT = 300;
const OUT = "load-test";

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(`${OUT}/labels`, { recursive: true });
  const rows: { file: string; application: (typeof SAMPLES)[number]["application"] }[] = [];

  for (let i = 1; i <= COUNT; i++) {
    const s = SAMPLES[(i - 1) % SAMPLES.length];
    const file = `label-${String(i).padStart(3, "0")}.jpg`;
    const src = await readFile(`public${sampleImageUrl(s)}`);
    const { width = 1200, height = 1600 } = await sharp(src).metadata();
    const stamp = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><text x="${width - 90}" y="${height - 70}" font-size="22" font-family="Helvetica" text-anchor="end" fill="#555">LOT ${String(i).padStart(4, "0")}</text></svg>`,
    );
    await writeFile(
      `${OUT}/labels/${file}`,
      await sharp(src)
        .composite([{ input: stamp }])
        .jpeg({ quality: 86 })
        .toBuffer(),
    );
    // Images 299 and 300 get no row: the importer forgot them.
    if (i <= COUNT - 2)
      rows.push({ file: i === 7 ? file.replace(".jpg", ".png") : file, application: s.application });
  }
  rows.push({ file: "label-301.jpg", application: SAMPLES[0].application });
  rows.push({ file: "label-302.jpg", application: SAMPLES[1].application });

  await writeFile(`${OUT}/applications.csv`, applicationsToCsv(rows) + "\n");
  console.log(`${COUNT} images in ${OUT}/labels, ${rows.length} rows in ${OUT}/applications.csv`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
