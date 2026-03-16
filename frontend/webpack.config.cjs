const { merge } = require("webpack-merge");
const singleSpaDefaults = require("webpack-config-single-spa-react-ts");
const path = require("path");

module.exports = (webpackConfigEnv, argv) => {
  const defaultConfig = singleSpaDefaults({
    orgName: "mase",
    projectName: "siv",
    webpackConfigEnv,
    argv,
    outputSystemJS: true,
  });

  return merge(defaultConfig, {
    entry: {
      "mase-siv": path.resolve(__dirname, "src/mase-siv.tsx"),
    },
    output: {
      filename: "[name].js",
      libraryTarget: "system",
      path: path.resolve(__dirname, "dist"),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    devServer: {
      port: 3003,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cross-Origin-Resource-Policy": "cross-origin",
        "Cross-Origin-Embedder-Policy": "require-corp",
      },
    },
  });
};
