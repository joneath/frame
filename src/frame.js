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
    _store: {},
    App: require('./app'),
    mediator: require('./mediator'),
    mixin: require('./mixin'),
    LinkHelper: require('./link_helper'),
    modelFactory: require('./model_factory'),
    collectionFactory: require('./collection_factory'),
    store: require('./store'),
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
