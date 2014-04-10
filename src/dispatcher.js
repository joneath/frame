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
