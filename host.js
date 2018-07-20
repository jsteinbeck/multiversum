//
// # Plugin Host
//
// The plugin host manages plugins in the form of *channels* and *interfaces*
//
// ## Channels
//
// A *channel* is a single hook defined by a *channel name* and an optional *semantic version*.
// Implementations can be added to a channel, and consumers of the channel can call it like a
// function or method.
//
// If more than one implementation is added to a channel, the one with the highest *priority*
// gets called. If an error is thrown and there are implementations with lower priority, the
// implementation with the next highest priority gets called until there's either no
// implementations left or calling one of the implementations doesn't throw an error.
//
// ### Channel Names
//
// A channel name looks like this:
//
//     foo/bar@1.2.0
//
// The `foo/` part is an optional namespace prefix. The `bar` is the channel identifier.
// The `@1.2.0` is an optional [semantic version](https://semver.org/) string.
//
// The version string, if present, must be a full semantic version string when defining a channel.
// When calling a channel, the version string can contain any version selector that
// [minimatch](https://www.npmjs.com/package/minimatch) can understand, e.g. `>= 2.1.0`.
//
// ### Channel Decorators
//
// Additional behavior can be added, or existing behavior modified, by decorating a channel.
// A decorator is a function that takes the implementation function or another decorator
// function and returns another function that calls the function that was given as an argument.
//
// ### Priority
//
// When adding an implementation or a decorator to a channel, it is possible to specify the
// priority of the implementation or decorator. Priority can be any number from `MIN_INT`
// to `MAX_INT`. Implementations or decorators are applied from lowest to highest.
//
// ## Interfaces
//
// Because defining or getting many related channels at once can be repetitive, the plugin
// host uses the concept of *interfaces*. An interface should not be confused with interfaces
// as they are known from many programming languages. An interface here is an object that
// has as its methods channels with a specific namespace prefix.
//
// Interfaces can either be *interface clients* or *interface definitions*. An interface client
// can only be used to call an interface's methods while an interface definition additionally
// allows connecting and disconnecting all of its associated channels at once.
//
// Interface clients can be acquired by calling the `.getInterface(name, methodNames)` method.
// Interface definitions on the other hand can only be acquired when creating the interface
// using the `.createInterface(name, implementations)` method.
//
// Which methods belong to an interface isn't strictly defined. Only the users or the creators
// of interfaces know which methods are available. This allows adding channels under a namespace
// prefix without disturbing existing users of the namespace. Interfaces in this sense are strictly
// a convenience added on top of channels.
//
// Usage:
//
// ```js
// var iface = host.createInterface("foo", {
//     doSomething: function () { /* ... */ },
//     "doAnotherThing@1.2.5": function (anArgument) { /* ... */ },
//     doBar: function () { /* ... */ }
// });
//
// host.connectInterface(iface);
// // ...
// host.disconnectInterface(iface);
// ```
//
// ```js
// var foo = host.getInterface("foo", ["doAnotherThing@<2.x", "doSomething"]);
//
// foo.doAnotherThing(2);
// foo.doSomething();
// foo.doBar(); // Error: foo.doBar is not a function
// ```
//
// ## Facades
//
// A facade is another convenience object for interacting with channels. It allows the creation
// of an object with custom method names that map to channels. The channels mapped can belong
// to more than one namespace prefix.
//
// Usage:
//
// ```js
// var myFacade = host.createFacade({
//     doSomething: "foo/doSomething@1.x",
//     doSomethingElse: "bar/doSomething@2.2.x"
// })
// ```
//

var EventEmitter = require("events");
var crypto = require("crypto");
var assert = require("assert");
var semver = require("semver");

var PROPERTY_TYPE = "$__pluginType__";
var PROPERTY_INTERFACE_NAME = "$__pluginInterfaceName__";
var PROPERTY_INTERFACE_METHOD_NAMES = "$__pluginInterfaceMethodNames__";
var PROPERTY_INTERFACE_METHODS = "$__pluginInterfaceMethods__";

var TYPE_CHANNEL = "channel";
var TYPE_CHANNEL_OBJECT = "channelObject";
var TYPE_IFACE = "interface";
var TYPE_IFACE_DEFINITION = "interfaceDefinition";
var TYPE_FACADE = "facade";

function createHash(input) {
    
    var hasher = crypto.createHash("md5");
    
    hasher.update(input);
    
    return "" + hasher.digest("hex");
}

function prioritySort(a, b) {
    
    if (a.config.priority < b.config.priority) {
        return -1;
    }
    
    if (a.config.priority > b.config.priority) {
        return 1;
    }
    
    return 0;
}

function merge(a, b) {
    
    var result = {};
    
    Object.keys(a).forEach(function (key) {
        result[key] = a[key];
    });
    
    Object.keys(b).forEach(function (key) {
        result[key] = b[key];
    });
    
    return result;
}

function create() {
    
    var ids, channels, decorators, descriptors, bus;
    
    init();
    
    function init() {
        bus = new EventEmitter();
        ids = {};
        channels = {};
        decorators = {};
        descriptors = {};
    }
    
    function destroy() {
        bus = null;
        ids = null;
        channels = null;
        decorators = null;
        descriptors = null;
    }
    
    function getId(fn) {
        
        var id;
        var hash = createHash(Function.prototype.toString.call(fn));
        
        if (!(hash in ids)) {
            ids[hash] = [];
        }
        
        id = ids[hash].indexOf(fn);
        
        if (id >= 0) {
            return id;
        }
        
        ids[hash].push(fn);
        
        return hash + "__" + ids[hash].indexOf(fn);
    }
    
    function extractVersion(channel) {
        return semver.coerce(channel.split("@")[1] || "1").version;
    }
    
    function normalizeChannelName(channel) {
        return channel.split("@").shift();
    }
    
    function connect(channel, fn, config) {
        
        var id = getId(fn);
        var version = extractVersion(channel);
        
        assert(channel !== "*", "Channel name cannot be '*'.");
        assert(semver.valid(version), "Not a semantic versioning scheme: " + version);
        
        channel = normalizeChannelName(channel);
        config = config || {};
        config.priority = typeof config.priority === "number" ? config.priority : 0;
        
        if (!channels[channel]) {
            channels[channel] = {};
        }
        else if (id in channels[channel]) {
            return;
        }
        
        if (!hasDescriptor(id)) {
            createDescriptor(id, fn);
        }
        
        channels[channel][id] = {
            id: id,
            channel: channel,
            version: version,
            config: config
        };
        
        descriptors[id].channels[channel] = channel;
        
    }
    
    function hasDescriptor(id) {
        return id in descriptors;
    }
    
    function createDescriptor(id, fn) {
        descriptors[id] = {
            id: id,
            fn: fn,
            channels: {},
            decorated: {},
            regexps: {}
        };
    }
    
    function disconnect(channel, fn) {
        
        var id = getId(fn);
        var descriptor = descriptors[id];
        
        if (!descriptor) {
            return;
        }
        
        if (channel in channels && id in channels[channel]) {
            delete channels[channel][id];
            delete descriptor.channels[channel];
        }
        
        cleanUpDescriptor(id);
    }
    
    function cleanUpDescriptor(id) {
        
        var descriptor = descriptors[id];
        
        if (
            Object.keys(descriptor.channels).length === 0 &&
            Object.keys(descriptor.decorated).length === 0
        ) {
            delete descriptors[id];
        }
    }
    
    function findChannelsByRegExp(regex) {
        return Object.keys(channels).filter(function (name) {
            return regex.test(name);
        });
    }
    
    function addDecorator(channel, fn, config) {
        
        if (typeof channel === "string") {
            return decorate(channel, fn, config);
        }
        
        if (typeof channel === "function") {
            return decorate("*", channel, fn);
        }
        
        throw new TypeError("Type of `channel` parameter is not supported.");
    }
    
    function decorate(channel, fn, config) {
        
        var id = getId(fn);
        var version = channel.split("@")[1] || "1.x";
        
        channel = normalizeChannelName(channel);
        config = config || {};
        config.priority = typeof config.priority === "number" ? config.priority : 0;
        
        if (!decorators[channel]) {
            decorators[channel] = {};
        }
        else if (id in decorators[channel]) {
            return;
        }
        
        if (!hasDescriptor(id)) {
            createDescriptor(id, fn);
        }
        
        decorators[channel][id] = {
            id: id,
            channel: channel,
            version: version,
            config: config
        };
        
        descriptors[id].decorated[channel] = channel;
    }
    
    function removeDecorator(channel, fn) {
        
        var id = getId(fn);
        var descriptor = descriptors[id];
        
        if (!descriptor) {
            return;
        }
        
        if (typeof channel === "string") {
            if (channel in decorators && id in decorators[channel]) {
                delete decorators[channel][id];
                delete descriptor.decorated[channel];
            }
        }
        else {
            findChannelsByRegExp(channel).forEach(function (name) {
                if (name in decorators && id in decorators[name]) {
                    delete decorators[name][id];
                    delete descriptor.decorated[name];
                }
            });
        }
        
        cleanUpDescriptor(id);
    }
    
    function channel(channelName) {
        
        var bus = new EventEmitter();
        
        var api = {
            onError: addErrorHandler,
            call: callChannel
        };
        
        function addErrorHandler(fn) {
            bus.on("error", fn);
            return api;
        }
        
        function callChannel() {
            return call(
                channelName,
                Array.prototype.slice.call(arguments),
                bus.emit.bind(bus, "error")
            );
        }
        
        Object.defineProperty(api, PROPERTY_TYPE, {
            value: TYPE_CHANNEL_OBJECT,
            configurable: false,
            enumerable: false,
            writable: false
        });
        
        Object.defineProperty(callChannel, PROPERTY_TYPE, {
            value: TYPE_CHANNEL,
            configurable: false,
            enumerable: false,
            writable: false
        });
        
        return Object.freeze(api);
    }
    
    function isChannel(thing) {
        return thing && typeof thing === "function" && thing[PROPERTY_TYPE] === TYPE_CHANNEL;
    }
    
    function isChannelObject(thing) {
        return thing && typeof thing === "object" &&
            thing[PROPERTY_TYPE] === TYPE_CHANNEL_OBJECT;
    }
    
    //
    // * **onError:** An optional callback for receiving subscriber errors. Decorator errors
    //   are not included here. Hint: errors are also emitted on the bus as `subscriberError`.
    //
    function call(channel, args, onError) {
        
        var result;
        var version = channel.split("@")[1] || "1.x";
        var channelName = normalizeChannelName(channel);
        var subscribers = prioritize(channelName in channels ? channels[channelName] : {}, version);
        
        var decorations = prioritize(
            merge(channelName in decorators ? decorators[channelName] : {}, decorators["*"] || {})
        );
        
        args = args || [];
        assert(Array.isArray(args), "Parameter `args` must be an array.");
        
        if (!subscribers.length) {
            throw new Error("No implementation connected for channel `" + channel + "`!");
        }
        
        subscribers.reverse().some(function (subscriber) {
            
            var newValue, lastValue, decorated;
            var decos = decorations.slice();
            
            decorated = decos.filter(versionMatches).map(function (decorator) {
                return {
                    fn: decorator.fn(next, {
                        method: "call",
                        channel: channel
                    }),
                    config: decorator.config
                };
            });
            
            decorated.push(subscriber);
            
            function versionMatches(decorator) {
                
                if (decorator.channel === "*") {
                    return true;
                }
                
                return semver.satisfies(subscriber.version, decorator.version);
            }
            
            function next() {
                
                var current;
                var value = lastValue;
                
                while (decorated.length) {
                    
                    current = decorated.shift();
                    
                    if (!decorated.length) {
                        
                        try {
                            value = current.fn.apply(null, arguments);
                        }
                        catch (error) {
                            error.mustReThrow = true;
                            throw error;
                        }
                        
                        break;
                    }
                    
                    try {
                        value = current.fn.apply(null, arguments);
                        lastValue = value;
                    }
                    catch (error) {
                        if (error && typeof error === "object" && error.mustReThrow) {
                            throw error;
                        }
                        else {
                            
                            if (current.config.onError) {
                                current.config.onError(error);
                            }
                            
                            bus.emit("decoratorError", current);
                        }
                    }
                    
                }
                
                return value;
            }
            
            try {
                
                newValue = next.apply(null, args);
                result = newValue;
                
                return true;
            }
            catch (error) {
                
                if (subscriber.config.onError) {
                    subscriber.config.onError(error);
                }
                
                if (onError) {
                    onError(error);
                }
                
                bus.emit("subscriberError", subscriber);
            }
            
            return false;
        });
        
        return result;
    }
    
    function prioritize(subscribers, version) {
        
        function getSubscriber(key) {
            return subscribers[key];
        }
        
        function getFn(subscriber) {
            return {
                fn: descriptors[subscriber.id].fn,
                channel: subscriber.channel,
                version: subscriber.version,
                config: subscriber.config
            };
        }
        
        function versionMatches(subscriber) {
            
            if (!version) {
                return true;
            }
            
            return semver.satisfies(subscriber.version, version);
        }
        
        return Object.keys(subscribers).
            map(getSubscriber).
            filter(versionMatches).
            sort(prioritySort).
            map(getFn);
    }
    
    function emit() {
        return bus.emit.apply(bus, arguments);
    }
    
    function on() {
        return bus.on.apply(bus, arguments);
    }
    
    function once() {
        return bus.once.apply(bus, arguments);
    }
    
    function removeListener() {
        return bus.removeListener.apply(bus, arguments);
    }
    
    function connectMany(implementations) {
        Object.keys(implementations).forEach(function (channelName) {
            
            var impl = implementations[channelName];
            
            if (Array.isArray(impl)) {
                connect(channelName, impl[0], impl[1]);
            }
            else if (typeof impl === "function") {
                connect(channelName, impl);
            }
            else {
                throw new TypeError("Invalid channel implementation `" + channelName + "`");
            }
        });
    }
    
    function disconnectMany(implementations) {
        Object.keys(implementations).forEach(function (channelName) {
            
            var impl = implementations[channelName];
            
            if (Array.isArray(impl)) {
                disconnect(channelName, impl[0]);
            }
            else if (typeof impl === "function") {
                disconnect(channelName, impl);
            }
            else {
                throw new TypeError("Invalid channel implementation `" + channelName + "`");
            }
        });
    }
    
    function createObject(methods) {
        
        assert(methods && typeof methods === "object", "Parameter `methods` must be an object");
        
        return Object.keys(methods).reduce(function (all, methodName) {
            all[methodName] = channel(methods[methodName]).call;
            return all;
        }, {});
    }
    
    function createFacade(methods) {
        
        var facade = createObject(methods);
        
        Object.defineProperty(facade, PROPERTY_TYPE, {
            value: TYPE_FACADE,
            configurable: false,
            enumerable: false,
            writable: false
        });
        
        return Object.freeze(facade);
    }
    
    function isFacade(thing) {
        return thing && typeof thing === "object" && thing[PROPERTY_TYPE] === TYPE_FACADE;
    }
    
    function isInterfaceDefinition(thing) {
        return thing && typeof thing === "object" && thing[PROPERTY_TYPE] === TYPE_IFACE_DEFINITION;
    }
    
    function isInterfaceClient(thing) {
        return thing && typeof thing === "object" && thing[PROPERTY_TYPE] === TYPE_IFACE;
    }
    
    function isInterface(thing) {
        return isInterfaceClient(thing) || isInterfaceDefinition(thing);
    }
    
    function createInterface(name, methods) {
        
        var implementations = prefixProperties(name, methods);
        var iface = getInterfaceClient(name, Object.keys(methods));
        
        Object.defineProperty(iface, PROPERTY_TYPE, {
            value: TYPE_IFACE_DEFINITION,
            configurable: false,
            enumerable: false,
            writable: false
        });
        
        Object.defineProperty(iface, PROPERTY_INTERFACE_NAME, {
            value: name,
            configurable: false,
            enumerable: false,
            writable: false
        });
        
        Object.defineProperty(iface, PROPERTY_INTERFACE_METHOD_NAMES, {
            value: Object.keys(implementations),
            configurable: false,
            enumerable: false,
            writable: false
        });
        
        Object.defineProperty(iface, PROPERTY_INTERFACE_METHODS, {
            value: implementations,
            configurable: false,
            enumerable: false,
            writable: false
        });
        
        return Object.freeze(iface);
    }
    
    function connectInterface(iface) {
        
        assert(isInterfaceDefinition(iface), "Not an interface definition!");
        
        connectMany(iface[PROPERTY_INTERFACE_METHODS]);
    }
    
    function disconnectInterface(iface) {
        
        assert(isInterfaceDefinition(iface), "Not an interface definition!");
        
        disconnectMany(iface[PROPERTY_INTERFACE_METHODS]);
    }
    
    function getInterfaceClient(name, methodNames) {
        
        assert.equal(typeof name, "string", "Argument `name` must be a string");
        assert(Array.isArray(methodNames), "Argument `methodName` must be an array");
        
        return createObject(methodNames.reduce(function (all, methodName) {
            all[methodName] = name + "/" + methodName;
            return all;
        }, {}));
    }
    
    function getInterface(name, methodNames) {
        
        var iface = getInterfaceClient(name, methodNames);
        
        Object.defineProperty(iface, PROPERTY_TYPE, {
            value: TYPE_IFACE,
            configurable: false,
            enumerable: false,
            writable: false
        });
        
        return Object.freeze(iface);
    }
    
    function prefixProperties(prefix, obj) {
        return Object.keys(obj).reduce(function (all, key) {
            all[prefix + "/" + key] = obj[key];
            return all;
        }, {});
    }
    
    return {
        destroy: destroy,
        on: on,
        subscribe: on,
        once: once,
        removeListener: removeListener,
        unsubscribe: removeListener,
        publish: emit,
        connect: connect,
        connectMany: connectMany,
        disconnect: disconnect,
        decorate: addDecorator,
        removeDecorator: removeDecorator,
        channel: channel,
        isChannel: isChannel,
        isChannelObject: isChannelObject,
        call: call,
        isFacade: isFacade,
        createFacade: createFacade,
        isInterface: isInterface,
        isInterfaceClient: isInterfaceClient,
        isInterfaceDefinition: isInterfaceDefinition,
        getInterface: getInterface,
        createInterface: createInterface,
        connectInterface: connectInterface,
        disconnectInterface: disconnectInterface
    };
}

module.exports = {
    create: create
};
