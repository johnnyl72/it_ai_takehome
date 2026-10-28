/**
 * Draws the test labels in src/lib/samples.ts into public/samples/*.jpg,
 * plus sample-batch.csv for the batch screen. Run: npm run samples
 */
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { applicationsToCsv } from "../src/lib/csv";
import { SAMPLES, type Sample } from "../src/lib/samples";

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
  const lines = wrap(`${p.warningHeading} ${p.warningBody}`, Math.floor((78 * 25) / size));
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
  <rect x="90" y="${boxTop}" width="${W - 180}" height="${boxHeight}" fill="none" stroke="${ink}" stroke-width="2"/>
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

async function main() {
  await mkdir("public/samples", { recursive: true });
  for (const s of SAMPLES) {
    let img: Buffer = await sharp(Buffer.from(labelSvg(s)))
      .png()
      .toBuffer();
    img = s.photo ? await photograph(img) : await sharp(img).jpeg({ quality: 88 }).toBuffer();
    await writeFile(`public/samples/${s.id}.jpg`, img);
    console.log(`public/samples/${s.id}.jpg`);
  }
  const csv = applicationsToCsv(SAMPLES.map((s) => ({ file: `${s.id}.jpg`, application: s.application })));
  await writeFile("public/samples/sample-batch.csv", csv + "\n");
  console.log("public/samples/sample-batch.csv");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
