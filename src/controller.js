var store = require('./store'),
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
    config === true && (config = {});
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
  store: store,

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
            resourceName,
            id;

        _.each(args, function(arg) {
          argMap['$' + i] = arg;
          i += 1;
        });

        if (args.length) {
          id = args[args.length - 1];
        }
        _.each(storedResources, function(config) {
          // Convert camel case to underscores
          resourceName = config.name.replace(/([A-Z])/g, function($1){return '_' + $1.toLowerCase();});
          resourceId = _.uniqueId(resourceName);
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
            resource: resourceName,
            data: id ? {id: id} : null,
            options: {
              nested: args,
              ajax: fetchParams ? {
                data: fetchParams
              } : null
            }
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
