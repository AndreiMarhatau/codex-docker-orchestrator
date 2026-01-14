function mockApi(responses) {
  global.fetch.mockImplementation(async (input, options = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const method = (options.method || 'GET').toUpperCase();
    const key = `${method} ${url}`;
    const response = responses[key] ?? responses[url];

    if (!response && url === '/api/settings/password') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ hasPassword: false })
      };
    }

    if (!response && url === '/api/settings/auth') {
      return {
        ok: true,
        status: 204,
        json: async () => ({})
      };
    }

    if (!response) {
      throw new Error(`Unhandled request: ${url}`);
    }

    if (response && typeof response === 'object' && response.delay) {
      await new Promise((resolve) => setTimeout(resolve, response.delay));
    }

    if (response.ok === false) {
      return {
        ok: false,
        status: response.status ?? 500,
        text: async () => response.text ?? 'Request failed.'
      };
    }

    return {
      ok: true,
      status: response.status ?? 200,
      json: async () => response.body ?? response
    };
  });
}

export default mockApi;
