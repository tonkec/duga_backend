const BUCKET = 'duga-user-photo';
const FIELD_NAME = 'avatars';
const MAX_FILE_MB = 2;

const EXPLICIT_BLOCK_THRESHOLD = Number(process.env.EXPLICIT_BLOCK_THRESHOLD ?? 0.90); 
const SUGGESTIVE_BLOCK_THRESHOLD = Number(process.env.SUGGESTIVE_BLOCK_THRESHOLD ?? 0.75); 


const EXPLICIT_LABELS = new Set([
  'Explicit Nudity',
  'Sexual Activity',
  'Sexual Situations',
  'Non-Explicit Nudity',
  'Non-Explicit Nudity of Intimate parts and Kissing',
  'Partially Exposed Female Breast',
]);

// Labels to block as suggestive
const SUGGESTIVE_LABELS = new Set([
  'Suggestive',
  'Revealing Clothes',
  'Implied Nudity',
  'Swimwear or Underwear',
  'Female Swimwear or Underwear',
]);

module.exports = {
  BUCKET,
  FIELD_NAME,
  MAX_FILE_MB,
  EXPLICIT_BLOCK_THRESHOLD,
  SUGGESTIVE_BLOCK_THRESHOLD,
  EXPLICIT_LABELS,
  SUGGESTIVE_LABELS,
};