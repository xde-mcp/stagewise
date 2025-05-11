const path = require('node:path');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

/** @type {import('webpack').Configuration} */
const config = {
  target: 'node', // VS Code extensions run in a Node.js-context -> https://webpack.js.org/configuration/node/
  mode: 'none', // Set mode to 'production' or 'development' or 'none'. 'none' is often good for extensions. Production minifies.

  entry: './src/extension.ts', // The entry point of your extension -> https://webpack.js.org/configuration/entry-context/
  output: {
    // The bundle is stored in the 'out' folder (check package.json) -> https://webpack.js.org/configuration/output/
    path: path.resolve(__dirname, 'out'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2', // Required for VS Code extensions
  },
  externals: {
    vscode: 'commonjs vscode', // The vscode-module is created on-the-fly and must be excluded -> https://webpack.js.org/configuration/externals/
    // Add other modules that cannot be webpack'ed, if any. E.g., native Node modules.
  },
  resolve: {
    // Support reading TypeScript and JavaScript files -> https://github.com/TypeStrong/ts-loader
    extensions: ['.ts', '.js'],
    // --- Use TsconfigPathsPlugin to handle workspace paths ---
    plugins: [
      new TsconfigPathsPlugin({
        configFile: path.resolve(__dirname, './tsconfig.json'),
        extensions: ['.ts', '.js'],
        mainFields: ['main', 'module'],
        baseUrl: path.resolve(__dirname),
      }),
    ],
    // ---------------------------------------------------------
    alias: {
      '@stagewise/extension-toolbar-srpc-contract': path.resolve(
        __dirname,
        '../../packages/extension-toolbar-srpc-contract',
      ),
      '@stagewise/srpc': path.resolve(__dirname, '../../packages/srpc'),
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: path.resolve(__dirname, 'tsconfig.json'),
              transpileOnly: false,
            },
          },
        ],
      },
    ],
  },
  devtool: 'nosources-source-map', // Control source map generation - 'nosources-source-map' is good for extensions
  infrastructureLogging: {
    level: 'log', // Enable webpack infrastructure logging -> https://webpack.js.org/configuration/other-options/#infrastructurelogging
  },
};
module.exports = config;
