module.exports = {
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
};
