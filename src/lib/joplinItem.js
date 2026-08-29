// src/lib/joplinItem.js
// (De)serializes Joplin's sync item text format, mirroring
// BaseItem.serialize/unserialize in laurent22/joplin (packages/lib/models/BaseItem.ts)
// closely enough to round-trip a note's title/body without disturbing any
// other property line.
//
// Format: `<title>\n\n<body>\n\n<prop>: <value>\n...\ntype_: 1`
// Properties are whatever trailing contiguous non-blank lines precede the
// last blank line in the text — that works even when the body itself
// contains blank lines, because every prop line is guaranteed non-empty
// (`key: value`) and the join always inserts exactly one blank line before
// the property block.

export function parseItem(text) {
  const lines = text.split('\n');
  const propLines = [];
  let separatorIndex = -1;

  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim() === '') {
      separatorIndex = i;
      break;
    }
    propLines.unshift(lines[i]);
  }

  const bodyBlock = separatorIndex >= 0 ? lines.slice(0, separatorIndex) : [];
  const title = bodyBlock.length ? bodyBlock[0] : '';
  const body = bodyBlock.slice(2).join('\n');

  return { title, body, propLines };
}

export function updateItem(parsed, { title, body }) {
  const nowIso = new Date().toISOString();
  const propLines = parsed.propLines.map((line) =>
    line.startsWith('updated_time:') ? `updated_time: ${nowIso}` : line,
  );
  return { title, body, propLines };
}

export function serializeItem(parsed) {
  return [parsed.title, parsed.body, parsed.propLines.join('\n')]
    .filter((part) => part !== '')
    .join('\n\n');
}
