# Label Check

A prototype for TTB label compliance agents. Add a label image and what the COLA application says. The tool reads the label, compares each field, and checks the government warning word for word. It handles one label at a time or a batch of hundreds.

Everything runs in the agent's browser with free, open-source OCR (Tesseract). There are no AI or cloud API calls, and images are never uploaded.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests for the comparison, warning, OCR image and batch logic
npm run eval       # runs all sample labels through the real OCR pipeline in Node
npm run build      # static production build
```

Node 20+. `npm run dev` and `npm run build` first copy the OCR engine and English data from `node_modules` into `public/ocr/`, so the app serves them itself.

To try it without your own labels, use **Try an example** on the first screen or **Load the example batch** on the second. To regenerate the sample images, run `npm run samples`. For a 300-label test batch, run `npm run load-batch`; it writes to `load-test/`.

## How it works

1. **Read** (`src/lib/ocr/pipeline.ts`):
   - The image is straightened: text-line angle is measured with a projection profile, then the image is rotated level.
   - Tesseract reads it twice, in "auto" and "sparse" layout modes. Each catches text the other misses: big brand names and stray single words.
   - Photos get a third read of a locally thresholded copy, which recovers text washed out by glare.
   - The government warning is then cropped, zoomed and read again, the way an agent uses a magnifier on fine print.
2. **Find** (`src/lib/locate.ts`). OCR returns lines, not fields, so the application drives the search: for each field, find what the application says should be there. Brand and class are matched with a sliding word window over the text. Alcohol and net contents are found by their number patterns. The bottler is found from "Bottled by …" plus its address line.
3. **Decide** (`src/lib/compare.ts`, `src/lib/warning.ts`). Plain, unit-tested rules make the decision. OCR only supplies the text.

Every field ends up **Match**, **Review** or **Problem**. The tool never approves or rejects; the agent makes the call.

| Rule | Why (from the interviews) |
|---|---|
| Case, punctuation and accents are ignored, but the result says what differed (`STONE'S THROW` vs `Stone's Throw` is a match, with a note) | Dave: "obviously the same thing" |
| Near-misses go to Review, not Problem | Agents need judgment, not a pattern matcher |
| Alcohol is compared as a number and cross-checked against proof. Net contents are converted to mL (`75 cL` = `750 mL`) | Same value, written differently |
| The warning must match 27 CFR 16.21 word for word. Differences are shown as proofreading marks (struck through = missing, highlighted = added) | Jenny: "It has to be exact" |
| `GOVERNMENT WARNING:` must be in capitals (`Government Warning` is a Problem) | Jenny's title-case rejection |
| Bold is measured from the pixels: the heading's stroke thickness against the text after it (bold measures about 1.5×, regular 1.0×). The ratio is shown to the agent | Tesseract can't see bold |
| Tiny print: warning letters under half the height of the label's other small print go to Review, along with the minimum height for that container (27 CFR 16.22: 1, 2 or 3 mm) | "Smaller font… burying it in tiny text" |
| Probable misreads (lookalike characters such as `0`/`O`, or words Tesseract itself was unsure of) go to Review, not Problem | Don't fail a good label over the tool's own reading mistake |
| A poor image never gets a clean pass | Bad photos are flagged, not guessed at |

**Batch** (`src/components/BatchCheck.tsx`, `src/lib/reconcile.ts`). Add images (files or a whole folder) and a CSV of applications, matched by file name. The CSV is the source of truth and the counts add up:
- Applications with no image appear as "Missing image" rows.
- Images with no row get the warning check only.
- Identical images under two names are flagged as duplicates.
- `label7.png` in the CSV matches `label7.jpg`.

The run itself:
- CSV problems point at row numbers.
- Images too small to read are rejected before any time is spent on them.
- Labels run in parallel, one per OCR worker (up to 4).
- A run can be stopped and resumed, and shows time remaining.
- "Show problems first" sorts the results, and the export CSV records what the label said for each field.

This reconciliation design came from production experience validating Amazon Transparency codes on printed labels: check against the expected list, and keep "couldn't read" separate from "wrong".

## Measured

On a MacBook, with the 8 sample labels (generated in `public/samples/`, each aimed at a case from the interviews):

- `npm run eval`: **8/8 verdicts as expected**, 0 looser than expected, 1.0–1.7 s per label in Node.
- In Chrome: 1.1–1.7 s per label for a single check, comfortably inside the 5-second limit. The slowest is the tilted, glare-heavy photo. The 8-label example batch finishes in 3 s.
- A 300-label batch (`npm run load-batch`, with a deliberately messy CSV) finishes in **2 minutes** in Chrome, about 0.4 s per label with 4 labels in parallel. Every verdict matches the test data, and reconciliation catches each planted mistake: 2 applications with no image, 2 images with no row, and 1 row naming `.png` for a `.jpg`. No request goes to any other site.

## Decisions and trade-offs

- **No AI.** The brief allowed a cloud vision model, but it costs money per label, and Marcus's firewall blocks outside ML endpoints. Tesseract runs in the browser instead. The browser loads only this site: a Content-Security-Policy (`connect-src 'self'`) blocks any third-party request, the fonts are self-hosted, and the OCR engine is served from `/ocr`. Nothing leaves the agent's computer, which also takes care of the PII concern.
- **Static site.** There's no server code, so it can be hosted anywhere, including an internal server. It's deployed on Vercel here.
- **Plain rules decide.** OCR is fallible; comparison rules aren't. Every verdict can be explained and is unit-tested.
- **Plain UI for every comfort level.** 18 px base text, one main button per screen, plain words, and status shown as icon + word + color. Results sit beside the label image, so agents can verify at a glance.

## Limitations

- Glare, curved bottles and blurry photos lower OCR accuracy. The tool sends these to Review rather than passing them, but it can't read what isn't legible.
- Bold detection is a measurement, not a certainty. Unclear cases go to Review.
- Physical type size (mm) can't be measured from a photo, which has no scale. Only relative size is flagged.
- The first visit downloads about 7 MB of OCR engine and data; later visits use the cached copy.
- HEIC photos open only in Safari. English labels only.
- No COLA integration, accounts, storage or audit trail, as agreed for a prototype.

## Next steps

- A hold-with-reason workflow: an agent marks a label "accepted anyway" with a typed reason, recorded in the export.
- An optional vision model hosted inside TTB's Azure tenant, if budget allows, for curved and glare-heavy photos.
- Integration with COLA to pull application data instead of typing it or uploading a CSV.

## Layout

```
src/lib/ocr/        image processing, the reading pipeline, Tesseract output conversion
src/lib/locate.ts   finds each field in the OCR text
src/lib/compare.ts  field comparison rules
src/lib/warning.ts  government warning rules
src/lib/csv.ts, reconcile.ts   batch CSV parsing and reconciliation
src/lib/client/     browser-only: OCR worker pool, image loading
src/components/     the two screens and the results view
scripts/            sample generation, eval, load batch, OCR asset copy
```
