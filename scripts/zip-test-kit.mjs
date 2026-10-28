/**
 * Packs public/test-kit into public/test-kit.zip, so the batch screen can
 * offer the whole kit as one download. The images are already compressed
 * JPEGs, so entries are stored, not deflated, and a fixed date keeps the
 * zip identical from build to build. Runs before `dev` and `build`;
 * the zip is gitignored, so the images are committed only once.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const src = "public/test-kit";
const out = "public/test-kit.zip";
const root = "label-check-test-kit";

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// MS-DOS date for 2026-10-28, midnight.
const DOS_DATE = ((2026 - 1980) << 9) | (10 << 5) | 28;

const files = readdirSync(src, { recursive: true, withFileTypes: true })
  .filter((d) => d.isFile() && !d.name.startsWith("."))
  .map((d) => path.relative(src, path.join(d.parentPath, d.name)).split(path.sep).join("/"))
  .sort();

const locals = [];
const central = [];
let offset = 0;
for (const rel of files) {
  const data = readFileSync(path.join(src, rel));
  const name = Buffer.from(`${root}/${rel}`);
  const crc = crc32(data);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4); // version needed
  local.writeUInt16LE(0x0800, 6); // UTF-8 names
  local.writeUInt16LE(0, 8); // stored
  local.writeUInt16LE(0, 10);
  local.writeUInt16LE(DOS_DATE, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  locals.push(local, name, data);

  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50, 0);
  entry.writeUInt16LE(20, 4); // version made by
  entry.writeUInt16LE(20, 6);
  entry.writeUInt16LE(0x0800, 8);
  entry.writeUInt16LE(0, 10);
  entry.writeUInt16LE(0, 12);
  entry.writeUInt16LE(DOS_DATE, 14);
  entry.writeUInt32LE(crc, 16);
  entry.writeUInt32LE(data.length, 20);
  entry.writeUInt32LE(data.length, 24);
  entry.writeUInt16LE(name.length, 28);
  entry.writeUInt32LE(offset, 42);
  central.push(entry, name);

  offset += local.length + name.length + data.length;
}

const dir = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(dir.length, 12);
end.writeUInt32LE(offset, 16);

writeFileSync(out, Buffer.concat([...locals, dir, end]));
console.log(`${files.length} files packed into ${out}`);
