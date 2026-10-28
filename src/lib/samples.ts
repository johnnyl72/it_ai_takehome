import type { Application } from "./types";
import { WARNING_BODY } from "./warning";

/**
 * Test labels, each aimed at a case from the discovery interviews or a rule
 * in 27 CFR. `printed` is what scripts/make-samples.ts draws onto the image;
 * `application` is what the agent would type in from the COLA form.
 */
export interface Sample {
  id: string;
  title: string;
  /** What this sample demonstrates, shown on the "try an example" buttons. */
  shows: string;
  expected: "pass" | "review" | "fail";
  /** What the result should say, for the test kit's answer key. */
  answer: string;
  application: Application;
  printed: {
    brand: string;
    tagline?: string;
    classType: string;
    alcohol: string;
    net: string;
    bottler: string;
    country?: string;
    /** Empty heading and body: the label has no warning at all. */
    warningHeading: string;
    warningBody: string;
    headingBold: boolean;
    /** Warning type size in px on a 1200 x 1600 label; 25 is normal. */
    warningSize?: number;
  };
  theme: { bg: string; ink: string; accent: string };
  /**
   * angled: shot at an angle with glare, like a phone photo of a bottle.
   * blurry: out of focus. thumbnail: too small to read at all.
   */
  capture?: "angled" | "blurry" | "thumbnail";
}

export const SAMPLES: Sample[] = [
  {
    id: "old-tom-bourbon",
    title: "Old Tom Distillery",
    shows: "Everything correct",
    expected: "pass",
    answer: "Every field matches and the warning is correct.",
    application: {
      brandName: "OLD TOM DISTILLERY",
      classType: "Kentucky Straight Bourbon Whiskey",
      alcoholContent: "45% Alc./Vol. (90 Proof)",
      netContents: "750 mL",
      bottler: "Old Tom Distillery, Louisville, Kentucky",
      countryOfOrigin: "",
    },
    printed: {
      brand: "OLD TOM DISTILLERY",
      tagline: "SMALL BATCH · EST. 1892",
      classType: "Kentucky Straight Bourbon Whiskey",
      alcohol: "45% Alc./Vol. (90 Proof)",
      net: "750 mL",
      bottler: "Distilled and bottled by Old Tom Distillery, Louisville, KY",
      warningHeading: "GOVERNMENT WARNING:",
      warningBody: WARNING_BODY,
      headingBold: true,
    },
    theme: { bg: "#f4ead5", ink: "#3b2414", accent: "#8a5a2b" },
  },
  {
    id: "stones-throw-gin",
    title: "Stone's Throw",
    shows: "Brand in capitals, application in title case",
    expected: "pass",
    answer: "Brand name matches, with a note that the label prints it in capital letters.",
    application: {
      brandName: "Stone's Throw",
      classType: "London Dry Gin",
      alcoholContent: "41.2% ABV",
      netContents: "750 mL",
      bottler: "Stone's Throw Spirits, Portland, Oregon",
      countryOfOrigin: "",
    },
    printed: {
      brand: "STONE’S THROW",
      tagline: "BOTANICAL · COPPER POT",
      classType: "London Dry Gin",
      alcohol: "41.2% Alc./Vol. (82.4 Proof)",
      net: "750 mL",
      bottler: "Bottled by Stone’s Throw Spirits, Portland, OR",
      warningHeading: "GOVERNMENT WARNING:",
      warningBody: WARNING_BODY,
      headingBold: true,
    },
    theme: { bg: "#e3efe9", ink: "#13324a", accent: "#2f6f73" },
  },
  {
    id: "harbor-light-rum",
    title: "Harbor Light",
    shows: "Warning heading in title case",
    expected: "fail",
    answer: 'Government warning: Problem. The heading reads "Government Warning:" and must be in capitals.',
    application: {
      brandName: "Harbor Light",
      classType: "Gold Rum",
      alcoholContent: "40% Alc./Vol.",
      netContents: "1 L",
      bottler: "Harbor Light Rum Co., Miami, FL",
      countryOfOrigin: "",
    },
    printed: {
      brand: "HARBOR LIGHT",
      tagline: "AGED 4 YEARS",
      classType: "Gold Rum",
      alcohol: "40% Alc./Vol. (80 Proof)",
      net: "1 Liter",
      bottler: "Distilled and bottled by Harbor Light Rum Co., Miami, Florida",
      warningHeading: "Government Warning:",
      warningBody: WARNING_BODY,
      headingBold: true,
    },
    theme: { bg: "#fbf3e4", ink: "#0d3b47", accent: "#c4862d" },
  },
  {
    id: "copper-ridge-vodka",
    title: "Copper Ridge",
    shows: "Alcohol content doesn't match",
    expected: "fail",
    answer: "Alcohol content: Problem. The application says 45%, the label 40%.",
    application: {
      brandName: "Copper Ridge",
      classType: "Vodka",
      alcoholContent: "45% Alc./Vol.",
      netContents: "750 mL",
      bottler: "Copper Ridge Distilling, Denver, CO",
      countryOfOrigin: "",
    },
    printed: {
      brand: "COPPER RIDGE",
      tagline: "DISTILLED SIX TIMES",
      classType: "Vodka",
      alcohol: "40% Alc./Vol. (80 Proof)",
      net: "750 mL",
      bottler: "Distilled and bottled by Copper Ridge Distilling, Denver, CO",
      warningHeading: "GOVERNMENT WARNING:",
      warningBody: WARNING_BODY,
      headingBold: true,
    },
    theme: { bg: "#eef1f4", ink: "#1d2a3a", accent: "#b06a3b" },
  },
  {
    id: "chateau-marcel-wine",
    title: "Château Marcel",
    shows: "Imported wine with country of origin",
    expected: "pass",
    answer: 'Country of origin matches "Product of France", and 750 ML matches 750 mL.',
    application: {
      brandName: "Château Marcel",
      classType: "Red Wine",
      alcoholContent: "13.5%",
      netContents: "750 mL",
      bottler: "Marcel Imports, New York, NY",
      countryOfOrigin: "France",
    },
    printed: {
      brand: "CHÂTEAU MARCEL",
      tagline: "BORDEAUX · 2022",
      classType: "Red Wine",
      alcohol: "13.5% Alc. by Vol.",
      net: "750 ML",
      bottler: "Imported by Marcel Imports, New York, NY",
      country: "Product of France",
      warningHeading: "GOVERNMENT WARNING:",
      warningBody: WARNING_BODY,
      headingBold: true,
    },
    theme: { bg: "#fbf8f3", ink: "#4a1020", accent: "#8c2135" },
  },
  {
    id: "trailhead-ipa-photo",
    title: "Trailhead IPA",
    shows: "Photo taken at an angle, with glare",
    expected: "pass",
    answer: "Everything matches after the tool straightens the tilted photo.",
    application: {
      brandName: "Trailhead",
      classType: "India Pale Ale",
      alcoholContent: "6.8%",
      netContents: "12 fl oz",
      bottler: "Trailhead Brewing Co., Bend, Oregon",
      countryOfOrigin: "",
    },
    printed: {
      brand: "TRAILHEAD",
      tagline: "HOPPY · HAZY · BOLD",
      classType: "India Pale Ale",
      alcohol: "6.8% ALC/VOL",
      net: "12 FL. OZ.",
      bottler: "Brewed and canned by Trailhead Brewing Co., Bend, OR",
      warningHeading: "GOVERNMENT WARNING:",
      warningBody: WARNING_BODY,
      headingBold: true,
    },
    theme: { bg: "#fff4e0", ink: "#2b2b2b", accent: "#d9661f" },
    capture: "angled",
  },
  {
    id: "summit-reserve-whiskey",
    title: "Summit Reserve",
    shows: "Warning reworded and not bold",
    expected: "fail",
    answer:
      'Government warning: Problem. "serious" is added to the wording (shown highlighted), and the heading is not bold.',
    application: {
      brandName: "Summit Reserve",
      classType: "Straight Rye Whiskey",
      alcoholContent: "50% Alc./Vol. (100 Proof)",
      netContents: "750 mL",
      bottler: "Summit Reserve Distillers, Asheville, NC",
      countryOfOrigin: "",
    },
    printed: {
      brand: "SUMMIT RESERVE",
      tagline: "BOTTLED IN BOND",
      classType: "Straight Rye Whiskey",
      alcohol: "50% Alc./Vol. (100 Proof)",
      net: "750 mL",
      bottler: "Distilled and bottled by Summit Reserve Distillers, Asheville, NC",
      warningHeading: "GOVERNMENT WARNING:",
      warningBody: WARNING_BODY.replace("may cause health problems", "may cause serious health problems"),
      headingBold: false,
    },
    theme: { bg: "#f2efe8", ink: "#1f1f1f", accent: "#7a5c1e" },
  },
  {
    id: "blue-heron-brandy",
    title: "Blue Heron",
    shows: "Warning shrunk to tiny print",
    expected: "review",
    answer:
      "Government warning: Review. The warning is in tiny print, under half the height of the other small text, with the 2 mm minimum for this bottle size.",
    application: {
      brandName: "Blue Heron",
      classType: "Apple Brandy",
      alcoholContent: "40% Alc./Vol. (80 Proof)",
      netContents: "375 mL",
      bottler: "Blue Heron Orchards, Hood River, OR",
      countryOfOrigin: "",
    },
    printed: {
      brand: "BLUE HERON",
      tagline: "ORCHARD DISTILLED",
      classType: "Apple Brandy",
      alcohol: "40% Alc./Vol. (80 Proof)",
      net: "375 mL",
      bottler: "Distilled and bottled by Blue Heron Orchards, Hood River, OR",
      warningHeading: "GOVERNMENT WARNING:",
      warningBody: WARNING_BODY,
      headingBold: true,
      warningSize: 11,
    },
    theme: { bg: "#eef3f6", ink: "#183247", accent: "#4f7891" },
  },
];

const warning = { warningHeading: "GOVERNMENT WARNING:", warningBody: WARNING_BODY, headingBold: true };

/** More labels for the test kit, one rule each. Not shown as examples on the first screen. */
const MORE: Sample[] = [
  {
    id: "vino-del-sol-wine",
    title: "Vino del Sol",
    shows: "Net contents in centilitres",
    expected: "pass",
    answer: "Net contents match: 75 cL is the same as 750 mL. The bottler matches with Illinois spelled out.",
    application: {
      brandName: "Vino del Sol",
      classType: "Red Wine",
      alcoholContent: "13.5%",
      netContents: "750 mL",
      bottler: "Sol Imports, Chicago, IL",
      countryOfOrigin: "Spain",
    },
    printed: {
      brand: "VINO DEL SOL",
      tagline: "TEMPRANILLO · RIOJA",
      classType: "Red Wine",
      alcohol: "13.5% Alc. by Vol.",
      net: "75 cL",
      bottler: "Imported by Sol Imports, Chicago, Illinois",
      country: "Product of Spain",
      ...warning,
    },
    theme: { bg: "#fdf5e6", ink: "#5a1e12", accent: "#c0752a" },
  },
  {
    id: "kestrel-moor-scotch",
    title: "Kestrel Moor",
    shows: "Country written differently",
    expected: "pass",
    answer: "Country of origin matches: the label says Scotland, the application United Kingdom.",
    application: {
      brandName: "Kestrel Moor",
      classType: "Single Malt Scotch Whisky",
      alcoholContent: "43% Alc./Vol.",
      netContents: "750 mL",
      bottler: "Kestrel Moor Imports, Boston, MA",
      countryOfOrigin: "United Kingdom",
    },
    printed: {
      brand: "KESTREL MOOR",
      tagline: "AGED 12 YEARS",
      classType: "Single Malt Scotch Whisky",
      alcohol: "43% Alc./Vol. (86 Proof)",
      net: "750 mL",
      bottler: "Imported by Kestrel Moor Imports, Boston, MA",
      country: "Product of Scotland",
      ...warning,
    },
    theme: { bg: "#eceee6", ink: "#22301f", accent: "#6b5a2e" },
  },
  {
    id: "juniper-hollow-gin",
    title: "Juniper Hollow",
    shows: "Brand misspelled on the label",
    expected: "review",
    answer: 'Brand name: Review. The label says "JUNIPER HOLOW", one letter off from the application.',
    application: {
      brandName: "Juniper Hollow",
      classType: "American Dry Gin",
      alcoholContent: "44% Alc./Vol. (88 Proof)",
      netContents: "750 mL",
      bottler: "Green Mountain Spirits, Burlington, VT",
      countryOfOrigin: "",
    },
    printed: {
      // The bottler line must not repeat the brand, or the correct spelling there would be found instead.
      brand: "JUNIPER HOLOW",
      tagline: "SMALL BATCH",
      classType: "American Dry Gin",
      alcohol: "44% Alc./Vol. (88 Proof)",
      net: "750 mL",
      bottler: "Distilled and bottled by Green Mountain Spirits, Burlington, VT",
      ...warning,
    },
    theme: { bg: "#e9f0ec", ink: "#1e3a34", accent: "#5b8c7a" },
  },
  {
    id: "lone-pine-bourbon",
    title: "Lone Pine",
    shows: "Bottler's city differs",
    expected: "review",
    answer:
      "Bottler / producer: Review. Mostly matches, but the label says Dallas where the application says Austin.",
    application: {
      brandName: "Lone Pine",
      classType: "Texas Straight Bourbon Whiskey",
      alcoholContent: "47% Alc./Vol. (94 Proof)",
      netContents: "750 mL",
      bottler: "Lone Pine Distilling, Austin, TX",
      countryOfOrigin: "",
    },
    printed: {
      brand: "LONE PINE",
      tagline: "TEXAS · SINGLE BARREL",
      classType: "Texas Straight Bourbon Whiskey",
      alcohol: "47% Alc./Vol. (94 Proof)",
      net: "750 mL",
      bottler: "Distilled and bottled by Lone Pine Distilling, Dallas, TX",
      ...warning,
    },
    theme: { bg: "#f6efe3", ink: "#2f2416", accent: "#9c4a1a" },
  },
  {
    id: "cedar-point-blurry-photo",
    title: "Cedar Point",
    shows: "Out-of-focus photo",
    expected: "review",
    answer:
      "Review, with a note that the image is hard to read. Text that can't be read (the bottler, the warning) is sent for review, not called wrong.",
    application: {
      brandName: "Cedar Point",
      classType: "Blended Whiskey",
      alcoholContent: "40% Alc./Vol. (80 Proof)",
      netContents: "750 mL",
      bottler: "Cedar Point Spirits, Sandusky, OH",
      countryOfOrigin: "",
    },
    printed: {
      brand: "CEDAR POINT",
      tagline: "LAKESHORE BLEND",
      classType: "Blended Whiskey",
      alcohol: "40% Alc./Vol. (80 Proof)",
      net: "750 mL",
      bottler: "Blended and bottled by Cedar Point Spirits, Sandusky, OH",
      ...warning,
    },
    theme: { bg: "#f1f0ea", ink: "#26323a", accent: "#7d6b4f" },
    capture: "blurry",
  },
  {
    id: "silver-crown-tequila",
    title: "Silver Crown",
    shows: "Wrong brand name",
    expected: "fail",
    answer: "Brand name: Problem. The application says Silver Creek, the label Silver Crown.",
    application: {
      brandName: "Silver Creek",
      classType: "Blanco Tequila",
      alcoholContent: "40% Alc./Vol. (80 Proof)",
      netContents: "750 mL",
      bottler: "Agave Norte Imports, San Diego, CA",
      countryOfOrigin: "Mexico",
    },
    printed: {
      brand: "SILVER CROWN",
      tagline: "BLUE AGAVE",
      classType: "Blanco Tequila",
      alcohol: "40% Alc./Vol. (80 Proof)",
      net: "750 mL",
      bottler: "Imported by Agave Norte Imports, San Diego, CA",
      country: "Product of Mexico",
      ...warning,
    },
    theme: { bg: "#eef2f5", ink: "#1b2e4a", accent: "#4f7da8" },
  },
  {
    id: "prairie-wind-vodka",
    title: "Prairie Wind",
    shows: "Net contents don't match",
    expected: "fail",
    answer: "Net contents: Problem. The application says 750 mL, the label 700 mL.",
    application: {
      brandName: "Prairie Wind",
      classType: "Vodka",
      alcoholContent: "40% Alc./Vol. (80 Proof)",
      netContents: "750 mL",
      bottler: "Prairie Wind Distillers, Fargo, ND",
      countryOfOrigin: "",
    },
    printed: {
      brand: "PRAIRIE WIND",
      tagline: "WINTER WHEAT",
      classType: "Vodka",
      alcohol: "40% Alc./Vol. (80 Proof)",
      net: "700 mL",
      bottler: "Distilled and bottled by Prairie Wind Distillers, Fargo, ND",
      ...warning,
    },
    theme: { bg: "#f3f4ee", ink: "#2c3a28", accent: "#a88a3d" },
  },
  {
    id: "iron-gate-gin",
    title: "Iron Gate",
    shows: "Proof doesn't agree with the percentage",
    expected: "fail",
    answer: "Alcohol content: Problem. The percentage matches, but 45% is 90 proof, not the 80 printed.",
    application: {
      brandName: "Iron Gate",
      classType: "London Dry Gin",
      alcoholContent: "45% Alc./Vol.",
      netContents: "750 mL",
      bottler: "Iron Gate Distilling, Pittsburgh, PA",
      countryOfOrigin: "",
    },
    printed: {
      brand: "IRON GATE",
      tagline: "STEEL CITY",
      classType: "London Dry Gin",
      alcohol: "45% Alc./Vol. (80 Proof)",
      net: "750 mL",
      bottler: "Distilled and bottled by Iron Gate Distilling, Pittsburgh, PA",
      ...warning,
    },
    theme: { bg: "#eceff1", ink: "#22272b", accent: "#6d7a83" },
  },
  {
    id: "sandhill-bourbon",
    title: "Sandhill",
    shows: "Warning heading not bold",
    expected: "fail",
    answer: 'Government warning: Problem. "GOVERNMENT WARNING:" is not bold. The wording itself is correct.',
    application: {
      brandName: "Sandhill",
      classType: "Straight Bourbon Whiskey",
      alcoholContent: "46% Alc./Vol. (92 Proof)",
      netContents: "750 mL",
      bottler: "Sandhill Distillery, Lexington, KY",
      countryOfOrigin: "",
    },
    printed: {
      brand: "SANDHILL",
      tagline: "WHEATED · SMALL BATCH",
      classType: "Straight Bourbon Whiskey",
      alcohol: "46% Alc./Vol. (92 Proof)",
      net: "750 mL",
      bottler: "Distilled and bottled by Sandhill Distillery, Lexington, KY",
      ...warning,
      headingBold: false,
    },
    theme: { bg: "#f7f0e1", ink: "#3a2a17", accent: "#b5853b" },
  },
  {
    id: "wild-clover-mead",
    title: "Wild Clover",
    shows: "No government warning",
    expected: "fail",
    answer: "Government warning: Problem. No government warning found on the label.",
    application: {
      brandName: "Wild Clover",
      classType: "Honey Wine",
      alcoholContent: "12% Alc./Vol.",
      netContents: "750 mL",
      bottler: "Wild Clover Meadery, Madison, WI",
      countryOfOrigin: "",
    },
    printed: {
      brand: "WILD CLOVER",
      tagline: "WILDFLOWER HONEY",
      classType: "Honey Wine",
      alcohol: "12% Alc./Vol.",
      net: "750 mL",
      bottler: "Produced and bottled by Wild Clover Meadery, Madison, WI",
      warningHeading: "",
      warningBody: "",
      headingBold: true,
    },
    theme: { bg: "#fbf6df", ink: "#3d3412", accent: "#c79a1e" },
  },
  {
    id: "palm-cove-rum",
    title: "Palm Cove",
    shows: "Wrong country of origin",
    expected: "fail",
    answer: "Country of origin: Problem. The application says Jamaica, the label Barbados.",
    application: {
      brandName: "Palm Cove",
      classType: "Dark Rum",
      alcoholContent: "40% Alc./Vol. (80 Proof)",
      netContents: "750 mL",
      bottler: "Palm Cove Imports, Tampa, FL",
      countryOfOrigin: "Jamaica",
    },
    printed: {
      brand: "PALM COVE",
      tagline: "POT STILL · AGED 8 YEARS",
      classType: "Dark Rum",
      alcohol: "40% Alc./Vol. (80 Proof)",
      net: "750 mL",
      bottler: "Imported by Palm Cove Imports, Tampa, FL",
      country: "Product of Barbados",
      ...warning,
    },
    theme: { bg: "#f2eee4", ink: "#2b1d12", accent: "#2f7a6a" },
  },
  {
    id: "villa-rosetta-wine",
    title: "Villa Rosetta",
    shows: "Imported, but no country on the label",
    expected: "fail",
    answer: "Country of origin: Problem. The application says Italy; no country is on the label.",
    application: {
      brandName: "Villa Rosetta",
      classType: "White Wine",
      alcoholContent: "12.5% Alc. by Vol.",
      netContents: "750 mL",
      bottler: "Rosetta Wine Imports, Newark, NJ",
      countryOfOrigin: "Italy",
    },
    printed: {
      brand: "VILLA ROSETTA",
      tagline: "PINOT GRIGIO · 2023",
      classType: "White Wine",
      alcohol: "12.5% Alc. by Vol.",
      net: "750 mL",
      bottler: "Imported by Rosetta Wine Imports, Newark, New Jersey",
      ...warning,
    },
    theme: { bg: "#f9f7ee", ink: "#33401f", accent: "#9aa64a" },
  },
  {
    id: "old-tom-bourbon-small",
    title: "Old Tom Distillery, small",
    shows: "Image too small to read",
    expected: "pass",
    answer:
      "Couldn't check: the image is too small to read (400 × 533 pixels). It's turned back before any reading.",
    ...pick("old-tom-bourbon"),
    capture: "thumbnail",
  },
  {
    id: "night-owl-liqueur",
    title: "Night Owl",
    shows: "Image with no row in the CSV",
    expected: "pass",
    answer:
      'Not in applications.csv, so only the warning is checked: "Warning is correct; no application details to compare".',
    application: {
      brandName: "Night Owl",
      classType: "Coffee Liqueur",
      alcoholContent: "25% Alc./Vol. (50 Proof)",
      netContents: "750 mL",
      bottler: "Night Owl Spirits, Seattle, WA",
      countryOfOrigin: "",
    },
    printed: {
      brand: "NIGHT OWL",
      tagline: "COLD BREW COFFEE",
      classType: "Coffee Liqueur",
      alcohol: "25% Alc./Vol. (50 Proof)",
      net: "750 mL",
      bottler: "Produced and bottled by Night Owl Spirits, Seattle, WA",
      ...warning,
    },
    theme: { bg: "#ece7f1", ink: "#241b33", accent: "#6a4c93" },
  },
  {
    id: "red-barn-rye",
    title: "Red Barn",
    shows: "Row in the CSV with no image",
    expected: "pass",
    answer: 'Listed as "Missing image": the CSV has this application, but no image was included.',
    application: {
      brandName: "Red Barn",
      classType: "Straight Rye Whiskey",
      alcoholContent: "45% Alc./Vol. (90 Proof)",
      netContents: "750 mL",
      bottler: "Red Barn Distillery, Frederick, MD",
      countryOfOrigin: "",
    },
    printed: {
      brand: "RED BARN",
      classType: "Straight Rye Whiskey",
      alcohol: "45% Alc./Vol. (90 Proof)",
      net: "750 mL",
      bottler: "Distilled and bottled by Red Barn Distillery, Frederick, MD",
      ...warning,
    },
    theme: { bg: "#f6ece6", ink: "#4a1a12", accent: "#a33a2a" },
  },
];

function pick(id: string): Omit<Sample, "id" | "title" | "shows" | "expected" | "answer"> {
  const { application, printed, theme } = SAMPLES.find((s) => s.id === id)!;
  return { application, printed, theme };
}

/** What the batch screen should show for a file, in its own words. */
export type KitResult = "Match" | "Review" | "Problem" | "Couldn't check" | "Missing image";

export interface KitEntry {
  /** File name in the kit's labels folder. */
  file: string;
  sample: Sample;
  /** What this file tests, for the answer key. */
  tests: string;
  expected: KitResult;
  answer: string;
  /** The file name its applications.csv row uses, or null when the row is left out. */
  csvName: string | null;
  /** False for an application whose image is left out of the kit. */
  hasImage: boolean;
  /** Byte-for-byte copy of this other kit file. */
  copyOf?: string;
}

const RESULT: Record<Sample["expected"], KitResult> = { pass: "Match", review: "Review", fail: "Problem" };

/**
 * The downloadable test kit, in answer-key order: matches, reviews, problems,
 * then the cases that only a batch can show (a copy, a missing row, a missing image).
 */
export const TEST_KIT: KitEntry[] = (() => {
  const all = [...SAMPLES, ...MORE];
  const order = [
    "old-tom-bourbon",
    "stones-throw-gin",
    "chateau-marcel-wine",
    "vino-del-sol-wine",
    "kestrel-moor-scotch",
    "trailhead-ipa-photo",
    "blue-heron-brandy",
    "juniper-hollow-gin",
    "lone-pine-bourbon",
    "cedar-point-blurry-photo",
    "harbor-light-rum",
    "copper-ridge-vodka",
    "summit-reserve-whiskey",
    "silver-crown-tequila",
    "prairie-wind-vodka",
    "iron-gate-gin",
    "sandhill-bourbon",
    "wild-clover-mead",
    "palm-cove-rum",
    "villa-rosetta-wine",
    "old-tom-bourbon-small",
    "old-tom-bourbon-copy",
    "night-owl-liqueur",
    "red-barn-rye",
  ];
  const fileOf = (id: string) => `${String(order.indexOf(id) + 1).padStart(2, "0")}-${id}.jpg`;
  return order.map((id): KitEntry => {
    if (id === "old-tom-bourbon-copy") {
      const original = all.find((s) => s.id === "old-tom-bourbon")!;
      return {
        file: fileOf(id),
        sample: original,
        tests: "Same image under two names",
        expected: "Match",
        answer: `Match, and flagged as an exact copy of ${fileOf(original.id)}.`,
        csvName: fileOf(id),
        hasImage: true,
        copyOf: fileOf(original.id),
      };
    }
    const sample = all.find((s) => s.id === id)!;
    const file = fileOf(id);
    const entry: KitEntry = {
      file,
      sample,
      tests: sample.shows,
      expected: RESULT[sample.expected],
      answer: sample.answer,
      csvName: file,
      hasImage: true,
    };
    if (sample.capture === "thumbnail") entry.expected = "Couldn't check";
    if (id === "night-owl-liqueur") entry.csvName = null;
    if (id === "red-barn-rye") Object.assign(entry, { expected: "Missing image", hasImage: false });
    // A phone often saves .png where the spreadsheet says .jpg; matched on the name alone.
    if (id === "trailhead-ipa-photo") {
      entry.csvName = file.replace(/\.jpg$/, ".png");
      entry.tests += "; its CSV row says .png";
      entry.answer += ` Its CSV row says ${entry.csvName}, and it's matched anyway, ignoring the extension.`;
    }
    return entry;
  });
})();

export const TEST_KIT_DIR = "/test-kit";

export const sampleImageUrl = (s: Sample) =>
  `${TEST_KIT_DIR}/labels/${TEST_KIT.find((e) => e.sample === s && !e.copyOf)!.file}`;
