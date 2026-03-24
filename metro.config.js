const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver = config.resolver || {};
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  'node:worker_threads': path.resolve(__dirname, 'src/shims/worker_threads.ts'),
};

module.exports = config;

