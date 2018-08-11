/* global describe, it */

var assert = require("assert");
var createHost = require("../host").create;

describe("host", function () {
    
    describe(".connect(channel, fn[, config])", function () {
        
        it("should add a subscriber function `fn` to `channel`", function () {
            
            var plugins = createHost();
            var called = false;
            
            plugins.connect("foo", function () {
                called = true;
            });
            
            plugins.call("foo");
            
            assert(called, "The subscriber wasn't called!");
            
            plugins.destroy();
        });
        
    });
    
    describe(".call(channel[, arg1, ..., argN])", function () {
        
        it("should call a subscriber as often as `.call(channel)` is called", function () {
            
            var calls = 0;
            var plugins = createHost();
            
            plugins.connect("foo", function () {
                calls += 1;
            });
            
            assert.equal(calls, 0);
            
            plugins.call("foo");
            
            assert.equal(calls, 1);
            
            plugins.call("foo");
            plugins.call("foo");
            
            assert.equal(calls, 3);
            
            plugins.destroy();
            
        });
        
        it("should return a value if the `fn` function returns one", function () {
            
            var plugins = createHost();
            
            plugins.connect("foo", function () {
                return "yes";
            });
            
            assert.equal(plugins.call("foo"), "yes");
            
            plugins.destroy();
            
        });
        
        it("should supply the `data` argument to subscribers", function () {
            
            var plugins = createHost();
            var obj = {foo: "bar"};
            
            plugins.connect("foo", function (data) {
                return data;
            });
            
            assert.strictEqual(plugins.call("foo", [obj]), obj);
            assert.strictEqual(plugins.call("foo", ["bar"]), "bar");
            assert.strictEqual(plugins.call("foo", [1]), 1);
            assert.strictEqual(plugins.call("foo", [0]), 0);
            assert.strictEqual(plugins.call("foo", [-1]), -1);
            
            plugins.destroy();
            
        });
        
        it(
            "should call subscribers with high priority first, and stop at the first not throwing",
            function () {
                
                var plugins = createHost();
                var calls = 0;
                var errors = 0;
                var connectErrors = 0;
                
                plugins.connect("foo", function () {
                    calls += 1;
                    return "baz";
                }, {priority: 2, onError: increaseConnectErrors});
                
                plugins.connect("foo", function () {
                    throw new Error("Expected to throw!");
                }, {priority: 3, onError: increaseConnectErrors});
                
                plugins.connect("foo", function () {
                    calls += 1;
                    return "biz";
                }, {priority: 1, onError: increaseConnectErrors});
                
                assert.equal(plugins.channel("foo").onError(increaseErrorCount).call(), "baz");
                assert.equal(calls, 1);
                assert.equal(errors, 1);
                assert.equal(connectErrors, 1);
                
                plugins.destroy();
                
                function increaseErrorCount() {
                    errors += 1;
                }
                
                function increaseConnectErrors() {
                    connectErrors += 1;
                }
            }
        );
        
        it("should only use subscribers and decorators whose version is compatible", function () {
            
            var plugins = createHost();
            
            plugins.connect("foo", function (arr) {
                
                arr.push("foo");
                
                return arr;
                
            });
            
            plugins.connect("foo@2", function (arr) {
                
                arr.push("foo@2");
                
                return arr;
                
            });
            
            plugins.decorate("foo", function (fn) {
                return function (arr) {
                    
                    arr = fn(arr);
                    
                    arr.push("foo_dec");
                    
                    return arr;
                };
            }, {priority: 3});
            
            plugins.decorate("foo@1.x", function (fn) {
                return function (arr) {
                    
                    arr = fn(arr);
                    
                    arr.push("foo@1.x_dec");
                    
                    return arr;
                };
            });
            
            plugins.decorate("foo@2.x", function (fn) {
                return function (arr) {
                    
                    arr = fn(arr);
                    
                    arr.push("foo@2.x_dec");
                    
                    return arr;
                };
            });
            
            assert.equal(
                JSON.stringify(plugins.channel("foo@1").call([])),
                JSON.stringify(["foo", "foo_dec", "foo@1.x_dec"])
            );
            
            assert.equal(
                JSON.stringify(plugins.channel("foo@2.x").call([])),
                JSON.stringify(["foo@2", "foo@2.x_dec"])
            );
            
            assert.equal(
                JSON.stringify(plugins.channel("foo").call([])),
                JSON.stringify(["foo", "foo_dec", "foo@1.x_dec"])
            );
            
            plugins.destroy();
            
        });
        
        it("should work with any number of arguments", function () {
            
            var plugins = createHost();
            
            plugins.connect("foo", function (a, b, c) {
                return "" + a + ";" + b + ";" + c;
            });
            
            plugins.connect("bar", function () {
                return arguments.length;
            });
            
            assert.equal(plugins.channel("foo").call("foo", "bar", "baz"), "foo;bar;baz");
            assert.equal(plugins.channel("bar").call(), 0);
            assert.equal(plugins.channel("bar").call(1), 1);
            assert.equal(plugins.channel("bar").call(1, 2, 3), 3);
            
            plugins.destroy();
            
        });
        
    });
    
    describe(".decorate(channel, fn[, config])", function () {
        
        it("should decorate a subscriber with additional functionality", function () {
            
            var callStack = [];
            var result = runDecorations(callStack);
            
            assert.equal(JSON.stringify(callStack), JSON.stringify(["dec_1", "dec_2", "sub_1"]));
            
            assert.equal(
                JSON.stringify(result, null, 4),
                JSON.stringify({foo: "zap", bar: "baz", extra: "!!", more: "yep"}, null, 4)
            );
        });
        
        it("should not cause the whole channel to fail if `fn` produces an error", function () {
            
            var errors = 0;
            var callStack = [];
            var result = runDecorations(callStack, true, increaseErrorCount);
            
            assert.equal(JSON.stringify(callStack), JSON.stringify(["dec_1", "sub_1"]));
            assert.equal(errors, 1);
            
            assert.equal(
                JSON.stringify(result, null, 4),
                JSON.stringify({foo: "yes", bar: "baz", more: "yep"}, null, 4)
            );
            
            function increaseErrorCount() {
                errors += 1;
            }
        });
    });
    
    describe(".decorate(fn, config)", function () {
        
        it("should always apply", function () {
            
            var plugins = createHost();
            
            plugins.connect("foo", function (arr) {
                arr.push("foo");
                return arr;
            });
            
            plugins.connect("bar@1.2", function (arr) {
                arr.push("bar@1.2");
                return arr;
            });
            
            plugins.connect("bar@2.5", function (arr) {
                arr.push("bar@2.5");
                return arr;
            });
            
            plugins.decorate(function (fn) {
                return function (arr) {
                    arr = fn(arr);
                    arr.push("*1");
                    return arr;
                };
            });
            
            plugins.decorate("bar@>=1", function (fn) {
                return function (arr) {
                    arr = fn(arr);
                    arr.push("bar@>=1");
                    return arr;
                };
            });
            
            plugins.decorate("foo", function (fn) {
                return function (arr) {
                    arr = fn(arr);
                    arr.push("foo_dec");
                    return arr;
                };
            });
            
            plugins.decorate("x", function (fn) {
                return function (arr) {
                    arr = fn(arr);
                    arr.push("x");
                    return arr;
                };
            });
            
            assert.equal(
                JSON.stringify(plugins.channel("foo").call([]).sort()),
                JSON.stringify(["foo", "foo_dec", "*1"].sort())
            );
            
            plugins.decorate(function (fn) {
                return function (arr) {
                    arr = fn(arr);
                    arr.push("*2");
                    return arr;
                };
            });
            
            assert.equal(
                JSON.stringify(plugins.channel("bar").call([]).sort()),
                JSON.stringify(["bar@1.2", "bar@>=1", "*1", "*2"].sort())
            );
            
            assert.equal(
                JSON.stringify(plugins.channel("bar@2.x").call([]).sort()),
                JSON.stringify(["bar@2.5", "bar@>=1", "*1", "*2"].sort())
            );
            
            plugins.destroy();
            
        });
        
    });
    
    describe(".isInterface(thing)", function () {
        
        it("should return true only for interface objects", function () {
            
            var plugins = createHost();
            
            var iface = plugins.createInterface("foo", {
                bar: function () {}
            });
            
            assert(plugins.isInterface(iface), "iface should be recognized as an interface");
            assert(!plugins.isInterface({}));
            assert(!plugins.isInterface([]));
            assert(!plugins.isInterface(0));
            assert(!plugins.isInterface(1));
            assert(!plugins.isInterface(-1));
            assert(!plugins.isInterface("asdsad"));
            assert(!plugins.isInterface(""));
            assert(!plugins.isInterface(false));
            assert(!plugins.isInterface(true));
            assert(!plugins.isInterface(null));
        });
        
    });
    
    describe(".createInterface(name, methods)", function () {
        
        it("should create an object with all methods wrapped as channels", function () {
            
            var plugins = createHost();
            
            var count = {
                foo: 0,
                bar: 0
            };
            
            var impl = {
                foo: function () {
                    count.foo += 1;
                },
                bar: function(m, n) {
                    count.bar += n;
                }
            };
            
            var iface = plugins.createInterface("test", impl);
            
            assert(iface && typeof iface === "object", "iface should be an object");
            assert(plugins.isInterface(iface), "iface must be an interface object");
            assert.equal(typeof iface.foo, "function", "iface.foo must be a function");
            assert.equal(typeof iface.bar, "function", "iface.bar must be a function");
            assert(plugins.isChannel(iface.foo), "iface.foo must be a channel");
            assert(plugins.isChannel(iface.bar), "iface.bar must be a channel");
        });
        
    });
    
    describe(".connectInterface(iface)", function () {
        
        it("should connect all methods as channels, prefixed by `[interface]/`", function () {
            
            var plugins = createHost();
            
            var count = {
                foo: 0,
                bar: 0
            };
            
            var impl = {
                foo: function () {
                    count.foo += 1;
                },
                bar: function(m, n) {
                    count.bar += n;
                }
            };
            
            var iface = plugins.createInterface("test", impl);
            
            plugins.connectInterface(iface);
            
            assert.equal(count.foo, 0);
            assert.equal(count.bar, 0);
            
            iface.foo();
            
            assert.equal(count.foo, 1);
            assert.equal(count.bar, 0);
            
            iface.bar(0, 5);
            
            assert.equal(count.bar, 5);
            
            plugins.channel("test/foo")();
            
            assert.equal(count.foo, 2);
            
            plugins.channel("test/bar")(3, 5);
            
            assert.equal(count.bar, 10);
        });
        
    });
    
});

function runDecorations(callStack, fail, onError) {
    
    var result;
    var plugins = createHost();
    
    plugins.connect("foo", function (data) {
        callStack.push("sub_1");
        data.bar = "baz";
        return data;
    });
    
    plugins.decorate("foo", function (fn) {
        return function (data) {
            
            if (fail) {
                throw new Error("Expected to fail!");
            }
            
            callStack.push("dec_2");
            
            data.foo = "zap";
            data = fn(data);
            data.extra = "!!";
            
            return data;
        };
    }, {priority: 2, onError: onError});
    
    plugins.decorate("foo", function (fn) {
        return function (data) {
            callStack.push("dec_1");
            data.foo = "yes";
            data = fn(data);
            data.more = "yep";
            return data;
        };
    }, {priority: -1});
    
    result = plugins.call("foo", [{}]);
    
    plugins.destroy();
    
    return result;
}
