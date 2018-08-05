
var dependencies = {
    fs: require("fs"),
    path: require("path"),
    assert: require("assert"),
    semver: require("semver"),
    minimatch: require("minimatch")
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
