var Backbone = require('backbone');

module.exports = Backbone.Model.extend({
  defaults: {
    followLinks: true,
    routes: {}
  },

  initialize: function(config) {
    config && this.set(config);
    config.templates && (Frame.TEMPLATES = config.templates);
    this.get('followLinks') && (this._linkHelper = new Frame.LinkHelper());
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
