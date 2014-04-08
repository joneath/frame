var modelFactory = require('./model_factory');

module.exports = {
  get: function(type, identifier, attrs, options) {
    var id = type + ':',
        model;

    if (_.isFunction(identifier)) {
      id += identifier(attrs, options);
    } else {
      id += identifier;
    }
    model = Frame._appModels[id];

    if (model && model._TTL <= Date.now()) {
      model = null;
    }

    if (!model) {
      model = modelFactory(type, attrs, options);
      this.set(id, model);
    }
    return model;
  },

  set: function(identifier, model) {
    Frame._appModels[identifier] = model;
    // 5 minute TTL
    model._TTL = Date.now() + (model.cacheTTL || 60 * 5 * 1000);
    model.on('change', this._updateTTL);
  },

  destroy: function(identifier) {
    var model = Frame._appModels[identifier];
    model.off('change', this._updateTTL);
    delete Frame._appModels[identifier];
  },

  _updateTTL: function() {
    this._TTL = Date.now() + (this.cacheTTL || 60 * 5 * 1000);
  }
};
