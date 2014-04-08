module.exports = function(type, models, options) {
  var collectionsPath,
      Collection;

  if (!type || !_.isString(type)) {
    throw 'Collection type is required!';
  }

  collectionsPath = 'collections/' + type;
  Collection = require(collectionsPath);

  if (!Collection) {
    throw collectionsPath + ' is an undefined collection';
  }
  return new Collection(models, options);
};
