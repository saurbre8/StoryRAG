import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import './FileUploader.css';

const FileUploader = ({ onFilesUploaded }) => {
  const [isDragActive, setIsDragActive] = useState(false);

  const onDrop = useCallback(async (acceptedFiles) => {
    // Filter for markdown files only
    const markdownFiles = acceptedFiles.filter(file => 
      file.name.endsWith('.md') || file.type === 'text/markdown'
    );

    if (markdownFiles.length === 0) {
      alert('No .md files found in the uploaded content. Please upload folders or files containing markdown files.');
      return;
    }

    console.log(`Found ${markdownFiles.length} markdown files out of ${acceptedFiles.length} total files`);

    // Read file contents
    const filesWithContent = await Promise.all(
      markdownFiles.map(async (file) => {
        const content = await file.text();
        return {
          name: file.name,
          size: file.size,
          content: content,
          lastModified: file.lastModified,
          path: file.webkitRelativePath || file.name // Include folder path if available
        };
      })
    );

    onFilesUploaded(filesWithContent);
  }, [onFilesUploaded]);

  const { getRootProps, getInputProps, isDragActive: dropzoneActive } = useDropzone({
    onDrop,
    multiple: true,
    // Remove file type restrictions to allow any files (we'll filter manually)
    noClick: false,
    noKeyboard: false
  });

  return (
    <div className="file-uploader">
      <div 
        {...getRootProps()} 
        className={`dropzone ${dropzoneActive || isDragActive ? 'active' : ''}`}
      >
        <input 
          {...getInputProps()} 
          webkitdirectory=""
          directory=""
        />
        <div className="dropzone-content">
          <div className="upload-icon">📁</div>
          {dropzoneActive || isDragActive ? (
            <div>
              <h3>Drop your files or folders here!</h3>
              <p>Release to upload (only .md files will be processed)</p>
            </div>
          ) : (
            <div>
              <h3>Drag & drop files or folders here</h3>
              <p>or <span className="click-text">click to browse</span></p>
              <p className="file-types">Automatically filters for .md files only</p>
              <div className="upload-options">
                <div className="option">📄 Individual files</div>
                <div className="option">📂 Entire folders</div>
                <div className="option">🗂️ Multiple folders</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileUploader;
