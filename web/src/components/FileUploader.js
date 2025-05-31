import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import './FileUploader.css';

const FileUploader = ({ onFilesUploaded }) => {
  const [isDragActive, setIsDragActive] = useState(false);

  const onDrop = useCallback(async (acceptedFiles) => {
    // Filter for markdown files
    const markdownFiles = acceptedFiles.filter(file => 
      file.name.endsWith('.md') || file.type === 'text/markdown'
    );

    if (markdownFiles.length === 0) {
      alert('Please upload only .md (markdown) files');
      return;
    }

    // Read file contents
    const filesWithContent = await Promise.all(
      markdownFiles.map(async (file) => {
        const content = await file.text();
        return {
          name: file.name,
          size: file.size,
          content: content,
          lastModified: file.lastModified
        };
      })
    );

    onFilesUploaded(filesWithContent);
  }, [onFilesUploaded]);

  const { getRootProps, getInputProps, isDragActive: dropzoneActive } = useDropzone({
    onDrop,
    accept: {
      'text/markdown': ['.md'],
      'text/plain': ['.md']
    },
    multiple: true,
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
    onDropAccepted: () => setIsDragActive(false),
    onDropRejected: () => setIsDragActive(false)
  });

  return (
    <div className="file-uploader">
      <div 
        {...getRootProps()} 
        className={`dropzone ${dropzoneActive || isDragActive ? 'active' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="dropzone-content">
          <div className="upload-icon">📁</div>
          {dropzoneActive || isDragActive ? (
            <div>
              <h3>Drop your markdown files here!</h3>
              <p>Release to upload</p>
            </div>
          ) : (
            <div>
              <h3>Drag & drop markdown files here</h3>
              <p>or <span className="click-text">click to browse</span></p>
              <p className="file-types">Supports: .md files</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileUploader;
