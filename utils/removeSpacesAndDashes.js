export const removeSpacesAndDashes = (str) => {
  return str.replace(/[\s-]/g, '');
};

module.exports = removeSpacesAndDashes