const DIFF_META_PREFIXES = ['diff --git', 'index ', '--- ', '+++ '];

function isDiffMetaLine(line) {
  return DIFF_META_PREFIXES.some((prefix) => line.startsWith(prefix));
}

function parseHunkHeader(line) {
  const match = /@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
  if (!match) {
    return null;
  }
  return {
    oldStart: Number(match[1]),
    newStart: Number(match[3])
  };
}

function createRow(type, oldLine, newLine, content) {
  return {
    type,
    oldLine,
    newLine,
    content
  };
}

function appendHunkRow(line, state, rows) {
  if (!line.startsWith('@@')) {
    return false;
  }
  const parsed = parseHunkHeader(line);
  if (parsed) {
    state.oldLine = parsed.oldStart;
    state.newLine = parsed.newStart;
    state.hasHunk = true;
  }
  rows.push(createRow('hunk', '', '', line));
  return true;
}

function appendMetaRow(line, rows) {
  if (!line.startsWith('\\ No newline')) {
    return false;
  }
  rows.push(createRow('meta', '', '', line));
  return true;
}

function appendAddRow(line, state, rows) {
  if (!line.startsWith('+') || line.startsWith('+++')) {
    return false;
  }
  rows.push(createRow('add', '', state.newLine ?? '', line.slice(1)));
  if (state.newLine !== null) {
    state.newLine += 1;
  }
  return true;
}

function appendDelRow(line, state, rows) {
  if (!line.startsWith('-') || line.startsWith('---')) {
    return false;
  }
  rows.push(createRow('del', state.oldLine ?? '', '', line.slice(1)));
  if (state.oldLine !== null) {
    state.oldLine += 1;
  }
  return true;
}

function appendContextRow(line, state, rows) {
  if (!state.hasHunk) {
    return false;
  }
  const content = line.startsWith(' ') ? line.slice(1) : line;
  rows.push(createRow('context', state.oldLine ?? '', state.newLine ?? '', content));
  if (state.oldLine !== null) {
    state.oldLine += 1;
  }
  if (state.newLine !== null) {
    state.newLine += 1;
  }
  return true;
}

function getDiffStats(diffText) {
  if (!diffText) {
    return { additions: 0, deletions: 0 };
  }
  const lines = diffText.split('\n');
  let additions = 0;
  let deletions = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line && index === lines.length - 1) {
      continue;
    }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      additions += 1;
      continue;
    }
    if (line.startsWith('-') && !line.startsWith('---')) {
      deletions += 1;
    }
  }
  return { additions, deletions };
}

function buildDiffRows(diffText) {
  if (!diffText) {
    return [];
  }
  const lines = diffText.split('\n');
  const rows = [];
  const state = {
    oldLine: null,
    newLine: null,
    hasHunk: false
  };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line && index === lines.length - 1) {
      continue;
    }
    if (appendHunkRow(line, state, rows)) {
      continue;
    }
    if (appendMetaRow(line, rows)) {
      continue;
    }
    if (isDiffMetaLine(line)) {
      continue;
    }
    if (appendAddRow(line, state, rows)) {
      continue;
    }
    if (appendDelRow(line, state, rows)) {
      continue;
    }
    if (appendContextRow(line, state, rows)) {
      continue;
    }
    rows.push(createRow('meta', '', '', line));
  }
  return rows;
}

export { buildDiffRows, getDiffStats };
