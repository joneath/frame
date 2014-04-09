var modelFactory = require('./model_factory'),
    collectionFactory = require('./collection_factory');

module.exports = {
  get: function(config) {
    var id = config.resource + ':',
        resource,
        data;

    config.options || (config.options = {});
    data = config.options.data;
    delete config.options.data;

    if (_.isFunction(config.id)) {
      id += config.id(data, config.options);
    } else {
      id += config.id;
    }
    resource = Frame._store[id];

    // check if resource is stale
    if (resource && resource._TTL <= Date.now()) {
      resource = null;
      this.destroy(id);
    }

    if (!resource) {
      try {
        resource = modelFactory(config.resource, data, config.options);
      } catch(e) {
        try {
          resource = collectionFactory(config.type, data, config.options);
        } catch(e) {
          throw new Error('Resource (' + config.resource + ') was not found as either model or collection');
        }
      }
      this.set(id, resource);
    }

    return resource;
  },

  set: function(id, resource, TTL) {
    Frame._store[id] = resource;

    if (TTL) {
      // Default to a 5 minute TTL
      if (TTL === true) {
        TTL = 60 * 5 * 1000;
      }
      resource._TTL = Date.now() + TTL;
    }
  },

  destroy: function(id) {
    var exists = Frame._store[id];
    delete Frame._store[id];
    return exists;
  }
};
