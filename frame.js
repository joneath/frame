(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports = Backbone.Model.extend({
  defaults: {
    followLinks: true,
    routes: {}
  },

  initialize: function(config) {
    config && this.set(config);

    if (this.get('followLinks')) {
      this._linkHelper = new Frame.LinkHelper();
    }

    this._dispatcher = new Frame.Dispatcher({
      routes: this.get('routes')
    });

    Frame._app = this;

    // Allow app to get fully initialized before routes fire
    _.defer(function() {
      Backbone.history.start({
        pushState: true
      });
    });
  }
});

},{}],2:[function(require,module,exports){
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

},{"./collection_manager":4,"./mediator":10,"./mixin":11,"./model":12}],3:[function(require,module,exports){
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

},{}],4:[function(require,module,exports){
module.exports = {
  get: function(type, identifier, models, options) {
    var id = type + ':' + identifier,
        collection = Frame._appCollections[id];

    if (collection && collection._TTL <= Date.now()) {
      collection = null;
    }
    if (!collection) {
      collection = Frame.collectionFactory(type, models, options);
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

},{}],5:[function(require,module,exports){
var modelManager = require('./model_manager'),
    collectionManager = require('./collection_manager'),
    fetcher = require('./fetcher'),
    mediator = require('./mediator'),
    mixin = require('./mixin'),
    controllerOptions = ['bodyClass', 'el'],
    Controller;

// Helper for controller resources deriving ids
function replace(text, rx, map) {
  if (!_.isEmpty(map)) {
    return text.replace(rx, function(k) { return map[k]; });
  } else {
    return text;
  }
}

module.exports = Controller = function(options) {
  this.cid = _.uniqueId('controller');
  this._configure(options || {});
  this.views = [];
  this._actionResources = {};

  // resources
  _.each(this.resources, function(config, objName) {
    var actions = config.actions;
    config.name = objName;
    if (!actions || actions[0] === 'all') {
      actions = _.keys(this.actions);
    }
    _.each(actions, function(action) {
      var resources;

      if (!_.isArray(this._actionResources[action])) {
        this._actionResources[action] = [];
      }
      resources = this._actionResources[action];
      resources.push(config);
    }, this);
  }, this);

  if (this.el) {
    this.$el = $(this.el);
  } else {
    this.$el = $('<div/>');
  }
  this.initialize.apply(this, arguments);
};

_.extend(Controller.prototype, Backbone.Events, {
  mediator: mediator,
  fetcher: fetcher,
  modelManager: modelManager,
  collectionManager: collectionManager,

  initialize: function() {},

  _configure: function(options) {
    if (this.options) options = _.extend({}, _.result(this, 'options'), options);
    _.extend(this, _.pick(options, controllerOptions));
    this.options = options;
  },

  _action: function(name) {
    var args = _.compact(Array.prototype.slice.call(arguments, 1)),
        action = this.actions[name],
        promises = [],
        storedResources;

    if (_.isFunction(action)) {
      $('html, body').scrollTop(0);
      this.setBodyClass(this.bodyClass);
      storedResources = this._actionResources[name];
      if (_.isArray(storedResources) && storedResources.length) {
        var data = {},
            argMap = {},
            i = 1,
            fetchParams,
            resourceId,
            id;

        _.each(args, function(arg) {
          argMap['$' + i] = arg;
          i += 1;
        });

        if (args.length) {
          id = args[args.length - 1];
        }
        _.each(storedResources, function(config) {
          resourceId = '';
          fetchParams = null;
          if (config.id) {
            if (_.isFunction(config.id)) {
              resourceId = config.id.apply(this, args);
            } else {
              resourceId = replace(config.id, /\$\d+/g, argMap);
            }
          }
          if (config.params) {
            fetchParams = {};
            _.each(config.params, function(val, param) {
              val = replace(val, /\$\d+/g, argMap);
              fetchParams[param] = val;
            });
          }
          var resource = this.fetcher.fetch({
            id: resourceId,
            data: config.model ? {id: id} : null,
            model: config.model,
            collection: config.collection,
            options: {resourceId: resourceId, nested: args},
            fetchOptions: {data: fetchParams}
          });
          config.wait && promises.push(resource.promise);
          data[config.name] = resource;
        }, this);
        $.when.apply($, promises).always(function() {
          action.call(this, data, args);
        }.bind(this));
      } else {
        action.apply(this, args);
      }
    } else {
      throw 'Controller does not support the ' + name + ' action!';
    }
  },

  append: function(views) {
    if (!_.isArray(views)) {
      views = [views];
    }
    _.each(views, function(view) {
      this.views.push(view);
      this.$el.append(view.render().$el);
      view._onInsert();
    }, this);

    return this;
  },

  setBodyClass: function(className) {
    $('body').removeClass(this.bodyClass);
    $('body').removeClass(this.actionBodyClass);
    this.actionBodyClass = className;
    this.actionBodyClass && $('body').addClass(this.actionBodyClass);
  },

  setPageTitle: function(title) {
    $('title').text(title);
  },

  remove: function() {
    $('body').removeClass(this.bodyClass);
    $('body').removeClass(this.actionBodyClass);
    _.invoke(this.views, 'remove');
    this.$el.empty();
    this.views = [];
  }
});
// Use Backbone's extend inheritance
Controller.extend = Backbone.Model.extend;
Controller.mixin = mixin;

},{"./collection_manager":4,"./fetcher":7,"./mediator":10,"./mixin":11,"./model_manager":14}],6:[function(require,module,exports){
var mediator = require('./mediator'),
    dispatcherOptions = ['routes', 'controllerPath', 'middlewarePath'],
    Dispatcher;

module.exports = Dispatcher = function(options) {
  this.cid = _.uniqueId('dispatcher');
  this._configure(options || {});

  this._router = new Backbone.Router();
  this.buildRoutes(this.routes);

  this.initialize.apply(this, arguments);
};

_.extend(Dispatcher.prototype, Backbone.Events, {
  nestCount: 0,
  controllerPath: 'controllers/',
  middlewarePath: 'middlewares/',
  mediator: mediator,

  initialize: function() {
    // proxy navigate events from mediator to router
    this.mediator.on('navigate', this._router.navigate, this);
    // proxy dispatch event over mediator
    this.on('dispatched', function() {
      this.mediator.trigger('dispatched');
    }, this);
  },

  _configure: function(options) {
    if (this.options) options = _.extend({}, _.result(this, 'options'), options);
    _.extend(this, _.pick(options, dispatcherOptions));
    this.options = options;
  },

  loadMiddlewares: function(middlewares) {
    return _.map(middlewares, function(name) {
      return require(this.middlewarePath + name);
    }, this);
  },

  buildRoutes: function(routes, prefix, middlewares) {
    var route;
    prefix || (prefix = '');
    this.nestCount += 1;

    _.each(routes, function(val, key) {
      middlewares || (middlewares = []);

      if (key === 'middleware') {
        _.isArray(val) || (val = [val]);
        middlewares = middlewares.concat(this.loadMiddlewares(val));
      } else if (_.isObject(val)) {
        // String route prefix
        if (this.nestCount === 1) {
          prefix = key;
        } else {
          prefix += key;
        }
        this.buildRoutes(val, prefix, middlewares);
        this.nestCount -= 1;
      } else {
        route = key;

        if (prefix) {
          route = prefix + route;
        }
        this._router.route(route, _.bind(this.dispatch, this, val, middlewares));
      }
    }, this);
  },

  dispatch: function(controllerPair, middlewares) {
    var args = Array.prototype.slice.call(arguments, 2);
    var controllerPairStr = controllerPair.split('#'),
        controllerName = controllerPairStr[0],
        action = controllerPairStr[1],
        Controller = require(this.controllerPath + controllerName),
        method = '';

    if (middlewares && middlewares.length) {
      _.each(middlewares, function(middleware) {
        middleware.apply(null, args);
      });
    }

    if (Controller) {
      args.unshift(action);
      this._activeController && this._activeController.remove();
      if (!this._activeController || this._activeControllerName !== controllerName) {
        this._activeController = new Controller(args);
      }
      method = this._activeController.actions[action];
      if (method) {
        this._activeController._action.apply(this._activeController, args);
      } else {
        throw controllerName + ' controller has not implemented ' + action;
      }
      this._activeControllerName = controllerName;
      this.trigger('dispatched', controllerName, action);
    } else {
      throw controllerName + ' is not a defined controller';
    }
  }
});
// Use Backbone's extend inheritance
Dispatcher.extend = Backbone.Model.extend;

},{"./mediator":10}],7:[function(require,module,exports){
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

},{"./collection_manager":4,"./model_manager":14}],8:[function(require,module,exports){
(function(factory) {
  // Set up Frame appropriately for the environment. Start with AMD.
  if (typeof define === 'function' && define.amd) {
    define(['backbone', 'underscore', 'jquery', 'exports'], function(Backbone, _, $, exports) {
      // Export global even in AMD case in case this script is loaded with
      // others that may still expect a global Backbone.
      window.Frame = factory(window, exports, Backbone, _, $);
    });
  } else {
    window.Frame = factory(window, {}, this.Backbone, this._, (this.jQuery || this.Zepto || this.ender || this.$));
  }

}(function(root, Frame, Backbone, _, $) {
  _.extend(Frame, {
    _appModels: {},
    _appCollections: {},
    App: require('./app'),
    mediator: require('./mediator'),
    mixin: require('./mixin'),
    LinkHelper: require('./link_helper'),
    modelFactory: require('./model_factory'),
    modelManager: require('./model_manager'),
    collectionFactory: require('./collection_factory'),
    collectionManager: require('./collection_manager'),
    fetcher: require('./fetcher'),
    Model: require('./model'),
    Collection: require('./collection'),
    Controller: require('./controller'),
    Dispatcher: require('./dispatcher'),
    View: require('./views/base'),
    CollectionView: require('./views/collection'),
    ItemView: require('./views/item')
  });

  return Frame;
}));

},{"./app":1,"./collection":2,"./collection_factory":3,"./collection_manager":4,"./controller":5,"./dispatcher":6,"./fetcher":7,"./link_helper":9,"./mediator":10,"./mixin":11,"./model":12,"./model_factory":13,"./model_manager":14,"./views/base":15,"./views/collection":16,"./views/item":17}],9:[function(require,module,exports){
var mediator = require('./mediator'),
    LinkHelper;

module.exports = LinkHelper = function() {
  this.mediator = mediator;
  $(document).on('click', 'a', this.onClick.bind(this));
};

LinkHelper.prototype.onClick = function(e) {
  var $link = $(e.currentTarget),
      href = $link.attr('href'),
      data = $link.data(),
      options;

  if (!href || href === '#' || href === 'javascript:;' || e.metaKey) {
    return;
  }

  options = _.extend({
    trigger: true
  }, data);

  if (!options.external) {
    e.preventDefault();
    this.mediator.trigger('navigate', href, options);
  }
};

},{"./mediator":10}],10:[function(require,module,exports){
module.exports = _.extend({}, Backbone.Events);

},{}],11:[function(require,module,exports){
module.exports = function() {
  var mixins = Array.prototype.slice.apply(arguments);
  _.each(mixins, function(mixinModule) {
    if (_.isString(mixinModule)) {
      mixinModule = require('mixins/' + mixinModule);
    }
    if (this.prototype.events && mixinModule.events) {
      _.merge(this.prototype.events, mixinModule.events);
    }
    if (this.prototype.initialize) {
      this.prototype.initialize = _.wrap(this.prototype.initialize, function(fn) {
        var args = Array.prototype.slice.call(arguments, 1);
        mixinModule.init && mixinModule.init.apply(this, args);
        fn.apply(this, args);
        mixinModule.afterInit && mixinModule.afterInit.apply(this, args);
      });
    }
    _.merge(this.prototype, mixinModule.props);
  }, this);

  return this;
};

},{}],12:[function(require,module,exports){
var modelManager = require('./model_manager'),
    mediator = require('./mediator'),
    mixin = require('./mixin'),
    Model;

module.exports = Model = Backbone.Model.extend({
  mediator: mediator,

  initialize: function(attrs, options) {
    var Resource, nestedResource, fieldName, data;
    options || (options = {});
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

},{"./mediator":10,"./mixin":11,"./model_manager":14}],13:[function(require,module,exports){
module.exports = function(type, attrs, options) {
  var modelsPath,
      Model;

  if (!type) {
    throw 'Model type is required!';
  }

  modelsPath = 'models/' + type;
  Model = require(modelsPath);

  if (!Model) {
    throw modelsPath + ' is an undefined model';
  }
  return new Model(attrs, options);
};

},{}],14:[function(require,module,exports){
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

},{"./model_factory":13}],15:[function(require,module,exports){
var mediator = require('../mediator'),
    mixin = require('../mixin'),
    viewOptions = ['template', 'skipDependencies'],
    View;

function noOp() {}

module.exports = View = Backbone.View.extend({
  init: noOp,
  afterRender: noOp,
  onRemove: noOp,
  onError: noOp,
  showLoader: noOp,
  hideLoader: noOp,
  mediator: mediator,

  initialize: function(options) {
    options || (options = {});
    this._rendered = false;
    this._views = [];
    this._errors = [];
    this.resources = _.extend({}, options.resources);
    _.extend(this, _.pick(options, viewOptions));
    this.data = _.extend({}, this.data);
    options.data && this.set(options.data);
    this.mediatorEvents && this._attachMediatorEvents();
    this.resourceEvents && this._attachResourceEventsGroup(this.resourceEvents);
    this.$el.on('remove', _.bind(this.remove, this));

    var promises = [];
    function collectPendingPromise(resource) {
      if (resource && resource.promise && resource.promise.state() === 'pending') {
        promises.push(resource.promise);
      }
    }
    if (!this.skipDependencies) {
      _.each(this.resources, collectPendingPromise);
      this.model && collectPendingPromise(this.model);
      this.collection && collectPendingPromise(this.collection);
      promises.length && this.whenFetching(promises);
    }

    this.init(options);
  },

  render: function() {
    var data = {}, templateData = {};

    if (this.fetching) {
      return this;
    }
    if (this.template) {
      _.each(this.resources, function(resource, resourceName) {
        if (resource) {
          if (resource.models) { // Collection
            data[resourceName] = _.pluck(resource.models, 'attributes');
          } else { // Model
            data[resourceName] = resource.attributes;
          }
        }
      });
      if (this.model) {
        data.model = this.model.attributes;
      }
      _.each(_.result(this, 'data'), function(val, key) {
        templateData[key] = this.get(key);
      }, this);
      _.extend(data, templateData);
      this.$el.html(this.template(data));
    }
    this._rendered = true;
    this.afterRender(this.resources);

    return this;
  },

  get: function(val) {
    val = this.data[val];
    return _.isFunction(val) ? val.call(this) : val;
  },

  set: function(key, val) {
    if (val === void 0) {
      _.merge(this.data, key);
    } else {
      this.data[key] = val;
    }
    // Re-render view on set only if already rendered
    this._rendered && this.render();
  },

  prepend: function(views, $el) {
    _.isString($el) && ($el = this.$($el));
    this._attach('prepend', views, $el);
    return this;
  },

  prependTo: function($el) {
    this.prepend(this, $el);
    return this;
  },

  append: function(views, $el) {
    _.isString($el) && ($el = this.$($el));
    this._attach('append', views, $el);
    return this;
  },

  appendTo: function($el) {
    this.append(this, $el);
    return this;
  },

  after: function($el, views) {
    _.isString($el) && ($el = this.$($el));
    this._attach('after', views, $el);
    return this;
  },

  before: function($el, views) {
    _.isString($el) && ($el = this.$($el));
    this._attach('before', views, $el);
    return this;
  },

  empty: function() {
    this._removeNested();
    this.$el.html('');
    return this;
  },

  reset: function(views) {
    _.isUndefined(views) && (views = []);
    var els = this._renderViews(views);
    this.$el.html(els);
    this._removeNested();
    this._viewsInserted(views);
    return this;
  },

  replaceWith: function(view) {
    this.$el.after(view.render().el);
    view.delegateEvents();
    view._onInsert();
    this.remove();
    this.listenTo(view, 'all', this.trigger);
  },

  remove: function() {
    if (!this.hasRemoved) {
      this.hasRemoved = true;
      this._removeMediatorEvents();
      this._removeNested();
      Backbone.View.prototype.remove.call(this);
      this.$el.off('remove');
      this.onRemove();
    }
    return this;
  },

  getItemById: function($el) {
    var item,
        dataCID,
        dataID = $el.attr('data-id');

    if (dataID) {
      item = this.collection.get(dataID);
    } else {
      item = this.collection.get($el.closest('[data-id]').attr('data-id'));
    }

    if (!item) {
      dataCID = $el.attr('data-cid');
      if (dataCID) {
        item = this.collection.get(dataCID);
      } else {
        item = this.collection.get($el.closest('[data-cid]').attr('data-cid'));
      }
    }

    return item;
  },

  stopProp: function(e) {
    if (e && e.stopPropagation) {
      e.stopPropagation();
      e.preventDefault();
    }
    return this;
  },

  stopPropagation: function(e) {
    e && e.stopPropagation && e.stopPropagation();
    return this;
  },

  whenFetching: function(promises) {
    if (!this.fetching) {
      !_.isArray(promises) && (promises = [promises]);
      this.fetching = true;
      this.showLoader(promises);
      $.when.apply($, promises)
      .always(function() {
        this.fetching = false;
        this.hideLoader();
      }.bind(this))
      .then(
        this.afterFetch.bind(this),
        this.onError.bind(this)
      );
    }
  },

  afterFetch: function() {
    this.render();
  },

  _onInsert: function() {
    this.hasRemoved = false;
    this.onInsert && _.defer(this.onInsert.bind(this));
  },

  _renderViews: function(views) {
    return _.map(views, function(view) {
      return view.render().el;
    }, this);
  },

  _viewsInserted: function(views) {
    _.each(views, function(view) {
      if (view != this) {
        this._views.push(view);
      }
      view._onInsert.call(view);
    }, this);
  },

  _removeNested: function() {
    _.invoke(this._views, 'remove');
    this._views = [];
  },

  _attach: function(method, views, $el) {
    $el || ($el = this.$el);
    if (!_.isArray(views)) {
      views = [views];
    }
    var els = this._renderViews(views);
    $el[method](els);
    this._viewsInserted(views);
  },

  _attachMediatorEvents: function(events) {
    if (!(events || (events = _.result(this, 'mediatorEvents')))) return;
    this._removeMediatorEvents();

    _.each(events, function(method, event) {
      if (!_.isFunction(method)) method = this[method];
      if (!method) throw new Error('Method ' + method + ' does not exist');
      this.mediator.on(event, method, this);
    }, this);
  },

  _removeMediatorEvents: function() {
    this.mediator.off(null, null, this);
  },

  _attachResourceEventsGroup: function(resourceGroup) {
    var resource, resourcePath, baseObj = this.resources;
    _.each(resourceGroup, function(events, resourceName) {
      resourcePath = resourceName.split('.');
      if (resourcePath[0] == 'collection' || resourcePath[0] == 'model') {
        baseObj = this;
      }
      resource = resourcePath.reduce(function(obj, i) {
        return obj[i];
      }, baseObj);
      if (!resource) {
        throw new Error(resourceName + ' not found in view to attach events to');
      }
      // resource = this[]
      this._attachResourceEvents(events, resource);
    }, this);
  },

  // Listen to the events of a given resource
  _attachResourceEvents: function(events, resource) {
    _.each(events, function(methods, event) {
      _.each(methods.split(' '), function(method) {
        if (!_.isFunction(method)) method = this[method];
        if (!method) throw new Error('Method ' + method + ' does not exist');
        this.listenTo(resource, event, method);
      }, this);
    }, this);
  }
});
// Add mixin method
View.mixin = mixin;

},{"../mediator":10,"../mixin":11}],16:[function(require,module,exports){
var View = require('./base'),
    collectionViewOptions = ['modelView', 'infinite', '$infiniteTarget'];

function noOp() {}

module.exports = View.extend({
  showEmpty: noOp,
  hideEmpty: noOp,
  collectionEvents: {
    'reset': 'render',
    'add': 'addOne hideEmpty',
    'remove': 'checkEmpty',
    'fetch': 'whenFetching'
  },

  initialize: function(options) {
    View.prototype.initialize.apply(this, arguments);
    _.bindAll(this, 'onScroll');
    _.extend(this, _.pick(options, collectionViewOptions));
    this._setupInfinite(options);
    this._attachResourceEventsGroup({
      collection: this.collectionEvents
    });
  },

  render: function() {
    var templateHTML = this.template ? this.template() : '';

    this.hideEmpty();
    this.$el.html(templateHTML);
    if (this.fetching) {
      return this;
    }
    if (this.collection.length) {
      this.collection.each(this.addOne, this);
    } else {
      this.showEmpty();
    }
    this.afterRender();

    return this;
  },

  addOne: function(model) {
    var modelAt = this.collection.indexOf(model),
        $viewAtEl,
        newView;

    newView = new this.modelView({
      model: model,
      resources: this.resources
    });
    this.beforeEach && newView.$el.before(this.beforeEach(model));
    $viewAtEl = this._viewElAt(modelAt);

    if ($viewAtEl.length) {
      this.before($viewAtEl, newView);
    } else {
      this.append(newView);
    }

    this.afterEach && newView.$el.after(this.afterEach(model));
    this._views.push(newView);

    return newView;
  },

  onScroll: function() {
    var scrollY = this.$infiniteTarget.scrollTop() + this.$infiniteTarget.height(),
        docHeight = this.$infiniteTarget.get(0).scrollHeight || $(document).height();

    if (scrollY >= docHeight - this.infniteOptions.offset && !this.fetching && this.prevScrollY <= scrollY && !this.infiniteEnd) {
      var collectionLength = this.collection.length;
      var options = {remove: false};
      if (!collectionLength && this.collection.isFetched()) {
        this.infiniteEnd = true;
        return;
      }
      if (this.infniteOptions.data) {
        options.data = _.result(this.infniteOptions, 'data');
      }
      this.collection.fetchNext(options)
      .always(function() {
        if (this.collection.length === collectionLength) {
          this.infiniteEnd = true;
        }
      }.bind(this));
    }
    this.prevScrollY = scrollY;
  },

  afterFetch: function() {
    this.checkEmpty();
  },

  checkEmpty: function() {
    if (this.collection.length === 0) {
      this.showEmpty();
    } else {
      this.hideEmpty();
    }
  },

  onRemove: function() {
    // TODO actually remove this event
    this.$infiniteTarget && this.$infiniteTarget.off('scroll', this.onScroll);
  },

  _setupInfinite: function() {
    if (this.infinite) {
      this.infniteOptions = _.extend({
        offset: 300
      }, this.infinite);
      this.$infiniteTarget = this.$infiniteTarget || this.$el;
      this.$infiniteTarget.on('scroll', this.onScroll);
    }
  },

  _currentRenderedCount: function() {
    var selector = this.modelView.prototype.className.split(' ')[0];

    return this.$('.' + selector).length;
  },

  _viewElAt: function(index) {
    var selector = this.modelView.prototype.className.split(' ')[0];

    return this.$('.' + selector).eq(index);
  }
});

},{"./base":15}],17:[function(require,module,exports){
var View = require('./base');

module.exports = View.extend({
  modelEvents: {
    'change': 'render',
    'invalid': 'onInvalid',
    'remove': 'removeItem'
  },

  initialize: function(options) {
    this.model && this._attachResourceEvents(this.modelEvents, this.model);
    View.prototype.initialize.apply(this, arguments);
    this.collection = this.model.collection;
  },

  removeItem: function(model, collection, options) {
    !options.silent && this.remove();
  },

  onInvalid: function() {}
});

},{"./base":15}]},{},[8]);