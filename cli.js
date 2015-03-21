#!/usr/bin/env node
'use strict';

/*
 * Dependencies.
 */

var path = require('path');
var fs = require('fs');
var commander = require('commander');
var camelcase = require('camelcase');
var debug = require('debug')('mdast');
var mdast = require('./');
var Configuration = require('./lib/configuration');
var pack = require('./package.json');

/*
 * Shortcuts.
 */

var Command = commander.Command;
var exists = fs.existsSync || path.existsSync;
var resolve = path.resolve;
var join = path.join;
var read = fs.readFile;
var write = fs.writeFile;
var stdout = process.stdout;
var stdin = process.stdin;
var stderr = process.stderr;

/*
 * Constants.
 */

var SPLITTER = / *[,;] */g;
var DELIMITER = / *: */;

var ENCODING = 'utf-8';

var cwd = process.cwd();
var expextPipeIn = !stdin.isTTY;
var seperator = path.sep;

var command = Object.keys(pack.bin)[0];

/**
 * Fail with `message` to stderr and exit with `1`.
 *
 * Throwing an error in node@0.10 might cause an exit
 * code of `8` for file operations.
 *
 * @param {Error|string} message
 */
function fail(message) {
    stderr.write((message.stack || message) + '\n');
    process.exit(1);
}

/**
 * Find root of node modules.
 *
 * @return {string}
 */
function findRoot() {
    var parts = cwd.split(seperator);
    var location = cwd;

    while (!exists(join(location, 'package.json')) && parts.length > 1) {
        parts.pop();
        location = parts.join(seperator);
    }

    return parts.length ? location : cwd;
}

/*
 * Root.
 */

var root = findRoot();

/**
 * Find a plugin.
 *
 * @param {string} pathlike
 * @return {Object}
 */
function find(pathlike) {
    var local = resolve(root, pathlike);
    var npm = resolve(root, 'node_modules', pathlike);
    var current = resolve(cwd, 'node_modules', pathlike);
    var plugin;

    if (exists(local) || exists(local + '.js')) {
        plugin = local;
    } else if (exists(npm)) {
        plugin = npm;
    } else if (exists(current)) {
        plugin = current;
    } else {
        plugin = pathlike;
    }

    debug('Using plugin `%s` at `%s`', pathlike, plugin);

    try {
        plugin = require(plugin);
    } catch (exception) {
        fail(exception);
    }

    return plugin;
}

/**
 * Parse settings into an object.
 *
 * @param {string} flags
 * @param {Object} cache
 * @return {Object}
 */
function parseSetting(flags, cache) {
    flags.split(SPLITTER).forEach(function (flag) {
        var value;

        flag = flag.split(DELIMITER);

        value = flag.slice(1).join(':');

        if (value === 'true' || value === '') {
            value = true;
        } else if (value === 'false') {
            value = false;
        } else if (Number(value) === Number(value)) {
            value = Number(value);
        }

        cache[camelcase(flag[0])] = value;
    });

    return cache;
}

/**
 * Parse plugins into a list.
 *
 * @param {string} ware
 * @param {Array.<string>} cache
 * @return {Array.<string>}
 */
function parsePlugin(ware, cache) {
    return cache.concat(ware.split(SPLITTER));
}

/**
 * Command.
 */

var program = new Command(pack.name)
    .version(pack.version)
    .description(pack.description)
    .usage('[options] file')
    .option('-o, --output <path>', 'specify output location', null)
    .option('-c, --config <path>', 'specify configuration location', null)
    .option('-s, --setting <settings>', 'specify settings', parseSetting, {})
    .option('-u, --use <plugins>', 'use transform plugin(s)', parsePlugin, [])
    .option('-a, --ast', 'output AST information', false)
    .option('--settings', 'output available settings', false);

/**
 * Help.
 */

program.on('--help', function () {
    console.log('  # Note that bash does not allow reading and writing');
    console.log('  # to the same file through pipes');
    console.log();
    console.log('  Usage:');
    console.log();
    console.log('  # Pass `Readme.md` through mdast');
    console.log('  $ ' + command + ' Readme.md -o Readme.md');
    console.log();
    console.log('  # Pass stdin through mdast, with settings, to stdout');
    console.log('  $ cat Readme.md | ' + command + ' --setting ' +
        '"setext, bullet: *" > Readme-new.md');
    console.log();
    console.log('  # use a plugin');
    console.log('  $ npm install mdast-toc');
    console.log('  $ ' + command + ' --use mdast-toc -o Readme.md');
    console.log();
});

program.on('--settings', function () {
    console.log();
    console.log('  # Settings');
    console.log();
    console.log('  Both camel- and dash-cased settings are allowed.');
    console.log();
    console.log('  ## [Parse](https://github.com/wooorm/mdast#' +
        'mdastparsevalue-options)');
    console.log();
    console.log('  -  `gfm` (boolean, default: true)');
    console.log('  -  `yaml` (boolean, default: true)');
    console.log('  -  `pedantic` (boolean, default: false)');
    console.log('  -  `commonmark` (boolean, default: false)');
    console.log('  -  `breaks` (boolean, default: false)');
    console.log('  -  `footnotes` (boolean, default: false)');
    console.log();
    console.log('  ## [Stringify](https://github.com/wooorm/mdast#' +
        'mdaststringifyast-options)');
    console.log();
    console.log('  -  `setext` (boolean, default: false)');
    console.log('  -  `close-atx` (boolean, default: false)');
    console.log('  -  `loose-table` (boolean, default: false)');
    console.log('  -  `spaced-table` (boolean, default: true)');
    console.log('  -  `reference-links` (boolean, default: false)');
    console.log('  -  `fences` (boolean, default: false)');
    console.log('  -  `bullet` ("-", "*", or "+", default: "-")');
    console.log('  -  `rule` ("-", "*", or "_", default: "*")');
    console.log('  -  `rule-repetition` (number, default: 3)');
    console.log('  -  `rule-spaces` (boolean, default: false)');
    console.log('  -  `strong` ("_", or "*", default: "*")');
    console.log('  -  `emphasis` ("_", or "*", default: "_")');
    console.log();
    console.log('  Settings are specified as follows:');
    console.log();
    console.log('    $ ' + command + ' --setting "name:value"');
    console.log();
    console.log('  Multiple settings:');
    console.log();
    console.log('    $ ' + command + ' --setting "emphasis:*,strong:_"');
    console.log();
});

program.parse(process.argv);

/*
 * Program.
 */

debug('Using root: `%s`', root);

/**
 * Parse `value` with `parser`. When `ast` is set,
 * pretty prints JSON, otherwise stringifies with
 * `parser`. Either write to `output` or to stdout.
 *
 * @param {string} value
 */
function run(value, filename) {
    var configuration;
    var parser = mdast;
    var options;
    var doc;

    try {
        configuration = new Configuration({
            'file': program.config,
            'settings': program.setting,
            'plugins': program.use
        });
    } catch (exception) {
        fail(exception);
    }

    options = configuration.getConfiguration(filename);

    debug('Using settings `%j`', options.settings);

    parser = parser.use(options.plugins.map(find));

    debug('Using plug-ins `%j`', options.plugins);

    try {
        doc = parser.parse(value, options.settings);
    } catch (exception) {
        fail(exception);
    }

    if (program.ast) {
        doc = JSON.stringify(doc, null, 2);
    } else {
        doc = parser.stringify(doc, options.settings);
    }

    if (program.output) {
        debug('Writing document to `%s`', program.output);

        write(program.output, doc, function (exception) {
            if (exception) {
                fail(exception);
            }
        });
    } else {
        debug('Writing document to standard out');

        stdout.write(doc);
    }
}

var files = program.args;

if (program.settings) {
    program.emit('--settings');
} else {
    if (!expextPipeIn && !files.length) {
        if (program.output) {
            debug('Using output `%s` as input', program.output);

            files.push(program.output);
        } else {
            program.outputHelp();
            process.exit(1);
        }
    } else if (
        (expextPipeIn && files.length) ||
        (!expextPipeIn && files.length !== 1)
    ) {
        fail('mdast currently expects one file.');
    }

    files = files.map(function (filename) {
        return path.resolve(filename);
    });

    if (files[0]) {
        debug('Reading from `%s` using encoding `%s`', files[0], ENCODING);

        read(files[0], ENCODING, function (exception, value) {
            if (exception) {
                fail(exception);
            }

            run(value, files[0]);
        });
    } else {
        stdin.resume();
        stdin.setEncoding(ENCODING);
        stdin.on('data', run);
    }
}
