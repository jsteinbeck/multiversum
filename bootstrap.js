
var createApp = require("./app").create;
var createHost = require("./host").create;
var createGatherer = require("./gatherer").create;
var injectAppContext = require("./utils/app-context").inject;
var injectGathererContext = require("./utils/gatherer-context").inject;

function bootstrap(rootDirs, config) {
    
    var components, gatherer, app;
    
    var host = createHost();
    
    host.connect("getModule", function () {
        return null;
    });
    
    injectGathererContext(host);
    injectAppContext(host);
    
    app = createApp(host);
    gatherer = createGatherer(host);
    
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
