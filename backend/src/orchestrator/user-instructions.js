const fs = require('node:fs');
const path = require('node:path');

function readUserInstructions(codexHome) {
  if (!codexHome) {
    return '';
  }
  const configPath = path.join(codexHome, 'config.toml');
  if (!fs.existsSync(configPath)) {
    return '';
  }

  let content = '';
  try {
    content = fs.readFileSync(configPath, 'utf8');
  } catch {
    return '';
  }

  const multilineBasic = content.match(/^\s*developer_instructions\s*=\s*"""([\s\S]*?)"""\s*$/m);
  if (multilineBasic?.[1]) {
    return multilineBasic[1].trim();
  }

  const multilineLiteral = content.match(/^\s*developer_instructions\s*=\s*'''([\s\S]*?)'''\s*$/m);
  if (multilineLiteral?.[1]) {
    return multilineLiteral[1].trim();
  }

  const basic = content.match(/^\s*developer_instructions\s*=\s*"((?:[^"\\]|\\.)*)"\s*$/m);
  if (basic?.[1]) {
    try {
      return JSON.parse(`"${basic[1]}"`).trim();
    } catch {
      return '';
    }
  }

  const literal = content.match(/^\s*developer_instructions\s*=\s*'([^']*)'\s*$/m);
  if (literal?.[1]) {
    return literal[1].trim();
  }

  return '';
}

module.exports = {
  readUserInstructions
};
