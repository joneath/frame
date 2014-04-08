module.exports = function(type, models, options) {
  var collectionPath,
      Collection;

  if (!type || !_.isString(type)) {
    throw 'Collection type is required!';
  }

  collectionPath = Frame._app.get('collectionPath') + type;
  Collection = require(collectionPath);

  if (!Collection) {
    throw collectionPath + ' is an undefined collection';
  }
  return new Collection(models, options);
};
