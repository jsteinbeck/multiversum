
var fs = require("fs");
var path = require("path");
var assert = require("assert");
var semver = require("semver");
var minimatch = require("minimatch");
var readDir = require("fs-readdir-recursive");

var CHANNELS = {
    GATHER: "gatherer/gather",
    GATHER_FILE_NAMES: "gatherer/gatherFileNames",
    READ_COMPONENT: "gatherer/readComponent",
    READ_COMPONENTS: "gatherer/readComponents",
    RESOLVE_COMPONENT: "gatherer/resolveComponent",
    RESOLVE_COMPONENTS: "gatherer/resolveComponents",
    MATCH_PATTERN: "gatherer/matchPattern",
    IS_VALID_PATTERN: "gatherer/isValidPattern"
};

var EVENTS = {
    ERROR: "error",
    GATHERER_ERROR: "gatherer/error"
};

function create(context) {
    
    var gatherer = context.createInterface("gatherer", {
        gather: gather,
        gatherFileNames: gatherFileNames,
        readComponent: readComponent,
        readComponents: readComponents,
        matchPattern: matchPattern,
        isValidPattern: isValidPattern,
        resolveComponent: resolveComponent,
        resolveComponents: resolveComponents
    });
    
    function init() {
        context.connectInterface(gatherer);
    }
    
    function destroy() {
        context.disconnectInterface(gatherer);
    }
    
    function unique(value, index, arr) {
        return arr.indexOf(value) === index;
    }
    
    function gather(rootDirs, config) {
        
        var handledFiles = {};
        var components = {};
        
        assert(Array.isArray(rootDirs), "Paramter `rootDir` must be an array");
        assert(config && typeof config === "object", "Parameter `config` must be an object");
        assert("patterns" in config, "Property `config.patterns` is required");
        assert(Array.isArray(config.patterns), "Property `config.patterns` must be an array");
        
        rootDirs.forEach(function (rootDir) {
            
            var files = gatherer.gatherFileNames(rootDir, config).
                filter(unique).
                filter(fileHandled);
            
            var componentsInDir = gatherer.readComponents(files, rootDir, config);
            
            Object.keys(componentsInDir).forEach(function (key) {
                
                if (key in components) {
                    emitComponentExistsError(key);
                    return;
                }
                
                components[key] = componentsInDir[key];
            });
        });
        
        function fileHandled(file) {
            
            if (file in handledFiles) {
                return false;
            }
            
            handledFiles[file] = true;
            
            return true;
        }
        
        return components;
    }
    
    function emitComponentExistsError(componentId) {
        emitError(new Error("Component already exists: " + componentId));
    }
    
    function readComponents(files, rootDir, config) {
        
        var components = {};
        
        files.forEach(function (fileName) {
            
            var componentId;
            var filePath = path.join(rootDir, fileName);
            var component = gatherer.readComponent(filePath);
            
            if (!component) {
                return;
            }
            
            componentId = component.name + "@" + component.version;
            
            if (component.application) {
                componentId = component.application + "/" + componentId;
            }
            
            if (componentId in components) {
                emitComponentExistsError(componentId);
                return;
            }
            
            if (typeof config.filter === "function") {
                if (config.filter(component, filePath, config)) {
                    components[componentId] = component;
                }
            }
            else {
                components[componentId] = component;
            }
            
        });
        
        return components;
    }
    
    function readComponent(filePath) {
        
        var component;
        
        if (!fs.existsSync(filePath)) {
            emitError(new Error("No such component file: " + filePath));
            return;
        }
        
        try {
            
            component = require(filePath); // eslint-disable-line global-require
            component.definitionFile = filePath;
            component.file = path.join(path.dirname(filePath), path.basename(component.file));
            
            assertComponent(component);
            
        }
        catch (error) {
            emitError(new Error("Cannot read component at `" + filePath + "`"));
            emitError(error);
            return;
        }
        
        return component;
    }
    
    function gatherFileNames(rootDir, config) {
        return readDir(rootDir).filter(function (fileName) {
            
            return config.patterns.some(function (pattern) {
                
                if (!gatherer.isValidPattern(pattern)) {
                    emitError(new Error("Pattern `" + pattern + "` is invalid"));
                    return false;
                }
                
                return gatherer.matchPattern(fileName, pattern);
            });
        });
    }
    
    function resolveComponents(definitions) {
        
        var components = {};
        
        Object.keys(definitions).forEach(function (key) {
            
            var component;
            var definition = definitions[key];
            
            try {
                
                component = resolveComponent(definition);
                
                assert(
                    component && typeof component === "object",
                    "Components must export objects"
                );
                
                assert(typeof component.create === "function", "component.create isn't a function");
                
                definition.create = component.create;
                components[key] = definition;
            }
            catch (error) {
                emitError(new Error("Cannot resolve component `" + key + "`:" + error.message));
            }
        });
        
        return components;
    }
    
    function resolveComponent(componentDefinition) {
        return require(componentDefinition.file); // eslint-disable-line global-require
    }
    
    function isValidPattern(pattern) {
        return typeof pattern === "string" && pattern.length;
    }
    
    function matchPattern(fileName, pattern) {
        return minimatch(fileName, pattern);
    }
    
    function assertComponent(component) {
        
        assert(component && typeof component === "object", "Components must export objects");
        assert("name" in component, "Components must have a `name` property");
        assert.equal(typeof component.name, "string", "Component names must be strings");
        assert(component.name.length, "Component names cannot be empty strings");
        assert("file" in component, "Components must have a `file` property");
        assert.equal(typeof component.file, "string", "Component property `file` must be a string");
        assert(component.name.length, "Component property `file` cannot be an empty strings");
        assert("version" in component, "Components must have a `version` property");
        assert.equal(typeof component.version, "string", "Component versions must be strings");
        
        assert(
            semver.valid(component.version),
            "Invalid version in component `" + component.name + "`"
        );
    }
    
    function emitError(error) {
        context.publish(EVENTS.GATHERER_ERROR, error);
        context.publish(EVENTS.ERROR, error);
    }
    
    return {
        init: init,
        destroy: destroy,
        gather: context.channel(CHANNELS.GATHER).call,
        gatherFileNames: context.channel(CHANNELS.GATHER_FILE_NAMES).call,
        resolveComponent: context.channel(CHANNELS.RESOLVE_COMPONENT).call,
        resolveComponents: context.channel(CHANNELS.RESOLVE_COMPONENTS).call
    };
}

module.exports = {
    create: create
};
