const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const path = require('path');
const fs = require('fs');

const nodeModules = {};
fs.readdirSync('node_modules').filter(function (x) { return ['.bin'].indexOf(x) === -1;  }).forEach(function (mod) {    nodeModules[mod] = 'commonjs ' + mod;  });

const config = [{
  entry: {
    app: [
      __dirname + '/src/app/index.ts'
    ],
  },
  output: {
    path: __dirname + '/generators/',
    filename: '[name]/index.js',
    libraryTarget: 'umd'
  },
  externals: nodeModules,
  devtool: 'source-map',
  mode: 'production',
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
    alias: {}
  },
  target: 'node',
  node: {
    __dirname: false,
    __filename: false,
  },
  module: {
    rules: [{
      test: /\.tsx?$/,
      exclude: [/templates/],
      use: [{
        loader: "ts-loader"
      }]
    }]
  },
  plugins: [
    new CleanWebpackPlugin(),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'src/app/templates',
          to: 'app/templates',
          info: { minimized: true }
        }
      ]
    })
  ]
}];


module.exports = config;
