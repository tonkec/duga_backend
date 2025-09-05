const s3 = require('../../../utils/s3');
const Upload = require('./../../../models').Upload;
const PhotoComment = require('./../../../models').PhotoComment;
const Message = require('./../../../models').Message;
const removeSpacesAndDashes = require('./../../../utils/removeSpacesAndDashes');


const streamS3File = async (key, res) => {
  console.log('🔍 Requested key:', key);

  let file = await Upload.findOne({ where: { url: key } });

  if (!file) {
    console.log('🔍 Not found in Upload. Checking PhotoComment.imageUrl...');
    const commentWithImage = await PhotoComment.findOne({ where: { imageUrl: key } });

    if (commentWithImage) {
      console.log('✅ Found in PhotoComment.imageUrl');
      file = { url: commentWithImage.imageUrl };
    }
  }

  if (!file) {
    console.log('🔍 Not found in Comment. Checking Message.messagePhotoUrl...');
    const messageWithImage = await Message.findOne({ where: { messagePhotoUrl: key } });

    if (messageWithImage) {
      console.log('✅ Found in Message.messagePhotoUrl');
      file = { url: messageWithImage.messagePhotoUrl };
    }
  }

  if (!file) {
    console.log('❌ Not found in Upload, Comment, or Message');
    res.status(404).json({ message: 'File not found in DB' });
    return;
  }

  const normalizedKey = removeSpacesAndDashes(key).startsWith(`${process.env.NODE_ENV}/`)
    ? key
    : `${process.env.NODE_ENV}/${removeSpacesAndDashes(key)}`;

  const s3Stream = s3
    .getObject({
      Bucket: 'duga-user-photo',
      Key: normalizedKey.toLowerCase(),
    })
    .createReadStream();

  s3Stream.on('error', (err) => {
    console.error('❌ Stream error:', err);
    res.status(404).json({ message: 'Image not found on S3' });
  });

  res.setHeader('Content-Type', 'image/png');
  s3Stream.pipe(res);
};

module.exports = streamS3File;