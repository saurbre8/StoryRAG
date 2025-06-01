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
      console.log('S3 service initialized with Cognito credentials');
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
      console.log('File uploaded successfully:', result.Location);
      
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

    const key = `${this.getUserPrefix(userId)}${Date.now()}-${fileName}`;
    
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
      console.log('File content uploaded successfully:', result.Location);
      
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

  // Delete a file
  async deleteFile(key) {
    if (!this.s3) {
      throw new Error('S3 service not initialized');
    }

    const deleteParams = {
      Bucket: this.bucketName,
      Key: key
    };

    try {
      await this.s3.deleteObject(deleteParams).promise();
      console.log('File deleted successfully:', key);
      return { success: true };
    } catch (error) {
      console.error('Error deleting file:', error);
      throw new Error(`Delete failed: ${error.message}`);
    }
  }
}

export default new S3Service(); 