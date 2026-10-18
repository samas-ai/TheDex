// Expo's default Metro config already handles the pnpm monorepo (workspace packages,
// hoisted node_modules). We only teach Metro to bundle the prebuilt SQLite database.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('db');

module.exports = config;
