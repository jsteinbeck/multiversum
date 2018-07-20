
var DependencyGraph = require("dependency-graph").DepGraph;
var createPluginManager = require("./host.js").create;

function create() {
    
    var instances, appInitialized;
    
    var components = {};
    var host = createPluginManager();
    var toBeInitialized = [];
    var graph = new DependencyGraph({});
    
    var app = host.createInterface("app", {
        publish: host.publish.bind(host),
        subscribe: host.on.bind(host),
        unsubscribe: host.removeListener.bind(host),
        once: host.once.bind(host),
        init: init,
        destroy: destroy,
        hasComponent: hasComponent,
        addComponent: addComponent,
        removeComponent: removeComponent,
        createContext: createContext,
        sortByDependencies: sortByDependencies
    });
    
    host.connectInterface(app);
    
    function init() {
        
        if (appInitialized) {
            return;
        }
        
        appInitialized = true;
        instances = {};
        
        app.sortByDependencies(toBeInitialized).forEach(function (component) {
            try {
                initComponent(component);
            }
            catch (error) {
                app.publish("app/componentInitError", error);
                app.publish("app/error", error);
            }
        });
        
        app.publish("app/ready");
        
        toBeInitialized = [];
    }
    
    function destroy() {
        
        if (!appInitialized) {
            return;
        }
        
        Object.keys(components).forEach(function (key) {
            app.removeComponent(components[key]);
        });
        
        host.destroy();
        
        host = null;
        appInitialized = false;
    }
    
    function sortByDependencies(toBeSorted) {
        
        var order = graph.overallOrder().filter(isComponentKey);
        
        return toBeSorted.sort(function (a, b) {
            
            var aKey = getComponentKey(a);
            var bKey = getComponentKey(b);
            var aIndex = order.indexOf(aKey);
            var bIndex = order.indexOf(bKey);
            
            if (aIndex === bIndex) {
                return 0;
            }
            
            return aIndex < bIndex ? -1 : 1;
        });
    }
    
    function initComponent(component) {
        
        var context, instance;
        
        if (typeof component.create !== "function") {
            throw new Error("Component `" + component.name + "` doesn't have a `create` function!");
        }
        
        context = app.createContext(component);
        instance = component.create(context) || {};
        
        app.publish("app/initComponent", component);
        
        instances[component.name] = {
            name: component.name,
            context: context,
            api: instance
        };
        
        if ("init" in instance) {
            instance.init();
        }
    }
    
    function createContext() {
        return host;
    }
    
    function getInterfaceKey(name) {
        return "if_" + name;
    }
    
    function getComponentKey(component) {
        return "comp_" + component.name + "@" + (component.version || "1.0.0");
    }
    
    function isComponentKey(key) {
        return (/^comp_/).test(key);
    }
    
    function addComponent(component) {
        
        var version;
        
        if (hasComponent(component.name, component.version)) {
            throw new Error("Component '" + component.name + "' already exists!");
        }
        
        if (!(component.name in components)) {
            components[component.name] = {};
        }
        
        version = component.version || "1.0.0";
        components[component.name][version] = component;
        
        graph.addNode(getComponentKey(component));
        
        if (Array.isArray(component.offers)) {
            component.offers.forEach(function (offer) {
                
                var key = getInterfaceKey(offer);
                
                if (!graph.hasNode(key)) {
                    graph.addNode(key);
                }
                
                graph.addDependency(key, getComponentKey(component));
            });
        }
        
        if (Array.isArray(component.requires)) {
            component.requires.forEach(function (requirement) {
                
                var key = getInterfaceKey(requirement);
                
                if (!graph.hasNode(key)) {
                    graph.addNode(key);
                }
                
                graph.addDependency(getComponentKey(component), key);
            });
        }
        
        if (appInitialized) {
            initComponent(component);
        }
        else {
            toBeInitialized.push(component);
        }
        
        app.publish("app/componentAdded", component);
    }
    
    function hasComponent(name, version) {
        return name in components && (version ? version in components[name] : true);
    }
    
    function removeComponent(component) {
        
        if (!(component.name in components)) {
            return;
        }
        
        if (component.name in instances && instanceHasDestroyMethod(instances[component.name])) {
            
            try {
                instances[component.name].api.destroy();
            }
            catch (error) {
                app.publish("app/componentDestroyError", error);
                app.publish("app/error", error);
            }
            
            delete instances[component.name];
        }
        
        delete components[component.name][component.version || "1.0.0"];
        
        app.publish("app/componentRemoved", component);
    }
    
    function instanceHasDestroyMethod(inst) {
        return typeof inst.api.destroy === "function";
    }
    
    function createExportObject() {
        
        var out = {};
        
        var facade = host.createFacade({
            init: "app/init",
            destroy: "app/destroy",
            addComponent: "app/addComponent",
            hasComponent: "app/hasComponent",
            removeComponent: "app/removeComponent"
        });
        
        Object.keys(facade).forEach(function (key) {
            if (typeof facade[key] === "function") {
                out[key] = facade[key];
            }
        });
        
        Object.keys(host).forEach(function (key) {
            if (typeof host[key] === "function" && !(key in out)) {
                out[key] = host[key];
            }
        });
        
        return out;
    }
    
    return createExportObject();
}

module.exports = {
    create: create
};
