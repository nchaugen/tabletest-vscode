/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("node:path");

/** @type {import("webpack").Configuration} */
module.exports = {
  target: "webworker",
  entry: {
    extension: "./src/web/extension.ts",
    "test/suite/index": "./src/test/web/suite/index.ts"
  },
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "dist/web"),
    libraryTarget: "commonjs"
  },
  resolve: {
    extensions: [".ts", ".js"]
  },
  externals: {
    vscode: "commonjs vscode"
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
            options: {
              configFile: "tsconfig.json"
            }
          }
        ]
      }
    ]
  }
};
