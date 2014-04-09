module.exports = Backbone.Model.extend({
  defaults: {
    followLinks: true,
    routes: {},
    TEMPLATES: JST
  },

  initialize: function(config) {
    config && this.set(config);
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
