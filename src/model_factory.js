module.exports = function(type, attrs, options) {
  var modelsPath,
      Model;

  if (!type) {
    throw 'Model type is required!';
  }

  modelsPath = 'models/' + type;
  Model = require(modelsPath);

  if (!Model) {
    throw modelsPath + ' is an undefined model';
  }
  return new Model(attrs, options);
};
