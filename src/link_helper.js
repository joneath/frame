var mediator = require('./mediator'),
    LinkHelper;

module.exports = LinkHelper = function() {
  this.mediator = mediator;
  $(document).on('click', 'a', this.onClick.bind(this));
};

LinkHelper.prototype.onClick = function(e) {
  var $link = $(e.currentTarget),
      href = $link.attr('href'),
      data = $link.data(),
      options;

  if (!href || href === '#' || href === 'javascript:;' || e.metaKey) {
    return;
  }

  options = _.extend({
    trigger: true
  }, data);

  if (!options.external) {
    e.preventDefault();
    this.mediator.trigger('navigate', href, options);
  }
};
