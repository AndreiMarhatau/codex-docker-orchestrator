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

    const resolvedResponse =
      typeof response === 'function'
        ? await response({
            url,
            method,
            options,
            body: (() => {
              if (!options.body) {
                return null;
              }
              try {
                return JSON.parse(options.body);
              } catch (error) {
                return options.body;
              }
            })()
          })
        : response;

    if (resolvedResponse && typeof resolvedResponse === 'object' && resolvedResponse.delay) {
      await new Promise((resolve) => setTimeout(resolve, resolvedResponse.delay));
    }

    if (resolvedResponse.ok === false) {
      return {
        ok: false,
        status: resolvedResponse.status ?? 500,
        text: async () => resolvedResponse.text ?? 'Request failed.'
      };
    }

    return {
      ok: true,
      status: resolvedResponse.status ?? 200,
      json: async () => resolvedResponse.body ?? resolvedResponse
    };
  });
}

export default mockApi;
