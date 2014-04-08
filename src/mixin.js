module.exports = function() {
  var mixins = Array.prototype.slice.apply(arguments);
  _.each(mixins, function(mixinModule) {
    if (_.isString(mixinModule)) {
      mixinModule = require(Frame._app.get('mixinPath') + mixinModule);
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
