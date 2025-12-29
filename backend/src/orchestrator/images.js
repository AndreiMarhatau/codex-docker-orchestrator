function attachImageMethods(Orchestrator) {
  Orchestrator.prototype.getImageInfo = async function getImageInfo() {
    const imageName = this.imageName;
    const result = await this.exec('docker', [
      'image',
      'inspect',
      '--format',
      '{{.Id}}|{{.Created}}',
      imageName
    ]);
    if (result.code !== 0) {
      return {
        imageName,
        present: false,
        imageId: null,
        imageCreatedAt: null
      };
    }
    const output = result.stdout.trim();
    const [imageId, imageCreatedAt] = output.split('|');
    return {
      imageName,
      present: true,
      imageId: imageId || null,
      imageCreatedAt: imageCreatedAt || null
    };
  };

  Orchestrator.prototype.pullImage = async function pullImage() {
    await this.execOrThrow('docker', ['pull', this.imageName]);
    return this.getImageInfo();
  };
}

module.exports = {
  attachImageMethods
};
