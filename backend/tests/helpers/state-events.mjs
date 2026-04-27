export function createResponseRecorder() {
  return {
    statusCode: null,
    headers: {},
    chunks: [],
    writeHead(code, headers) {
      this.statusCode = code;
      this.headers = headers;
    },
    write(chunk) {
      this.chunks.push(chunk);
    }
  };
}
