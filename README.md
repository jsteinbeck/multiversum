
# Multiversum

A toolbox for implementing an "everything's a plugin" architecture in JavaScript.

## How it works

Multiversum consists of a plugin host, a component gatherer, a bootstrapper and an application
module.

A component consists of an implementation file (JavaScript) and a definition file (JSON).
The gatherer finds all component definitions in a list of directories and allows you to
filter the components according to the meta data in the definition files.

The application manages the lifecycle of components and resolves the dependency graph of
the components.

Each component interacts with the rest of the application via the plugin host. The plugin
host can be used to broadcast and receive messages. Each component can define one or more
interfaces and connect them to the application using the plugin host.

An interface is a set of *channels*. A channel is an abstraction of a method. Components can
connect implementations for a channel, and when the channel is called the result of the
first implementation that doesn't throw an error is used, starting with the implementation
with the highest priority.

Components can also decorate channels. This is the main way extensibility is realized
in Multiversum. Decorators that throw errors are transparently ignored, so that a faulty
extension doesn't necessarily break the whole application.

## Usage

```js
var createApp = require("multiversum/bootstrap").bootstrap;

var app = createApp([process.cwd()], {
    patterns: ["**/*.com.json"], // A list of file patterns
    onError: console.error.bind(console), // Called when errors occur during the bootstrap phase
    // A function for filtering components using the meta data in the definition files:
    filter: function (component) {
        // Only use components that are made for this app:
        return component.application === "my-application";
    }
});

// Initialize all the components in an order that respects the dependencies of each component:
app.init();
```

A definition file can look like this:

```json
{
    "name": "myComponent",
    "application": "my-application",
    "applicationVersion": "2.2.1",
    "offers": ["interfaceA", "interfaceB"],
    "requires": ["interfaceC"],
    "file": "./myComponent.js"
}
```

And a component implementation usually looks like this:

```js
function create(context) {
    
    var api = context.createInterface("interfaceC", {
        doSomething: doSomething,
        doSomethingElse: doSomethingElse
    });
    
    function init() {
        context.connectInterface(api);
    }
    
    function destroy() {
        context.disconnectInterface(api);
    }
    
    function doSomething() {
        api.doSomethingElse();
    }
    
    function doSomethingElse() {
        console.log("Doing something else");
    }
    
    return {
        init: init,
        destroy: destroy
    };
}

module.exports = {
    create: create
};

```

Components can also communicate using the context as an event bus:

```js
function create(context) {
    
    // Publishing a message with an (optional) payload:
    context.publish("myComponent/foo", {foo: "bar"});
    
    // Subscribing a listener:
    context.subscribe("otherComponent/foo", listener);
    
    // Subscribing a listener that is only called once:
    context.once("otherComponent/foo", listener);
    
    // Removing a listener:
    context.unsubscribe("otherComponent/foo", listener);
    
    function listener(data) {
        console.log("Received data:", JSON.stringify(data, null, 4));
    }
}
```

If you want to run something once all components have been initialized, subscribe to the
`app/ready` message using the context.

A component can extend other components using decorators:

```js
function create(context) {
    
    // Decorate a channel:
    context.decorate("myComponent/foo", function (fn) {
        return function () {
            console.log("myComponent/foo was called!");
            return fn.apply(null, arguments);
        };
    });
    
    // Decorate all channels:
    context.decorate(function (fn) {
        return function () {
            // ...
            return fn.apply(null, arguments);
        };
    });
    
    // Removing a decorator:
    context.removeDecorator("myComponent/foo", /* the decorator */);
}
```
