import { apiRequest, apiUrl } from '../../api.js';
import { getStoredPassword } from '../../auth-storage.js';

function authHeaders() {
  const password = getStoredPassword();
  return password ? { 'X-Orch-Password': password } : {};
}

async function uploadTaskImages(taskImages, setTaskImageUploading) {
  if (taskImages.length === 0) {
    return [];
  }
  setTaskImageUploading(true);
  try {
    const formData = new FormData();
    taskImages.forEach((file) => {
      formData.append('images', file);
    });
    const response = await fetch(apiUrl('/api/uploads'), {
      method: 'POST',
      body: formData,
      headers: authHeaders()
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Image upload failed.');
    }
    const uploadPayload = await response.json();
    return (uploadPayload.uploads || []).map((upload) => upload.path);
  } finally {
    setTaskImageUploading(false);
  }
}

async function uploadTaskFiles(taskFiles, setTaskFileUploading) {
  if (taskFiles.length === 0) {
    return [];
  }
  setTaskFileUploading(true);
  try {
    const formData = new FormData();
    taskFiles.forEach((file) => {
      formData.append('files', file);
    });
    const response = await fetch(apiUrl('/api/uploads/files'), {
      method: 'POST',
      body: formData,
      headers: authHeaders()
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'File upload failed.');
    }
    const uploadPayload = await response.json();
    return uploadPayload.uploads || [];
  } finally {
    setTaskFileUploading(false);
  }
}

async function addTaskAttachments(taskId, taskFiles, setTaskFileUploading) {
  if (!taskId || taskFiles.length === 0) {
    return null;
  }
  setTaskFileUploading(true);
  try {
    const formData = new FormData();
    taskFiles.forEach((file) => {
      formData.append('files', file);
    });
    const response = await fetch(apiUrl(`/api/tasks/${taskId}/attachments`), {
      method: 'POST',
      body: formData,
      headers: authHeaders()
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Attachment upload failed.');
    }
    const payload = await response.json();
    return payload.attachments || [];
  } finally {
    setTaskFileUploading(false);
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

export { addTaskAttachments, removeTaskAttachments, uploadTaskFiles, uploadTaskImages };
