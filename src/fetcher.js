var modelManager = require('./model_manager'),
    collectionManager = require('./collection_manager');

module.exports = {
  fetch: function(config) {
    var resource;

    if (config.model) {
      resource = modelManager.get(config.model, config.id, config.data, config.options);
    } else {
      resource = collectionManager.get(config.collection, config.id, config.data, config.options);
    }
    resource.fetchCached(config.fetchOptions);

    return resource;
  }
};
