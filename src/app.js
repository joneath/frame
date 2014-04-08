module.exports = Backbone.Model.extend({
  defaults: {
    modelPath: 'models/',
    collectionsPath: 'collections/',
    controllerPath: 'controllers/',
    middlewarePath: 'middlewares/',
    mixinPath: 'mixins/',
    followLinks: true,
    routes: {}
  },

  initialize: function(config) {
    config && this.set(config);

    if (this.get('followLinks')) {
      this._linkHelper = new Frame.LinkHelper();
    }

    this._dispatcher = new Frame.Dispatcher({
      routes: this.get('routes'),
      controllerPath: this.get('controllerPath'),
      middlewarePath: this.get('middlewarePath')
    });

    $(function() {
      Backbone.history.start({
        pushState: true
      });
    });
    Frame._app = this;
  }
});
