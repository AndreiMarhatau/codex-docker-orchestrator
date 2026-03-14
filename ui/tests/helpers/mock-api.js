async function resolveResponse(responses, { url, method, options = {}, body = null }) {
  const key = `${method} ${url}`;
  const response = responses[key] ?? responses[url];

  if (!response && url === '/api/settings/password') {
    return {
      ok: true,
      status: 200,
      body: { hasPassword: false }
    };
  }

  if (!response && url === '/api/settings/auth') {
    return {
      ok: true,
      status: 204,
      body: {}
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
          body
        })
      : response;

  if (resolvedResponse && typeof resolvedResponse === 'object' && resolvedResponse.delay) {
    await new Promise((resolve) => setTimeout(resolve, resolvedResponse.delay));
  }

  if (resolvedResponse.ok === false) {
    return {
      ok: false,
      status: resolvedResponse.status ?? 500,
      text: resolvedResponse.text ?? 'Request failed.'
    };
  }

  return {
    ok: true,
    status: resolvedResponse.status ?? 200,
    body: resolvedResponse.body ?? resolvedResponse
  };
}

function parseFetchBody(body) {
  if (!body) {
    return null;
  }
  try {
    return JSON.parse(body);
  } catch (error) {
    return body;
  }
}

function computeUploadSize(body) {
  if (!body || typeof body.entries !== 'function') {
    return 0;
  }
  let total = 0;
  for (const [, value] of body.entries()) {
    if (value && typeof value.size === 'number') {
      total += value.size;
    }
  }
  return total;
}

function createMockXmlHttpRequest(responses) {
  return class MockXMLHttpRequest {
    constructor() {
      this.headers = {};
      this.method = 'GET';
      this.responseText = '';
      this.status = 0;
      this.url = '';
      this.upload = {
        addEventListener: (event, handler) => {
          if (event === 'progress') {
            this.uploadProgressHandler = handler;
          }
        }
      };
    }

    open(method, url) {
      this.method = method.toUpperCase();
      this.url = url;
    }

    setRequestHeader(name, value) {
      this.headers[name] = value;
    }

    async send(body) {
      try {
        const total = computeUploadSize(body);
        if (this.uploadProgressHandler && total > 0) {
          this.uploadProgressHandler({
            lengthComputable: true,
            loaded: total / 2,
            total
          });
        }
        const resolved = await resolveResponse(responses, {
          url: this.url,
          method: this.method,
          options: { body, headers: this.headers },
          body
        });
        if (this.uploadProgressHandler) {
          this.uploadProgressHandler({
            lengthComputable: total > 0,
            loaded: total,
            total
          });
        }
        this.status = resolved.status;
        if (!resolved.ok) {
          this.responseText = resolved.text;
          this.onload?.();
          return;
        }
        this.responseText = JSON.stringify(resolved.body);
        this.onload?.();
      } catch (error) {
        this.onerror?.(error);
      }
    }
  };
}

function mockApi(responses) {
  global.XMLHttpRequest = createMockXmlHttpRequest(responses);
  global.fetch.mockImplementation(async (input, options = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const method = (options.method || 'GET').toUpperCase();
    const resolvedResponse = await resolveResponse(responses, {
      url,
      method,
      options,
      body: parseFetchBody(options.body)
    });

    if (!resolvedResponse.ok) {
      return {
        ok: false,
        status: resolvedResponse.status,
        text: async () => resolvedResponse.text
      };
    }

    return {
      ok: true,
      status: resolvedResponse.status,
      json: async () => resolvedResponse.body
    };
  });
}

export default mockApi;
