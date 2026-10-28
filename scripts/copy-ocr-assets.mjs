/**
 * Copies the OCR engine and English data from node_modules into public/ocr,
 * so the browser loads them from this app and nowhere else: tesseract.js
 * would otherwise fetch them from a CDN, which a locked-down network blocks.
 * Runs before `dev` and `build`; public/ocr is gitignored.
 */
import { cpSync, mkdirSync } from "node:fs";

const out = "public/ocr";
mkdirSync(`${out}/core`, { recursive: true });
mkdirSync(`${out}/lang`, { recursive: true });

cpSync("node_modules/tesseract.js/dist/worker.min.js", `${out}/worker.min.js`);
// The worker picks one build by what the browser supports; ship all three LSTM builds.
for (const build of ["tesseract-core-lstm", "tesseract-core-simd-lstm", "tesseract-core-relaxedsimd-lstm"]) {
  cpSync(`node_modules/tesseract.js-core/${build}.wasm.js`, `${out}/core/${build}.wasm.js`);
}
cpSync(
  "node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz",
  `${out}/lang/eng.traineddata.gz`,
);

console.log(`OCR assets copied to ${out}/`);
