import { apiRequest, apiUrl } from '../../api.js';
import { clearStoredPassword, emitAuthRequired, getStoredPassword } from '../../auth-storage.js';

function authHeaders() {
  const password = getStoredPassword();
  return password ? { 'X-Orch-Password': password } : {};
}

function parseJson(text) {
  if (!text || !text.trim()) {
    throw new Error('File upload failed.');
  }
  return JSON.parse(text);
}

function uploadFilesWithProgress(path, taskFiles, setTaskFileUploading, setTaskFileUploadProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    taskFiles.forEach((file) => {
      formData.append('files', file);
    });

    xhr.open('POST', apiUrl(path));
    const headers = authHeaders();
    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    xhr.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable) {
        return;
      }
      setTaskFileUploadProgress({
        loaded: event.loaded,
        percent: event.total > 0 ? (event.loaded / event.total) * 100 : 0,
        total: event.total
      });
    });

    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setTaskFileUploadProgress({
          loaded: taskFiles.reduce((sum, file) => sum + (file.size || 0), 0),
          percent: 100,
          total: taskFiles.reduce((sum, file) => sum + (file.size || 0), 0)
        });
        try {
          resolve(parseJson(xhr.responseText));
        } catch (error) {
          reject(new Error('File upload failed.'));
        }
        return;
      }
      if (xhr.status === 401) {
        clearStoredPassword();
        emitAuthRequired();
      }
      reject(new Error(xhr.responseText || 'File upload failed.'));
    };

    xhr.onerror = () => {
      reject(new Error('File upload failed.'));
    };

    xhr.onabort = () => {
      reject(new Error('File upload was cancelled.'));
    };

    setTaskFileUploading(true);
    setTaskFileUploadProgress({ loaded: 0, percent: 0, total: 0 });
    xhr.send(formData);
  }).finally(() => {
    setTaskFileUploading(false);
  });
}

async function uploadTaskFiles(taskFiles, setTaskFileUploading, setTaskFileUploadProgress) {
  if (taskFiles.length === 0) {
    return [];
  }
  try {
    const uploadPayload = await uploadFilesWithProgress(
      '/api/uploads/files',
      taskFiles,
      setTaskFileUploading,
      setTaskFileUploadProgress
    );
    return uploadPayload.uploads || [];
  } finally {
    setTaskFileUploadProgress(null);
  }
}

async function addTaskAttachments(
  taskId,
  taskFiles,
  setTaskFileUploading,
  setTaskFileUploadProgress
) {
  if (!taskId || taskFiles.length === 0) {
    return null;
  }
  try {
    const payload = await uploadFilesWithProgress(
      `/api/tasks/${taskId}/attachments`,
      taskFiles,
      setTaskFileUploading,
      setTaskFileUploadProgress
    );
    return payload.attachments || [];
  } finally {
    setTaskFileUploadProgress(null);
  }
}

async function removeTaskAttachments(taskId, names) {
  if (!taskId || !Array.isArray(names) || names.length === 0) {
    return null;
  }
  const payload = await apiRequest(`/api/tasks/${taskId}/attachments`, {
    method: 'DELETE',
    body: JSON.stringify({ names })
  });
  return payload.attachments || [];
}

export { addTaskAttachments, removeTaskAttachments, uploadTaskFiles };
