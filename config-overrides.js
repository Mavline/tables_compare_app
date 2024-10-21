const { override, addBabelPlugin } = require('customize-cra');

module.exports = override(
  addBabelPlugin(["@babel/plugin-proposal-private-property-in-object", { "loose": true }]),
  addBabelPlugin(["@babel/plugin-transform-class-properties", { "loose": true }]),
  addBabelPlugin(["@babel/plugin-transform-private-methods", { "loose": true }])
);