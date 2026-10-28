/**
 * Draws the test labels in src/lib/samples.ts into the test kit in
 * public/test-kit/: the label images, applications.csv for the batch screen,
 * and an answer key saying what each one should get. The examples on both
 * screens load from here too. Run: npm run samples
 */
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import Papa from "papaparse";
import sharp from "sharp";
import { applicationsToCsv } from "../src/lib/csv";
import { TEST_KIT, type KitEntry, type Sample } from "../src/lib/samples";

const OUT = "public/test-kit";
const SITE = "https://itaitakehome.vercel.app";

const W = 1200;
const H = 1600;
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "Helvetica, Arial, sans-serif";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function wrap(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && (line + " " + word).length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function centered(lines: string[], y: number, size: number, attrs: string, lineHeight = 1.15): string {
  return lines
    .map(
      (l, i) =>
        `<text x="${W / 2}" y="${y + i * size * lineHeight}" font-size="${size}" text-anchor="middle" ${attrs}>${esc(l)}</text>`,
    )
    .join("\n");
}

function labelSvg(s: Sample): string {
  const { bg, ink, accent } = s.theme;
  const p = s.printed;
  const brandLines = wrap(p.brand, 12);
  const brandSize = brandLines.length > 1 ? 104 : 120;
  const brandY = 300;
  const afterBrand = brandY + brandLines.length * brandSize * 1.05;

  // The warning: heading as its own tspan so it can be bold or not.
  const size = p.warningSize ?? 25;
  const lines = p.warningHeading
    ? wrap(`${p.warningHeading} ${p.warningBody}`, Math.floor((78 * 25) / size))
    : [];
  const boxTop = 1190;
  const pad = 24;
  const boxHeight = pad * 2 + size * 1.25 + (lines.length - 1) * size * 1.35;
  const warning = lines
    .map((l, i) => {
      const y = boxTop + pad + size + i * size * 1.35;
      if (i === 0 && l.startsWith(p.warningHeading)) {
        const rest = l.slice(p.warningHeading.length);
        return `<text x="110" y="${y}" font-size="${size}" font-family="${SANS}" fill="${ink}"><tspan font-weight="${p.headingBold ? "bold" : "normal"}">${esc(p.warningHeading)}</tspan>${esc(rest)}</text>`;
      }
      return `<text x="110" y="${y}" font-size="${size}" font-family="${SANS}" fill="${ink}">${esc(l)}</text>`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${bg}"/>
  <rect x="40" y="40" width="${W - 80}" height="${H - 80}" fill="none" stroke="${ink}" stroke-width="6"/>
  <rect x="62" y="62" width="${W - 124}" height="${H - 124}" fill="none" stroke="${accent}" stroke-width="2"/>
  ${p.tagline ? centered([p.tagline], 170, 34, `font-family="${SANS}" letter-spacing="6" fill="${accent}"`) : ""}
  ${centered(brandLines, brandY, brandSize, `font-family="${SERIF}" font-weight="bold" fill="${ink}"`, 1.05)}
  <line x1="300" y1="${afterBrand}" x2="900" y2="${afterBrand}" stroke="${accent}" stroke-width="3"/>
  ${centered(wrap(p.classType, 30), afterBrand + 100, 56, `font-family="${SERIF}" font-style="italic" fill="${ink}"`)}
  ${centered([p.alcohol], 820, 46, `font-family="${SANS}" fill="${ink}"`)}
  ${centered([p.net], 890, 46, `font-family="${SANS}" font-weight="bold" fill="${ink}"`)}
  ${centered(wrap(p.bottler, 52), 990, 30, `font-family="${SANS}" fill="${ink}"`)}
  ${p.country ? centered([p.country], 1110, 34, `font-family="${SANS}" font-weight="bold" fill="${accent}"`) : ""}
  ${p.warningHeading ? `<rect x="90" y="${boxTop}" width="${W - 180}" height="${boxHeight}" fill="none" stroke="${ink}" stroke-width="2"/>` : ""}
  ${warning}
</svg>`;
}

/** Tilts and shears the label onto a dark background and adds a glare streak. */
async function photograph(label: Buffer): Promise<Buffer> {
  // Separate pipelines: sharp reorders affine and rotate within one.
  const sheared = await sharp(label)
    .affine(
      [
        [1, 0.06],
        [0.03, 1],
      ],
      { background: "#2a2622" },
    )
    .png()
    .toBuffer();
  const tilted = await sharp(sheared)
    .rotate(-7, { background: "#2a2622" })
    .png()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = tilted.info;
  const glare = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><radialGradient id="g" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fff" stop-opacity="0.85"/>
      <stop offset="60%" stop-color="#fff" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
    </radialGradient></defs>
    <ellipse cx="${width * 0.68}" cy="${height * 0.33}" rx="${width * 0.16}" ry="${height * 0.3}" fill="url(#g)" transform="rotate(-20 ${width * 0.68} ${height * 0.33})"/>
  </svg>`);
  const lit = await sharp(tilted.data)
    .composite([{ input: glare, blend: "over" }])
    .png()
    .toBuffer();
  return sharp(lit)
    .modulate({ brightness: 0.92 })
    .blur(0.7)
    .resize({ width: 1400 })
    .jpeg({ quality: 82 })
    .toBuffer();
}

/** Out of focus, the way a hurried phone photo comes out. */
async function blurry(label: Buffer): Promise<Buffer> {
  return sharp(label).blur(BLUR).resize({ width: 1400 }).jpeg({ quality: 80 }).toBuffer();
}

/**
 * Gaussian sigma in px on the 1200 px label. Lighter blur (2.5 to 4) still reads as a
 * clear image but misreads a few words, which come out as Problems; 4.5 reads as poor.
 */
const BLUR = 4.5;

async function draw(s: Sample): Promise<Buffer> {
  const label = await sharp(Buffer.from(labelSvg(s)))
    .png()
    .toBuffer();
  switch (s.capture) {
    case "angled":
      return photograph(label);
    case "blurry":
      return blurry(label);
    case "thumbnail":
      // Under the 600 px the app needs, so it's turned back before any reading.
      return sharp(label).resize({ width: 400 }).jpeg({ quality: 88 }).toBuffer();
    default:
      return sharp(label).jpeg({ quality: 88 }).toBuffer();
  }
}

const count = (r: string) => TEST_KIT.filter((e) => e.expected === r).length;

function readme(): string {
  const images = TEST_KIT.filter((e) => e.hasImage).length;
  const rows = TEST_KIT.filter((e) => e.csvName).length;
  return `Label Check test kit

${images} fake label images and an applications.csv with ${rows} rows. Each label
tests one rule. answer-key.csv says what each one should get and why.

To check them all at once:
1. Open ${SITE}/batch
2. Drag the labels folder onto "Add the label images".
3. Drag applications.csv onto "Add the application details".
4. Before checking, the tool should report:
   - ${images} images, ${images - 1} matched to an application (1 by name, ignoring a different
     file extension), 1 with no application row, 1 exact copy of another.
   - ${rows} applications, ${rows - 1} matched to an image, 1 with no image.
5. Press "Check ${images} labels". When it finishes it should show:
   ${count("Problem")} with problems, ${count("Review")} to review, ${count("Match")} matching, ${count("Couldn't check")} couldn't be checked,
   ${count("Missing image")} missing an image.
6. Press "Show details" on any row to see why. Compare with answer-key.csv.

To check one label, open ${SITE}, add the image,
and type in its row from applications.csv.

All brands, companies and addresses are made up.
`;
}

function answerKey(entries: KitEntry[]): string {
  return Papa.unparse({
    fields: ["file", "expected result", "what it tests", "what the result should say"],
    data: entries.map((e) => [e.file, e.expected, e.tests, e.answer]),
  });
}

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(`${OUT}/labels`, { recursive: true });
  for (const e of TEST_KIT) {
    if (!e.hasImage) continue;
    if (e.copyOf) await copyFile(`${OUT}/labels/${e.copyOf}`, `${OUT}/labels/${e.file}`);
    else await writeFile(`${OUT}/labels/${e.file}`, await draw(e.sample));
    console.log(`${OUT}/labels/${e.file}`);
  }
  const csv = applicationsToCsv(
    TEST_KIT.filter((e) => e.csvName).map((e) => ({ file: e.csvName!, application: e.sample.application })),
  );
  await writeFile(`${OUT}/applications.csv`, csv + "\n");
  await writeFile(`${OUT}/answer-key.csv`, answerKey(TEST_KIT) + "\n");
  await writeFile(`${OUT}/README.txt`, readme());
  console.log(`${OUT}/applications.csv, answer-key.csv, README.txt`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
