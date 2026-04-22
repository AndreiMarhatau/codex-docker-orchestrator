const fs = require('node:fs');
const path = require('node:path');

const originalWriteFile = fs.promises.writeFile.bind(fs.promises);

fs.promises.writeFile = async (file, data, options) => {
  try {
    return await originalWriteFile(file, data, options);
  } catch (error) {
    if (error?.code === 'ENOENT' && typeof file === 'string') {
      await fs.promises.mkdir(path.dirname(file), { recursive: true });
      return originalWriteFile(file, data, options);
    }
    throw error;
  }
};
