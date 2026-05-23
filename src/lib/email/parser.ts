import * as cheerio from "cheerio";

export interface ParsedLoad {
  brokerReference: string | null;
  broker: string | null;
  brokerContact: string | null;
  brokerPhone: string | null;
  brokerEmail: string | null;
  pickupAddress: string | null;
  pickupZip: string | null;
  pickupDate: Date | null;
  deliveryAddress: string | null;
  deliveryDate: Date | null;
  miles: number | null;
  rate: number | null;
  vehicleRequired: string | null;
  weight: number | null;
  pieces: number | null;
  dimensionL: number | null;
  dimensionW: number | null;
  dimensionH: number | null;
}

// "05/18/26 12:00 EST" → Date
function parseDateTime(raw: string): Date | null {
  const match = raw.match(/(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, month, day, year, hour, minute] = match;
  return new Date(`20${year}-${month}-${day}T${hour}:${minute}:00`);
}

// "Forest Park, GA 30297" → "30297"
function extractZip(address: string): string | null {
  const match = address.match(/\b(\d{5})\b/);
  return match ? match[1] : null;
}

// "$0.00" → 0
function parseDollar(raw: string): number | null {
  const match = raw.replace(/,/g, "").match(/[\d.]+/);
  return match ? parseFloat(match[0]) : null;
}

// "5,925 lbs" → 5925
function parseLbs(raw: string): number | null {
  const match = raw.replace(/,/g, "").match(/[\d.]+/);
  return match ? parseFloat(match[0]) : null;
}

// "2 STOPS, 206 MILES" → 206
function parseMiles(raw: string): number | null {
  const match = raw.match(/([\d,]+)\s*MILES/i);
  return match ? parseFloat(match[1].replace(/,/g, "")) : null;
}

// "48L x 40W x 82H" → { L, W, H }
function parseDimensions(raw: string): { L: number; W: number; H: number } | null {
  const match = raw.match(/(\d+(?:\.\d+)?)\s*L\s*x\s*(\d+(?:\.\d+)?)\s*W\s*x\s*(\d+(?:\.\d+)?)\s*H/i);
  if (!match) return null;
  return { L: parseFloat(match[1]), W: parseFloat(match[2]), H: parseFloat(match[3]) };
}

export function parseSylectusEmail(html: string): ParsedLoad {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const $: any = cheerio.load(html);

  // Pull the text value that follows a bold label like "Broker Name:"
  function labelValue(label: string): string {
    let result = "";
    $("b, strong").each((_: number, el: cheerio.Element) => {
      const text = $(el).text().trim();
      if (text.toLowerCase().startsWith(label.toLowerCase())) {
        const full = $(el).parent().text();
        result = full.slice(full.indexOf(text) + text.length).trim();
        return false;
      }
    });
    return result;
  }

  // ── Order # from "Bid on Order #4225" ──────────────────────────────────────
  let brokerReference: string | null = null;
  $("*").each((_: number, el: cheerio.Element) => {
    const text = $(el).clone().children().remove().end().text().trim();
    const m = text.match(/Bid on Order\s*#(\w+)/i);
    if (m) { brokerReference = m[1]; return false; }
  });

  // ── Miles from "206 MILES" or "2 STOPS, 206 MILES" ────────────────────────
  let miles: number | null = null;
  $("*").each((_: number, el: cheerio.Element) => {
    const text = $(el).clone().children().remove().end().text().trim();
    const m = parseMiles(text);
    if (m !== null) { miles = m; return false; }
  });

  // ── Pickup & Delivery ───────────────────────────────────────────────────────
  let pickupAddress: string | null = null;
  let pickupDate: Date | null = null;
  let deliveryAddress: string | null = null;
  let deliveryDate: Date | null = null;

  $("td, div, p").each((_: number, el: cheerio.Element) => {
    const text = $(el).text().trim();
    const lines = text.split(/\n/).map((l: string) => l.trim()).filter(Boolean);

    if (/Pick-?Up/i.test(lines[0] ?? "") && !pickupAddress) {
      const data = lines.filter((l: string) => !/Pick-?Up/i.test(l));
      if (data[0]) pickupAddress = data[0];
      if (data[1]) pickupDate = parseDateTime(data[1]);
    }

    if (/^Delivery$/i.test(lines[0] ?? "") && !deliveryAddress) {
      const data = lines.filter((l: string) => !/^Delivery$/i.test(l));
      if (data[0]) deliveryAddress = data[0];
      if (data[1]) deliveryDate = parseDateTime(data[1]);
    }
  });

  // ── Labeled fields ──────────────────────────────────────────────────────────
  const dims = parseDimensions(labelValue("Dimensions:"));

  return {
    brokerReference,
    broker:          labelValue("Broker Company:") || null,
    brokerContact:   labelValue("Broker Name:")    || null,
    brokerPhone:     labelValue("Broker Phone:")   || null,
    brokerEmail:     labelValue("Email:")          || null,
    pickupAddress,
    pickupZip:       pickupAddress ? extractZip(pickupAddress) : null,
    pickupDate,
    deliveryAddress,
    deliveryDate,
    miles,
    rate:            parseDollar(labelValue("Posted Amount:")),
    vehicleRequired: labelValue("Vehicle required:") || null,
    weight:          parseLbs(labelValue("Weight:")),
    pieces:          parseInt(labelValue("Pieces:"), 10) || null,
    dimensionL:      dims?.L ?? null,
    dimensionW:      dims?.W ?? null,
    dimensionH:      dims?.H ?? null,
  };
}
