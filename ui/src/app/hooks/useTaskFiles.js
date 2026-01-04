import { useRef, useState } from 'react';
import { MAX_TASK_FILES } from '../constants.js';

function useTaskFiles() {
  const [taskFiles, setTaskFiles] = useState([]);
  const [taskFileError, setTaskFileError] = useState('');
  const [taskFileUploading, setTaskFileUploading] = useState(false);
  const taskFileInputRef = useRef(null);

  function handleTaskFilesSelected(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      return;
    }
    const combined = [...taskFiles, ...files];
    if (combined.length > MAX_TASK_FILES) {
      setTaskFileError(`Only ${MAX_TASK_FILES} files can be attached.`);
      setTaskFiles(combined.slice(0, MAX_TASK_FILES));
    } else {
      setTaskFiles(combined);
      setTaskFileError('');
    }
    event.target.value = '';
  }

  function handleRemoveTaskFile(index) {
    setTaskFiles((prev) => prev.filter((_, idx) => idx !== index));
  }

  function handleClearTaskFiles() {
    setTaskFiles([]);
    setTaskFileError('');
    if (taskFileInputRef.current) {
      taskFileInputRef.current.value = '';
    }
  }

  return {
    handleClearTaskFiles,
    handleRemoveTaskFile,
    handleTaskFilesSelected,
    setTaskFileError,
    setTaskFileUploading,
    setTaskFiles,
    taskFileError,
    taskFileInputRef,
    taskFileUploading,
    taskFiles
  };
}

export default useTaskFiles;
