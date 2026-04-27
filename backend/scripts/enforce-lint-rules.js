const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SCANNED_DIRS = ['src', 'tests', 'scripts'];
const SCANNED_EXTENSIONS = new Set(['.js', '.cjs', '.mjs']);
const directiveName = ['eslint', 'disable'].join('-');
const FORBIDDEN_DIRECTIVE = new RegExp(`\\b${directiveName}(?:-next-line|-line)?\\b`);

function listFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(fullPath));
    } else if (SCANNED_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replaceAll(path.sep, '/');
}

function findForbiddenDirectives(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return text
    .split(/\r?\n/)
    .flatMap((line, index) =>
      FORBIDDEN_DIRECTIVE.test(line)
        ? [`${relative(filePath)}:${index + 1} contains forbidden ${directiveName} directive`]
        : []
    );
}

function main() {
  const failures = SCANNED_DIRS
    .flatMap((dir) => listFiles(path.join(ROOT, dir)))
    .flatMap(findForbiddenDirectives);
  if (failures.length === 0) {
    return;
  }
  console.error(failures.join('\n'));
  process.exit(1);
}

main();
