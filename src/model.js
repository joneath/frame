var modelManager = require('./model_manager'),
    mediator = require('./mediator'),
    mixin = require('./mixin'),
    namedParamRegex = /(\(\?)?:\w+/g,
    Model;

module.exports = Model = Backbone.Model.extend({
  mediator: mediator,

  initialize: function(attrs, options) {
    var Resource, nestedResource, fieldName, data;
    options || (options = {});
    this._nested = options.nested;
    this._resourceUrl = this.urlRoot;
    this.urlRoot = this._url;
    this.associated = _.extend({}, options.associated);
    this.expandFields = options.expandFields || this.expandFields;
    this.setFetched(!!options.fetched);

    if (this.expandFields) {
      _.each(this.expandFields, function(expandConfig) {
        // Blow up field string to find field name, model/collection name
        expandConfig = expandConfig.split('>');
        fieldName = expandConfig[0];
        data = this.get(fieldName);
        // Support implicit expand config - no collection/model specified
        if (expandConfig.length == 1) {
          if (data.length) {
            expandConfig.push('collections');
          } else {
            expandConfig.push('models');
          }
          expandConfig.push('base');
        }
        Resource = require(expandConfig[1] + '/' + expandConfig[2]);
        nestedResource = new Resource(data);
        this._watchNested(fieldName, nestedResource);
        this.associated[fieldName] = nestedResource;
      }, this);
    }
    this.init.apply(this, arguments);

    return this;
  },

  init: function() {},

  _urlRoot: function() {
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

  _watchNested: function(fieldName, resource) {
    var boundUpdate = _.bind(this._updateNested, this, fieldName, resource);
    this.listenTo(resource, 'change', boundUpdate);
    this.listenTo(resource, 'add', boundUpdate);
    this.listenTo(resource, 'remove', boundUpdate);
  },

  _updateNested: function(fieldName, resource) {
    this.set(fieldName, resource.toJSON());
  },

  store: function(id) {
    modelManager.set(id, this);
  },

  reset: function(attrs, options) {
    attrs || (attrs = {});
    this.clear(options);
    this.set(attrs, options);
  },

  collectionAt: function() {
    return this.collection.indexOf(this);
  },

  isFetched: function() {
    return this._fetched;
  },

  setFetched: function(fetched) {
    this._fetched = fetched;
    fetched && (this.promise = $.Deferred().resolve(this));
  },

  fetch: function() {
    this.promise = Backbone.Model.prototype.fetch.apply(this, arguments)
    .then(function() {
      this.trigger('fetched');
      this.setFetched(true);
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
  },

  when: function(attr, value) {
    var promise = $.Deferred(),
        actualValue = this.get(attr);

    if ((value && actualValue === value) ||
      (_.isUndefined(value) && actualValue)) {
      promise.resolve.call(this, this, actualValue);
    }
    this.on('change:' + attr, function(model, newValue) {
      if ((_.isUndefined(value) && !!newValue) ||
        newValue === value) {
        promise.resolve.apply(this, arguments);
      }
    });

    return promise;
  },

  save: function(attrs, options) {
    this.trigger('save');
    var savePromise = this.promise = Backbone.Model.prototype.save.apply(this, arguments);
    if (savePromise) {
      savePromise.then(function() {
        if (this.collection && this.collection.modelName != 'base') {
          this.store(this.collection.modelName + ':' + this.id);
        }
        this.setFetched(true);
        this.trigger('save:success');
      }.bind(this))
      .fail(function(jqXHR) {
        this.trigger('save:failed', jqXHR);
      }.bind(this));
    } else {
      this.trigger('save:invalid');
    }

    return savePromise;
  }
});
// Add mixin method
Model.mixin = mixin;
