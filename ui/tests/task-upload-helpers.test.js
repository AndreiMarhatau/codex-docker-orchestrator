import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addTaskAttachments,
  removeTaskAttachments,
  uploadTaskFiles
} from '../src/app/hooks/task-upload-helpers.js';
import { getStoredPassword, setStoredPassword } from '../src/auth-storage.js';

function installMockXhr({ responseText = '{}', status = 200, progressEvent } = {}) {
  global.XMLHttpRequest = class MockXMLHttpRequest {
    constructor() {
      this.headers = {};
      this.responseText = responseText;
      this.status = status;
      global.XMLHttpRequest.lastInstance = this;
      this.upload = {
        addEventListener: (event, handler) => {
          if (event === 'progress') {
            this.onUploadProgress = handler;
          }
        }
      };
    }

    open(method, url) {
      this.method = method;
      this.url = url;
    }

    setRequestHeader(name, value) {
      this.headers[name] = value;
    }

    send() {
      if (progressEvent) {
        this.onUploadProgress?.(progressEvent);
      }
      queueMicrotask(() => {
        this.onload?.();
      });
    }
  };
}

describe('task upload helpers', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('uploads files with progress and auth header', async () => {
    setStoredPassword('secret');
    installMockXhr({
      responseText: JSON.stringify({
        uploads: [{ path: '/tmp/file.txt', originalName: 'file.txt' }]
      }),
      progressEvent: {
        lengthComputable: true,
        loaded: 3,
        total: 6
      }
    });
    const setTaskFileUploading = vi.fn();
    const progressUpdates = [];
    const setTaskFileUploadProgress = vi.fn((value) => {
      progressUpdates.push(value);
    });

    const uploads = await uploadTaskFiles(
      [new File(['hello!'], 'file.txt', { type: 'text/plain' })],
      setTaskFileUploading,
      setTaskFileUploadProgress
    );

    expect(uploads).toEqual([{ path: '/tmp/file.txt', originalName: 'file.txt' }]);
    expect(setTaskFileUploading).toHaveBeenNthCalledWith(1, true);
    expect(setTaskFileUploading).toHaveBeenLastCalledWith(false);
    expect(progressUpdates).toContainEqual({ loaded: 0, percent: 0, total: 0 });
    expect(progressUpdates).toContainEqual({ loaded: 3, percent: 50, total: 6 });
    expect(progressUpdates).toContain(null);
    const xhr = global.XMLHttpRequest.lastInstance;
    expect(getStoredPassword()).toBe('secret');
    expect(xhr.headers).toEqual({ 'X-Orch-Password': 'secret' });
  });

  it('clears stored auth and emits auth-required on 401 uploads', async () => {
    setStoredPassword('secret');
    installMockXhr({
      status: 401,
      responseText: 'Unauthorized'
    });
    const authRequired = vi.fn();
    window.addEventListener('orch-auth-required', authRequired);

    await expect(
      uploadTaskFiles(
        [new File(['blocked'], 'blocked.txt', { type: 'text/plain' })],
        vi.fn(),
        vi.fn()
      )
    ).rejects.toThrow('Unauthorized');

    expect(getStoredPassword()).toBe('');
    expect(authRequired).toHaveBeenCalledTimes(1);
    window.removeEventListener('orch-auth-required', authRequired);
  });

  it('rejects malformed success payloads instead of dropping uploads', async () => {
    installMockXhr({
      status: 200,
      responseText: 'not-json'
    });

    await expect(
      uploadTaskFiles(
        [new File(['broken'], 'broken.txt', { type: 'text/plain' })],
        vi.fn(),
        vi.fn()
      )
    ).rejects.toThrow('File upload failed.');
  });

  it('returns null when add/remove attachment helpers have no work', async () => {
    expect(await addTaskAttachments('', [], vi.fn(), vi.fn())).toBeNull();
    expect(await removeTaskAttachments('', ['note.txt'])).toBeNull();
    expect(await removeTaskAttachments('task-1', [])).toBeNull();
  });

  it('removes task attachments through the JSON api helper', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ attachments: [{ name: 'note.txt' }] })
    });

    await expect(removeTaskAttachments('task-1', ['note.txt'])).resolves.toEqual([
      { name: 'note.txt' }
    ]);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/tasks/task-1/attachments',
      expect.objectContaining({
        method: 'DELETE'
      })
    );
  });
});
