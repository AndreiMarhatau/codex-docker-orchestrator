import { useRef, useState } from 'react';
import { MAX_TASK_IMAGES } from '../constants.js';
import { isSupportedTaskImage } from '../task-helpers.js';

function useTaskImages() {
  const [taskImages, setTaskImages] = useState([]);
  const [taskImageError, setTaskImageError] = useState('');
  const [taskImageUploading, setTaskImageUploading] = useState(false);
  const taskImageInputRef = useRef(null);

  function handleTaskImagesSelected(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      return;
    }
    const nextImages = [];
    const errors = [];
    for (const file of files) {
      if (!isSupportedTaskImage(file)) {
        errors.push(`Unsupported image: ${file.name}`);
        continue;
      }
      nextImages.push(file);
    }
    const combined = [...taskImages, ...nextImages];
    if (combined.length > MAX_TASK_IMAGES) {
      errors.push(`Only ${MAX_TASK_IMAGES} images can be attached.`);
    }
    setTaskImages(combined.slice(0, MAX_TASK_IMAGES));
    setTaskImageError(errors.join(' '));
    event.target.value = '';
  }

  function handleRemoveTaskImage(index) {
    setTaskImages((prev) => prev.filter((_, idx) => idx !== index));
  }

  function handleClearTaskImages() {
    setTaskImages([]);
    setTaskImageError('');
    if (taskImageInputRef.current) {
      taskImageInputRef.current.value = '';
    }
  }

  return {
    handleClearTaskImages,
    handleRemoveTaskImage,
    handleTaskImagesSelected,
    setTaskImageError,
    setTaskImageUploading,
    setTaskImages,
    taskImageError,
    taskImageInputRef,
    taskImageUploading,
    taskImages
  };
}

export default useTaskImages;
