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
  return stripInternalAgentLeakage(repairMojibake(text).replace(/\ufeff/g, ''));
}

export function normalizeComparableText(text: string): string {
  return normalizeOutgoingWhatsAppText(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripInternalAgentLeakage(text: string): string {
  const leakIndex = findInternalLeakStart(text);
  const visibleText = leakIndex >= 0 ? text.slice(0, leakIndex) : text;
  return visibleText
    .split(/\r?\n/)
    .filter((line) => !isInternalLeakLine(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function findInternalLeakStart(text: string): number {
  const markers = [
    /^\s*(custom_theme|slides_json|tool_call|function_call|functionCall|functionResponse)\s*:/gim,
    /^\s*[-*]?\s*include_images\s*:/gim,
    /^\s*(wait,\s*should i|let'?s do it immediately|no need to ask|i must immediately|after creating it,\s*i must)\b/gim,
    /```(?:json|tool_code|function_call)?\s*[\r\n]+\s*\{[\s\S]*?"(?:custom_theme|slides_json|functionCall)"/gim,
  ];

  let first = -1;
  for (const marker of markers) {
    marker.lastIndex = 0;
    const match = marker.exec(text);
    if (match && (first === -1 || match.index < first)) first = match.index;
  }
  return first;
}

function isInternalLeakLine(line: string): boolean {
  return /^\s*(custom_theme|slides_json|tool_call|function_call|functionCall|functionResponse)\s*:/i.test(line)
    || /^\s*[-*]?\s*include_images\s*:/i.test(line)
    || /^\s*(wait,\s*should i|let'?s do it immediately|no need to ask|i must immediately|after creating it,\s*i must)\b/i.test(line);
}
