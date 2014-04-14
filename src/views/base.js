var mediator = require('../mediator'),
    mixin = require('../mixin'),
    viewOptions = ['template', 'skipDependencies'],
    View;

function noOp() {}

module.exports = View = Backbone.View.extend({
  waitForResources: true,
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
    this.template && (this.set('template', this.template));
    this.mediatorEvents && this._attachMediatorEvents();
    this.resourceEvents && this._attachResourceEventsGroup(this.resourceEvents);
    this.$el.on('remove', _.bind(this.remove, this));

    var promises;
    if (this.waitForResources) {
      promises = this.collectResourcesPromises();
      promises.length && this.whenFetching(promises);
    }

    this.init(options);
  },

  render: function() {
    var data = {}, templateData = {};

    if (this.fetching) {
      return this;
    }
    if (this._template) {
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
      this.$el.html(this._template(data));
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
    if (key === 'template') {
      this._template = Frame.TEMPLATES[val];
      return;
    }
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

  collectResourcesPromises: function() {
    var promises = [];
    function collectPendingPromise(resource) {
      if (resource && resource.promise && resource.promise.state() === 'pending') {
        promises.push(resource.promise);
      }
    }
    _.each(this.resources, collectPendingPromise);
    this.model && collectPendingPromise(this.model);
    this.collection && collectPendingPromise(this.collection);

    return promises;
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
