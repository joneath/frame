var View = require('./base');

module.exports = View.extend({
  modelEvents: {
    'change': 'render',
    'invalid': 'onInvalid',
    'remove': 'removeItem'
  },

  initialize: function() {
    this.model && this._attachResourceEvents(this.modelEvents, this.model);
    this.collection = this.model.collection;
    View.prototype.initialize.apply(this, arguments);
  },

  removeItem: function(model, collection, options) {
    if (!options || !options.silent) {
      this.remove();
    }
  },

  onInvalid: function() {}
});
