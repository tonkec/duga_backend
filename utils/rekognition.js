const {
  DetectModerationLabelsCommand,
  RekognitionClient,
} = require('@aws-sdk/client-rekognition');

const rekognitionClient = new RekognitionClient({
  region: process.env.AWS_REGION || 'eu-central-1',
  credentials:
    process.env.AWS_S3_ACCESS_KEY_ID && process.env.AWS_S3_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
        }
      : undefined,
});

module.exports = {
  detectModerationLabels: (params) => ({
    promise: () =>
      rekognitionClient.send(new DetectModerationLabelsCommand(params)),
  }),
};
