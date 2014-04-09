var store = require('./store');

module.exports = {
  fetch: function(config) {
    var resource, ajaxOptions;

    if (config.options) {
      ajaxOptions = config.options.ajax;
      delete config.options.ajax;
    }

    resource = store.get(config);
    resource.fetchCached(ajaxOptions);

    return resource;
  }
};
