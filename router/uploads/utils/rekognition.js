const { RekognitionClient, DetectModerationLabelsCommand } = require("@aws-sdk/client-rekognition");

const rekognition = new RekognitionClient({ region: process.env.AWS_REGION || "eu-central-1" });

async function moderateImageFromBytes(buffer) {
  const res = await rekognition.send(new DetectModerationLabelsCommand({
    Image: { Bytes: buffer },
    MinConfidence: 60, 
  }));
  return (res.ModerationLabels || []).map(l => ({
    name: l.Name,
    parent: l.ParentName,
    confidence: l.Confidence,
  }));
}

module.exports = { moderateImageFromBytes };