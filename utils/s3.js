const {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION || process.env.AWS_REGION || 'eu-central-1',
  followRegionRedirects: true,
  credentials:
    process.env.AWS_S3_ACCESS_KEY_ID && process.env.AWS_S3_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
        }
      : undefined,
});

const withPromise = (command) => ({
  promise: () => s3Client.send(command),
});

const s3 = {
  deleteObject: (params) => withPromise(new DeleteObjectCommand(params)),
  deleteObjects: (params) => withPromise(new DeleteObjectsCommand(params)),
  getObject: (params) => withPromise(new GetObjectCommand(params)),
  headObject: (params) => withPromise(new HeadObjectCommand(params)),
  listObjectsV2: (params) => withPromise(new ListObjectsV2Command(params)),
  putObject: (params) => withPromise(new PutObjectCommand(params)),
};

module.exports = s3;
