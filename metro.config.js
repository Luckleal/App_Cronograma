const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Some dependencies (e.g. zustand) ship an ESM build using `import.meta`,
// which Metro's web bundle can't execute. Falling back to their CJS build
// avoids "Cannot use 'import.meta' outside a module" crashes.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
