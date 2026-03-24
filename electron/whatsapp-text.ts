const MOJIBAKE_MARKERS = /(?:\u00c2|\u00c3|\u00e2|\u00f0|\u00ef|\ufffd)/;
const MOJIBAKE_SEQUENCE = /(?:\u00c2.|[\u00c3\u00e2\u00f0\u00ef].|\ufffd)/g;

function scoreMojibake(text: string): number {
  return (text.match(MOJIBAKE_SEQUENCE) || []).length;
}

function isMostlyPrintable(text: string): boolean {
  let printable = 0;
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127)) {
      printable += 1;
    }
  }

  return text.length === 0 || (printable / text.length) > 0.9;
}

export function repairMojibake(text: string): string {
  let current = text;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (!MOJIBAKE_MARKERS.test(current)) {
      break;
    }

    let repaired = current;
    try {
      repaired = Buffer.from(current, 'latin1').toString('utf8');
    } catch {
      break;
    }

    if (!repaired || !isMostlyPrintable(repaired)) {
      break;
    }

    if (scoreMojibake(repaired) >= scoreMojibake(current)) {
      break;
    }

    current = repaired;
  }

  return current;
}

export function normalizeOutgoingWhatsAppText(text: string): string {
  return repairMojibake(text).replace(/\ufeff/g, '');
}

export function normalizeComparableText(text: string): string {
  return normalizeOutgoingWhatsAppText(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

