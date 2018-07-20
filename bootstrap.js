
var createApp = require("./app").create;
var createHost = require("./host").create;
var createGatherer = require("./gatherer").create;

function bootstrap(rootDirs, config) {
    
    var components;
    
    var app = createApp();
    var host = createHost();
    var gatherer = createGatherer(host);
    
    var onError = typeof config.onError === "function" ?
        config.onError :
        console.error.bind(console);
    
    host.on("error", onError);
    gatherer.init();
    
    components = gatherer.resolveComponents(gatherer.gather(rootDirs, config));
    
    Object.keys(components).forEach(function (componentName) {
        app.addComponent(components[componentName]);
    });
    
    return app;
}

module.exports = {
    bootstrap: bootstrap
};
