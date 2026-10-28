import type { Application } from "./types";
import { WARNING_BODY } from "./warning";

/**
 * Test labels, each aimed at a case from the discovery interviews.
 * `printed` is what scripts/make-samples.ts draws onto the image;
 * `application` is what the agent would type in from the COLA form.
 */
export interface Sample {
  id: string;
  title: string;
  /** What this sample demonstrates, shown on the "try an example" buttons. */
  shows: string;
  expected: "pass" | "review" | "fail";
  application: Application;
  printed: {
    brand: string;
    tagline?: string;
    classType: string;
    alcohol: string;
    net: string;
    bottler: string;
    country?: string;
    warningHeading: string;
    warningBody: string;
    headingBold: boolean;
    /** Warning type size in px on a 1200 x 1600 label; 25 is normal. */
    warningSize?: number;
  };
  theme: { bg: string; ink: string; accent: string };
  /** Shot at an angle with glare, like a phone photo of a bottle. */
  photo?: boolean;
}

export const SAMPLES: Sample[] = [
  {
    id: "old-tom-bourbon",
    title: "Old Tom Distillery",
    shows: "Everything correct",
    expected: "pass",
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
    photo: true,
  },
  {
    id: "summit-reserve-whiskey",
    title: "Summit Reserve",
    shows: "Warning reworded and not bold",
    expected: "fail",
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

export const sampleImageUrl = (s: Sample) => `/samples/${s.id}.jpg`;
