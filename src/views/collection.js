var View = require('./base'),
    collectionViewOptions = ['modelView', 'infinite', '$infiniteTarget'];

function noOp() {}

module.exports = View.extend({
  showEmpty: noOp,
  hideEmpty: noOp,
  collectionEvents: {
    'reset': 'onReset',
    'add': 'addOne hideEmpty',
    'remove': 'checkEmpty removeFromViews',
    'fetch': 'whenFetching'
  },

  initialize: function(options) {
    View.prototype.initialize.apply(this, arguments);
    _.bindAll(this, 'onScroll');
    _.extend(this, _.pick(options, collectionViewOptions));
    this._setupInfinite(options);
    if (!this.fetching) {
      this._attachResourceEventsGroup({
        collection: this.collectionEvents
      });
    }
    if (this.collection.promise && this.collection.promise.state() === 'rejected') {
      this._errored = true;
    }
  },

  render: function() {
    var templateHTML = this._template ? this._template() : '';

    this._views = [];
    this.hideEmpty();
    this.$el.html(templateHTML);
    if (this.fetching) {
      return this;
    }
    if (this._errored) {
      this.onError();
      return this;
    }
    if (this.collection.length) {
      this.collection.each(this.addOne, this);
    } else {
      this.showEmpty();
    }
    this.afterRender();

    return this;
  },

  onReset: function() {
    this.fetching = false;
    this.render();
  },

  addOne: function(model) {
    var modelAt = this.collection.indexOf(model);
    var currentViewInPlace = this._views[modelAt];
    var newView = new this.modelView({
      model: model,
      resources: this.resources
    });
    var $tmp;

    if (currentViewInPlace) {
      currentViewInPlace._$before && ($tmp = currentViewInPlace._$before.detach());
      this.before(currentViewInPlace.$el, newView);
      $tmp && currentViewInPlace.$el.before($tmp);
    } else {
      this.append(newView);
    }

    if (this.beforeEach) {
      $tmp = $(this.beforeEach(model));
      newView.$el.before($tmp);
      newView._$before = $tmp;
    }
    if (this.afterEach) {
      $tmp = $(this.afterEach(model));
      newView.$el.after($tmp);
      newView._$after = $tmp;
    }

    return newView;
  },

  onScroll: function() {
    var scrollY = this.$infiniteTarget.scrollTop() + this.$infiniteTarget.height(),
        docHeight = this.$infiniteTarget.get(0).scrollHeight || $(document).height();

    if (scrollY >= docHeight - this.infniteOptions.offset && !this.fetching && this.prevScrollY <= scrollY && !this.infiniteEnd) {
      var collectionLength = this.collection.length;
      var options = {remove: false};
      if (!collectionLength && this.collection.isFetched()) {
        this.infiniteEnd = true;
        return;
      }
      if (this.infniteOptions.data) {
        options.data = _.result(this.infniteOptions, 'data');
      }
      this.collection.fetchNext(options)
      .always(function() {
        if (this.collection.length === collectionLength) {
          this.infiniteEnd = true;
        }
      }.bind(this));
    }
    this.prevScrollY = scrollY;
  },

  afterFetch: function() {
    if (!this._rendered) {
      this._attachResourceEventsGroup({
        collection: this.collectionEvents
      });
      this.render();
    } else {
      this.checkEmpty();
    }
  },

  checkEmpty: function() {
    if (this.collection.length === 0) {
      this.showEmpty();
    } else {
      this.hideEmpty();
    }
  },

  removeFromViews: function(model) {
    var viewIndex;

    _.each(this._views, function(view, i) {
      if (view.model === model) {
        viewIndex = i;
      }
    });
    viewIndex && this._views.splice(viewIndex, 1);
  },

  onRemove: function() {
    // TODO actually remove this event
    this.$infiniteTarget && this.$infiniteTarget.off('scroll', this.onScroll);
  },

  _setupInfinite: function() {
    if (this.infinite) {
      this.infniteOptions = _.extend({
        offset: 300
      }, this.infinite);
      this.$infiniteTarget = this.$infiniteTarget || this.$el;
      this.$infiniteTarget.on('scroll', this.onScroll);
    }
  },

  _currentRenderedCount: function() {
    var selector = this.modelView.prototype.className.split(' ')[0];

    return this.$('.' + selector).length;
  },

  _viewElAt: function(index) {
    var selector = this.modelView.prototype.className.split(' ')[0];

    return this.$('.' + selector).eq(index);
  }
});
