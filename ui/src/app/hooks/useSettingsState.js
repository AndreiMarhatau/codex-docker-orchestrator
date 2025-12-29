import { useState } from 'react';
import { apiRequest } from '../../api.js';

function useSettingsState({ setError }) {
  const [imageInfo, setImageInfo] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageUpdating, setImageUpdating] = useState(false);

  async function refreshImageInfo() {
    setImageLoading(true);
    try {
      const info = await apiRequest('/api/settings/image');
      setImageInfo(info);
    } catch (err) {
      setError(err.message);
    } finally {
      setImageLoading(false);
    }
  }

  async function handlePullImage() {
    setError('');
    setImageUpdating(true);
    try {
      const info = await apiRequest('/api/settings/image/pull', { method: 'POST' });
      setImageInfo(info);
    } catch (err) {
      setError(err.message);
    } finally {
      setImageUpdating(false);
    }
  }

  return {
    handlePullImage,
    imageInfo,
    imageLoading,
    imageUpdating,
    refreshImageInfo
  };
}

export default useSettingsState;
