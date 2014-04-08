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
