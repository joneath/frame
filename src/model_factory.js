module.exports = function(type, attrs, options) {
  var modelPath,
      Model;

  if (!type) {
    throw 'Model type is required!';
  }

  modelPath = Frame._app.get('modelPath') + type;
  Model = require(modelPath);

  if (!Model) {
    throw modelPath + ' is an undefined model';
  }
  return new Model(attrs, options);
};
