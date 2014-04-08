module.exports = {
  get: function(type, identifier, models, options) {
    var id = type + ':' + identifier,
        collection = Frame._appCollections[id];

    if (collection && collection._TTL <= Date.now()) {
      collection = null;
    }
    if (!collection) {
      collection = Frame._collectionFactory(type, models, options);
      this.set(id, collection);
    }

    return collection;
  },

  set: function(identifier, collection) {
    Frame._appCollections[identifier] = collection;
    // 5 minute TTL
    collection._TTL = Date.now() + (collection.cacheTTL || 60 * 5 * 1000);
    collection.on('change', this._updateTTL);
  },

  destroy: function(identifier) {
    var collection = Frame._appCollections[identifier];
    collection.off('change', this._updateTTL);
    delete Frame._appCollections[identifier];
  },

  _updateTTL: function() {
    this._TTL = Date.now() + (this.cacheTTL || 60 * 5 * 1000);
  }
};
