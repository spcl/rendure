// This file uses CommonJS require instead of ES6 imports because it is not
// transpiled
const path = require('path');

module.exports = {
    name: 'rendure',
    module: {
        rules: [
            {
                test: /\.m?[jt]sx?$/,
                use: [
                    {
                        loader: 'ts-loader',
                        options: {
                            configFile: 'tsconfig-build.json',
                        },
                    },
                ],
                exclude: /node_modules/,
            },
            {
                test: /\.scss$/i,
                use: [
                    'style-loader',
                    'css-loader',
                    'sass-loader',
                ],
            },
        ],
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
    devtool: 'source-map',
    entry: {
        rendure: './src/index.ts',
    },
    output: {
        filename: 'index.js',
        path: path.resolve(__dirname, 'dist'),
    },
    plugins: []
}
