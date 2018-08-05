
/* global describe, it, beforeEach, afterEach */

var path = require("path");
var assert = require("assert");
var EventEmitter = require("events");

var createHost = require("../host").create;
var createGatherer = require("../gatherer").create;
var injectGathererContext = require("../utils/gatherer-context").inject;

function wrapHost(host) {
    
    var emitter = new EventEmitter();
    
    host.connect("getModule", function () {
        return null;
    });
    
    injectGathererContext(host);
    
    return {
        call: host.call,
        channel: host.channel,
        connect: host.connect,
        connectMany: host.connectMany,
        disconnect: host.disconnect,
        decorate: host.decorate,
        removeDecorator: host.removeDecorator,
        getInterface: host.getInterface,
        createInterface: host.createInterface,
        connectInterface: host.connectInterface,
        disconnectInterface: host.disconnectInterface,
        createFacade: host.createFacade,
        isChannel: host.isChannel,
        isChannelObject: host.isChannelObject,
        isFacade: host.isFacade,
        isInterface: host.isInterface,
        isInterfaceClient: host.isInterfaceClient,
        isInterfaceDefinition: host.isInterfaceDefinition,
        once: emitter.once.bind(emitter),
        publish: emitter.emit.bind(emitter),
        subscribe: emitter.on.bind(emitter),
        on: emitter.on.bind(emitter),
        unsubscribe: emitter.removeListener.bind(emitter),
        removeListener: emitter.removeListener.bind(emitter),
        destroy: function () {}
    };
}

describe("gatherer", function () {
    
    var gatherer, host;
    
    beforeEach(function () {
        
        var context;
        
        host = createHost();
        
        context = wrapHost(host);
        gatherer = createGatherer(context);
        
        // context.subscribe("error", console.error.bind(console));
        context.subscribe("error", function () {});
        
        gatherer.init();
        
    });
    
    afterEach(function () {
        gatherer.destroy();
        host.destroy();
    });
    
    describe("gatherer/gatherFileNames", function () {
        
        it("should find all .com.js files in components/", function () {
            
            var expected = [
                "broken.comp.json",
                "component1.comp.json",
                "misc/component2.comp.json"
            ].sort();
            
            var files = gatherer.gatherFileNames(path.join(__dirname, "components"), {
                patterns: ["**/*.comp.json"]
            });
            
            assert(Array.isArray(files));
            assert.equal(files.length, expected.length);
            assert.equal(JSON.stringify(files.sort()), JSON.stringify(expected));
            
        });
        
    });
    
    describe("gatherer/gather", function () {
        
        it("should read all valid components in components/", function () {
            
            var components = gatherer.gather([path.join(__dirname, "components")], {
                patterns: ["**/*.comp.json"]
            });
            
            assert(components && typeof components === "object", "Expected an object");
            
            assert.equal(
                JSON.stringify(Object.keys(components).sort()),
                JSON.stringify(["component1@1.0.0", "component2@1.0.0"].sort())
            );
            
        });
        
    });
    
});
