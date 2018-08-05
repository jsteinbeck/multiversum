
var dependencies = {
    DependencyGraph: require("dependency-graph").DepGraph
};

function inject(host) {
    host.decorate("getModule", function (fn) {
        return function (name) {
            
            var result = fn.apply(null, arguments);
            
            if (result) {
                return result;
            }
            
            return dependencies[name];
        };
    });
}

module.exports = {
    inject: inject
};
