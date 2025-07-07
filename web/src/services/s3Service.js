/**
 * S3 Service
 * 
 * Features:
 * - Secure file uploads using AWS Cognito identity credentials
 * - Project-based file organization with user isolation
 * - Markdown file storage and retrieval for worldbuilding content
 * - Project metadata management (.project files)
 * - Progress tracking for file uploads
 * - Comprehensive error handling and validation
 * - User-specific folder structure (users/{userId}/{projectName}/)
 * - File listing and search capabilities within projects
 * - Project creation and management operations
 * 
 * File Structure:
 * - users/{userId}/ - User's root folder
 * - users/{userId}/{projectName}/ - Project folders
 * - users/{userId}/{projectName}/.project - Project metadata file
 * - users/{userId}/{projectName}/file.md - Project files
 * 
 * Authentication:
 * - Uses AWS Cognito Identity Pool for temporary credentials
 * - Integrates with Cognito User Pool for user authentication
 * - Provides secure, user-isolated access to S3 resources
 * 
 * Integration:
 * - Works with FileUploader for file uploads
 * - Provides data for ProjectManager component
 * - Supplies file content to EditTab for viewing
 * - Coordinates with embedService for AI processing
 */
import AWS from 'aws-sdk';

class S3Service {
  constructor() {
    this.s3 = null;
    this.bucketName = process.env.REACT_APP_S3_BUCKET_NAME || 'story-rag';
  }

  // Initialize S3 with Cognito credentials
  initializeWithCognito(cognitoUser) {
    try {
      // Get the identity token from the authenticated user
      const idToken = cognitoUser.id_token;
      
      // Configure AWS SDK to use Cognito Identity
      AWS.config.update({
        region: process.env.REACT_APP_AWS_REGION || 'us-east-1',
        credentials: new AWS.CognitoIdentityCredentials({
          IdentityPoolId: process.env.REACT_APP_COGNITO_IDENTITY_POOL_ID,
          Logins: {
            [`cognito-idp.${process.env.REACT_APP_AWS_REGION || 'us-east-1'}.amazonaws.com/${process.env.REACT_APP_COGNITO_USER_POOL_ID}`]: idToken
          }
        })
      });

      this.s3 = new AWS.S3();
      return true;
    } catch (error) {
      console.error('Failed to initialize S3 service:', error);
      return false;
    }
  }

  // Generate a user-specific key prefix
  getUserPrefix(userId) {
    return `users/${userId}/`;
  }

  // Generate a project-specific key prefix
  getProjectPrefix(userId, projectName) {
    return `users/${userId}/${projectName}/`;
  }

  // Create a project folder (by uploading a .project metadata file)
  async createProject(userId, projectName, description = '') {
    if (!this.s3) {
      throw new Error('S3 service not initialized');
    }

    const key = `${this.getProjectPrefix(userId, projectName)}.project`;
    const projectMetadata = {
      name: projectName,
      description: description,
      createdAt: new Date().toISOString(),
      userId: userId,
      updatedAt: new Date().toISOString(),
      settings: {
        systemPrompt: null,
        scoreThreshold: 0.5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };

    const uploadParams = {
      Bucket: this.bucketName,
      Key: key,
      Body: JSON.stringify(projectMetadata, null, 2),
      ContentType: 'application/json',
      Metadata: {
        'project-name': projectName,
        'created-timestamp': new Date().toISOString(),
        'user-id': userId
      }
    };

    try {
      const result = await this.s3.upload(uploadParams).promise();
      //console.log('Project created successfully:', projectName);
      
      return {
        success: true,
        projectName: projectName,
        key: key,
        location: result.Location,
        etag: result.ETag
      };
    } catch (error) {
      console.error('Error creating project:', error);
      throw new Error(`Project creation failed: ${error.message}`);
    }
  }

  // List user's projects by scanning S3 structure
  async listUserProjects(userId) {
    if (!this.s3) {
      throw new Error('S3 service not initialized');
    }

    const listParams = {
      Bucket: this.bucketName,
      Prefix: `users/${userId}/`,
      Delimiter: '/'
    };

    try {
      const result = await this.s3.listObjectsV2(listParams).promise();
      
      // Extract project names from common prefixes (folders)
      const projectFolders = result.CommonPrefixes?.map(prefix => {
        const parts = prefix.Prefix.split('/');
        return parts[parts.length - 2]; // Get project name from path
      }) || [];

      // Get project metadata for each project
      const projectDetails = await Promise.all(
        projectFolders.map(async (projectName) => {
          try {
            const projectMetadataKey = `users/${userId}/${projectName}/.project`;
            const projectFile = await this.downloadFile(projectMetadataKey);
            const metadata = JSON.parse(projectFile.content);
            
            // Also get file count for this project
            const fileCount = await this.getProjectFileCount(userId, projectName);
            
            return {
              name: projectName,
              description: metadata.description || '',
              createdAt: metadata.createdAt || null,
              fileCount: fileCount,
              ...metadata
            };
          } catch (error) {
            // If no .project file exists, return basic info
            //console.log(`No metadata found for project ${projectName}, using defaults`);
            const fileCount = await this.getProjectFileCount(userId, projectName);
            
            return {
              name: projectName,
              description: '',
              createdAt: null,
              fileCount: fileCount
            };
          }
        })
      );

      return projectDetails.sort((a, b) => {
        // Sort by creation date, newest first
        if (!a.createdAt && !b.createdAt) return 0;
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    } catch (error) {
      console.error('Error listing projects:', error);
      throw new Error(`Failed to list projects: ${error.message}`);
    }
  }

  // Get count of files in a project
  async getProjectFileCount(userId, projectName) {
    try {
      const listParams = {
        Bucket: this.bucketName,
        Prefix: this.getProjectPrefix(userId, projectName)
      };

      const result = await this.s3.listObjectsV2(listParams).promise();
      // Filter out .project metadata files
      const fileCount = result.Contents?.filter(item => !item.Key.endsWith('.project')).length || 0;
      return fileCount;
    } catch (error) {
      console.error('Error getting project file count:', error);
      return 0;
    }
  }

  // Upload file content to a specific project with folder structure
  async uploadFileContentToProject(fileName, content, userId, projectName, filePath = null, onProgress = null) {
    if (!this.s3) {
      throw new Error('S3 service not initialized');
    }

    // Use the full path if provided, otherwise just the filename
    const fileKey = filePath || fileName;
    const key = `${this.getProjectPrefix(userId, projectName)}${fileKey}`;
    
    const uploadParams = {
      Bucket: this.bucketName,
      Key: key,
      Body: content,
      ContentType: 'text/markdown',
      Metadata: {
        'original-name': fileName,
        'upload-timestamp': new Date().toISOString(),
        'content-length': content.length.toString(),
        'project-name': projectName,
        'user-id': userId
      }
    };

    try {
      const upload = this.s3.upload(uploadParams);
      
      // Track upload progress if callback provided
      if (onProgress) {
        upload.on('httpUploadProgress', (progress) => {
          const percentCompleted = Math.round((progress.loaded * 100) / progress.total);
          onProgress(percentCompleted);
        });
      }

      const result = await upload.promise();
      //console.log('File content uploaded to project successfully:', result.Location);
      
      return {
        success: true,
        key: key,
        location: result.Location,
        etag: result.ETag,
        projectName: projectName
      };
    } catch (error) {
      console.error('Error uploading file content to project:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  // List files in a specific project
  async listProjectFiles(userId, projectName) {
    if (!this.s3) {
      throw new Error('S3 service not initialized');
    }

    const listParams = {
      Bucket: this.bucketName,
      Prefix: this.getProjectPrefix(userId, projectName)
    };

    try {
      const result = await this.s3.listObjectsV2(listParams).promise();
      return result.Contents
        .filter(item => !item.Key.endsWith('.project')) // Exclude metadata files
        .map(item => ({
          key: item.Key,
          name: item.Key.split('/').pop(),
          size: item.Size,
          lastModified: item.LastModified,
          etag: item.ETag,
          projectName: projectName
        }));
    } catch (error) {
      console.error('Error listing project files:', error);
      throw new Error(`Failed to list project files: ${error.message}`);
    }
  }

  // Get all files from all projects for a user
  async getAllUserProjectFiles(userId) {
    if (!this.s3) {
      throw new Error('S3 service not initialized');
    }

    try {
      // First get all projects
      const projects = await this.listUserProjects(userId);
      
      // Then get files for each project
      const allFiles = [];
      for (const project of projects) {
        const projectFiles = await this.listProjectFiles(userId, project.name);
        allFiles.push(...projectFiles);
      }
      
      return allFiles;
    } catch (error) {
      console.error('Error getting all user project files:', error);
      throw new Error(`Failed to get user files: ${error.message}`);
    }
  }

  // Upload a file to S3
  async uploadFile(file, userId, onProgress = null) {
    if (!this.s3) {
      throw new Error('S3 service not initialized');
    }

    const key = `${this.getUserPrefix(userId)}${Date.now()}-${file.name}`;
    
    const uploadParams = {
      Bucket: this.bucketName,
      Key: key,
      Body: file,
      ContentType: file.type || 'text/markdown',
      Metadata: {
        'original-name': file.name,
        'upload-timestamp': new Date().toISOString(),
        'file-size': file.size.toString()
      }
    };

    try {
      const upload = this.s3.upload(uploadParams);
      
      // Track upload progress if callback provided
      if (onProgress) {
        upload.on('httpUploadProgress', (progress) => {
          const percentCompleted = Math.round((progress.loaded * 100) / progress.total);
          onProgress(percentCompleted);
        });
      }

      const result = await upload.promise();
      //console.log('File uploaded successfully:', result.Location);
      
      return {
        success: true,
        key: key,
        location: result.Location,
        etag: result.ETag
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  // Upload file content as text (for markdown files)
  async uploadFileContent(fileName, content, userId) {
    if (!this.s3) {
      throw new Error('S3 service not initialized');
    }

    const key = `${this.getUserPrefix(userId)}${fileName}`;
    
    const uploadParams = {
      Bucket: this.bucketName,
      Key: key,
      Body: content,
      ContentType: 'text/markdown',
      Metadata: {
        'original-name': fileName,
        'upload-timestamp': new Date().toISOString(),
        'content-length': content.length.toString()
      }
    };

    try {
      const result = await this.s3.upload(uploadParams).promise();
      //console.log('File content uploaded successfully:', result.Location);
      
      return {
        success: true,
        key: key,
        location: result.Location,
        etag: result.ETag
      };
    } catch (error) {
      console.error('Error uploading file content:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  // List user's files
  async listUserFiles(userId) {
    if (!this.s3) {
      throw new Error('S3 service not initialized');
    }

    const listParams = {
      Bucket: this.bucketName,
      Prefix: this.getUserPrefix(userId)
    };

    try {
      const result = await this.s3.listObjectsV2(listParams).promise();
      return result.Contents.map(item => ({
        key: item.Key,
        name: item.Key.split('/').pop(),
        size: item.Size,
        lastModified: item.LastModified,
        etag: item.ETag
      }));
    } catch (error) {
      console.error('Error listing files:', error);
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  // Download a file
  async downloadFile(key) {
    if (!this.s3) {
      throw new Error('S3 service not initialized');
    }

    const downloadParams = {
      Bucket: this.bucketName,
      Key: key
    };

    try {
      const result = await this.s3.getObject(downloadParams).promise();
      return {
        content: result.Body.toString(),
        metadata: result.Metadata,
        contentType: result.ContentType
      };
    } catch (error) {
      console.error('Error downloading file:', error);
      throw new Error(`Download failed: ${error.message}`);
    }
  }

  // Delete a file from S3
  async deleteFile(fileKey) {
    if (!this.s3) {
      throw new Error('S3 service not initialized');
    }

    const deleteParams = {
      Bucket: this.bucketName,
      Key: fileKey
    };

    try {
      await this.s3.deleteObject(deleteParams).promise();
      //console.log('File deleted successfully:', fileKey);
      return { success: true };
    } catch (error) {
      console.error('Error deleting file:', error);
      throw new Error(`Delete failed: ${error.message}`);
    }
  }

  // Move a file from one location to another
  async moveFile(oldKey, newKey) {
    if (!this.s3) {
      throw new Error('S3 service not initialized');
    }

    try {
      // Copy object to new location (server-side operation, no download)
      const copyParams = {
        Bucket: this.bucketName,
        CopySource: `${this.bucketName}/${oldKey}`,
        Key: newKey,
        MetadataDirective: 'COPY' // Copy all metadata from source
      };

      await this.s3.copyObject(copyParams).promise();
      //console.log(`File copied from ${oldKey} to ${newKey}`);

      // Delete the original file
      await this.deleteFile(oldKey);
      //console.log(`Original file deleted: ${oldKey}`);

      return {
        success: true,
        oldKey: oldKey,
        newKey: newKey
      };
    } catch (error) {
      console.error('Error moving file:', error);
      throw new Error(`Move failed: ${error.message}`);
    }
  }

  // Save project settings to .project file
  async saveProjectSettings(userId, projectName, settings) {
    if (!this.s3) {
      throw new Error('S3 service not initialized');
    }

    const projectKey = `${this.getProjectPrefix(userId, projectName)}.project`;

    try {
      // First, load the existing .project file
      let existingProject = {};
      try {
        const result = await this.downloadFile(projectKey);
        existingProject = JSON.parse(result.content);
      } catch (error) {
        // If .project file doesn't exist, we'll create it
        console.log('No existing .project file found, creating new one');
      }

      // Merge settings into the project file
      const updatedProject = {
        ...existingProject,
        settings: {
          ...existingProject.settings,
          ...settings,
          updatedAt: new Date().toISOString()
        },
        // Ensure we don't lose the original project metadata
        updatedAt: new Date().toISOString()
      };

      const uploadParams = {
        Bucket: this.bucketName,
        Key: projectKey,
        Body: JSON.stringify(updatedProject, null, 2),
        ContentType: 'application/json'
      };

      await this.s3.upload(uploadParams).promise();
      return updatedProject.settings;
    } catch (error) {
      console.error('Error saving project settings:', error);
      throw new Error(`Failed to save settings: ${error.message}`);
    }
  }

  // Load project settings from .project file
  async loadProjectSettings(userId, projectName) {
    if (!this.s3) {
      throw new Error('S3 service not initialized');
    }

    const projectKey = `${this.getProjectPrefix(userId, projectName)}.project`;

    try {
      const result = await this.downloadFile(projectKey);
      const projectData = JSON.parse(result.content);
      
      // Return settings if they exist, otherwise return defaults
      const settings = projectData.settings || {};
      
      // Ensure we have all required default values
      return {
        systemPrompt: settings.systemPrompt || null,
        scoreThreshold: settings.scoreThreshold !== undefined ? settings.scoreThreshold : 0.5,
        createdAt: settings.createdAt || new Date().toISOString(),
        updatedAt: settings.updatedAt || new Date().toISOString()
      };
    } catch (error) {
      // If .project file doesn't exist, create it with defaults
      if (error.message.includes('NoSuchKey') || error.message.includes('does not exist')) {
        const defaultSettings = {
          systemPrompt: null,
          scoreThreshold: 0.5,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        try {
          // Create the .project file with defaults
          const defaultProject = {
            name: projectName,
            description: '',
            createdAt: new Date().toISOString(),
            userId: userId,
            settings: defaultSettings
          };

          const uploadParams = {
            Bucket: this.bucketName,
            Key: projectKey,
            Body: JSON.stringify(defaultProject, null, 2),
            ContentType: 'application/json'
          };

          await this.s3.upload(uploadParams).promise();
          return defaultSettings;
        } catch (createError) {
          console.error('Error creating default .project file:', createError);
          // If we can't create the file, still return defaults
          return defaultSettings;
        }
      }
      // For other errors, rethrow
      throw error;
    }
  }
}

export default new S3Service(); 