var Model = require('./model'),
    collectionManager = require('./collection_manager'),
    mediator = require('./mediator'),
    mixin = require('./mixin'),
    namedParamRegex = /(\(\?)?:\w+/g,
    Collection;

module.exports = Collection = Backbone.Collection.extend({
  mediator: mediator,
  model: Model,
  modelName: 'base',

  initialize: function(items, options) {
    options || (options = {});
    this.setFetched(!!options.fetched);
    this._resourceId = options.resourceId;
    this._nested = options.nested;
    this._resourceUrl = this.url;
    this.url = this._url;
    this.allowEmpty = this.allowEmpty;
    this.init.apply(this, arguments);
  },

  init: function() {},

  _url: function() {
    var url = _.result(this, '_resourceUrl'),
        i = 0;

    if (!url) {
      throw 'url is required to fetch resource';
    }
    // Replace placeholder url fragments
    url = url.replace(namedParamRegex, function(val) {
      val = this._nested[i];
      i += 1;
      return val;
    }.bind(this));

    return url;
  },

  // Override prepareModel to remove new this.model
  _prepareModel: function(attrs, options) {
    if (attrs instanceof Backbone.Model) return attrs;
    options = options ? _.clone(options) : {};
    options.collection = this;
    var model = this._model(attrs, options);
    if (!model.validationError) return model;
    this.trigger('invalid', this, model.validationError, options);
    return false;
  },

  _model: function(attrs, options) {
    var model;

    if (this.model) {
      model = new this.model(attrs, options);
      if (model.id && this.modelName != 'base') {
        model.store(this.modelName + ':' + model.id);
      }
    } else {
      model = new Frame.Model(attrs, options);
    }

    if (_.keys(attrs).length > 1) {
      model.setFetched(true);
    }

    return model;
  },

  move: function(model, toIndex) {
    var fromIndex = this.indexOf(model);
    if (fromIndex == -1) {
      throw new Error('Can\'t move a model that\'s not in the collection');
    }
    if (fromIndex !== toIndex) {
      this.models.splice(toIndex, 0, this.models.splice(fromIndex, 1)[0]);
    }
    this.trigger('move', model, fromIndex, toIndex);
  },

  store: function(id) {
    collectionManager.set(id, this);
  },

  isFetched: function() {
    return this._fetched;
  },

  setFetched: function(fetched) {
    this._fetched = fetched;
    fetched && (this.promise = $.Deferred().resolve(this));
  },

  fetch: function() {
    this.promise = Backbone.Collection.prototype.fetch.apply(this, arguments)
    .then(function() {
      (this.length || this.allowEmpty) && this.setFetched(true);
      this.trigger('fetched');
      return this;
    }.bind(this));
    this.trigger('fetch', this.promise);

    return this.promise;
  },

  fetchCached: function(options) {
    if (this.isFetched()) {
      return $.Deferred().resolve(this);
    } else if (this.promise && this.promise.state() === 'pending') {
      return this.promise;
    } else {
      return this.fetch(options);
    }
  }
});
// Add mixin method
Collection.mixin = mixin;
