
var app = require("./app");
var host = require("./host");
var gatherer = require("./gatherer");
var bootstrap = require("./bootstrap");

module.exports = {
    createHost: host.create,
    createApp: app.create,
    createGatherer: gatherer.create,
    bootstrap: bootstrap.bootstrap
};
