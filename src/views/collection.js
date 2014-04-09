var View = require('./base'),
    collectionViewOptions = ['modelView', 'infinite', '$infiniteTarget'];

function noOp() {}

module.exports = View.extend({
  showEmpty: noOp,
  hideEmpty: noOp,
  collectionEvents: {
    'reset': 'render',
    'add': 'addOne hideEmpty',
    'remove': 'checkEmpty',
    'fetch': 'whenFetching'
  },

  initialize: function(options) {
    View.prototype.initialize.apply(this, arguments);
    _.bindAll(this, 'onScroll');
    _.extend(this, _.pick(options, collectionViewOptions));
    this._setupInfinite(options);
    this._attachResourceEventsGroup({
      collection: this.collectionEvents
    });
  },

  render: function() {
    var templateHTML = this._template ? this._template() : '';

    this.hideEmpty();
    this.$el.html(templateHTML);
    if (this.fetching) {
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

  addOne: function(model) {
    var modelAt = this.collection.indexOf(model),
        $viewAtEl,
        newView;

    newView = new this.modelView({
      model: model,
      resources: this.resources
    });
    this.beforeEach && newView.$el.before(this.beforeEach(model));
    $viewAtEl = this._viewElAt(modelAt);

    if ($viewAtEl.length) {
      this.before($viewAtEl, newView);
    } else {
      this.append(newView);
    }

    this.afterEach && newView.$el.after(this.afterEach(model));
    this._views.push(newView);

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
    this.checkEmpty();
  },

  checkEmpty: function() {
    if (this.collection.length === 0) {
      this.showEmpty();
    } else {
      this.hideEmpty();
    }
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
