/*  Brick.js v0.2 <https://github.com/taiyoh/Brick.js> 
    is released under the MIT License <http://www.opensource.org/licenses/mit-license.php> 
*/

(function(global) {

var objExtend, eventsSelector = {};

// util functions

function _bind(f, self) {
    var args = makeArray(arguments, 2);
    return function() {
        return f.apply(self, args.concat(makeArray(arguments)));
    };
}

function _each(list, callback, cxt) {
    var i = 0, e, t;
    for(; e = list[i]; ++i) {
        t = cxt ? _bind(callback, cxt)(e, i) : callback(e, i);
        if (t === true) {
            break;
        }
    }
}

function _map(list, callback, cxt) {
    var newlist = [];
    _each(list, function(e, i) {
        newlist.push(cxt ? _bind(callback, cxt)(e, i) : callback(e, i));
    }, cxt);
    return newlist;
}

function _select(list, callback, cxt) {
    var newlist = [];
    _each(list, function(e, i) {
        var ret = cxt ? _bind(callback, cxt)(e, i) : callback(e, i);
        if (ret) newlist.push(e);
    }, cxt);
    return newlist;
}

function detectType(o) {
    return Object.prototype.toString.call(o)
        .replace(/^\[object (.+)\]$/, '$1');
}

function makeArray(args, sp) {
    if (!sp) sp = 0;
    return Array.prototype.slice.call(args, sp);
}

objExtend = (function(re) {
    function _cloneObject(o, type) {
        var newList = [];
        if(!type) type = detectType(o);
        if (type == 'Array') {
            return _map(o, function(e) { return _cloneObject(e); });
        }
        else if (type == 'Object' || type == 'Arguments') {
            return _extendObject({}, o, true);
        }
        else if (type == 'Date') {
            return new Date(o.toString());
        }
        else {
            return o;
        }
    }

    function _extendObject(p, o, deepCopy) {
        var k, v, key;
        for (k in o) {
            v = o[k];
            var type = detectType(v);
            if (/^\+/.test(k) && type == 'Object') {
                key = k.replace(/^\+/, '');
                p[key] = _extendObject(p[key], v, deepCopy);
            }
            else {
                p[k] = (deepCopy && re.test(type))
                    ? _cloneObject(v, type)
                    : v;
            }
        }
        return p;
    }

    return function() {
        var deepCopy = false, args = makeArray(arguments), parent;
        if (detectType(args[0]) == 'Boolean') {
            deepCopy = args.shift();
        }
        parent = args.shift();
        _each(args, function(obj) { _extendObject(parent, obj, deepCopy); });
        return parent;
    };
})(/Object|Array|Date|Arguments/i);

if (!String.prototype.ucFirst) {
    String.prototype.ucFirst = function() {
        return this.replace(/^(.)(.+)$/, function() {
            var a = makeArray(arguments, 1);
            return a[0].toUpperCase() + a[1].toLowerCase();
        });
    };
}

// <!-- default attachment classes

function Events() {}

function Events_initialize() {
    if (!this._stack) this._stack = {};
}
function Events_bind(name, callback) {
    if(!this._stack[name]) {
        this._stack[name] = [];
    }
    this._stack[name].push(_bind(callback, this));
}
function Events_unbind(name, callback) {
    if (typeof this._stack[name] == 'undefined') return;
    this._stack[name] = _select(this._stack[name], function(c) {
        return c == callback;
    });
}
function Events_trigger(name) {
    var args;
    if (!this._stack[name]) return;
    args = Array.prototype.slice.call(arguments, 1);
    _each(this._stack[name], function(c) {
        c.apply(null, args);
    });
}

function Aspects() {}

function Aspects_initialize() {
    if (!this.aspects) this.aspects = {};
    Aspects__ensure.call(this);
}
function Aspects__ensure() {
    var self = this,
        aspects = self.aspects,
        re = /^(\w+)(\s*):(\s*)(\w+)$/,
        label, code, m, method, sign;
    for (label in aspects) {
        code = aspects[label];
        if (detectType(code) != 'Function') continue;
        m = re.exec(label);
        method = m[4];
        sign   = m[1];
        if (!method || !sign) continue;
        sign = sign.ucFirst();
        if (self['add' + sign]) {
            self['add' + sign](method, code);
        }
    }
}
function Aspects_addBefore(label, code) {
    var self = this, orig = self[label];
    if (!orig) return;
    self[label] = function() {
        code.apply(self, arguments);
        return orig.apply(self, arguments);
    };
    
}
function Aspects_addAfter(label, code) {
    var self = this, orig = self[label];
    if (!orig) return;
    self[label] = function() {
        var args = makeArray(arguments),
            res  = orig.apply(self, args);
        args.unshift(res);
        code.apply(self, args);
        return res;
    };
}
function Aspects_addAround(label, code) {
    var self = this, orig = self[label];
    if (!orig) return;
    self[label] = function() {
        var args = makeArray(arguments);
        args.unshift(orig);
        return code.apply(self, args);
    };
}

// default attachment classes -->

function eventsSelector_jquery(bind, sel, callback) {
    var el = sel ? $(sel, this.el) : $(this.el);
    el.bind(bind, callback);
}
function eventsSelector_notie(bind, sel, callback) {
    var self = this, els;
    if (sel) {
        els = self.el.querySelectorAll(sel);
        _each(els, function(el) {
            el.addEventListener(bind, callback, false);
        });
    }
    else {
        self.el.addEventListener(bind, callback, false);
    }
}
function eventsSelector_forie(bind, sel, callback) {
    var self = this;
    if (sel) {
        //TODO: CSS Selector...
        throw new Error('sorry... use jQuery');
    }
    else {
        self.el.attachEvent('on' + bind, callback);
    }
}

function Brick_plugin_set(label, klass) {
    var selected = false;
    _each(this.list, function(e) {
        if (e.label == label) {
            e.klass = klass;
            selected = true;
        }
        return selected;
    });
    if (!selected) {
        this.list.push({ label: label, klass: klass });
    }
}

function Brick_plugin_remove(label) {
    this.list = _select(this.list, function(e) {
         return e.label == label;
    });
}

function Brick_plugin_load() {
    return _map(this.list, function(e) {
        return objExtend({}, new e.klass);
    });
}

// <!-- internal methos for Brick class

function Brick__buildElement() {
    if (this.el) return;
    var div = document.createElement(this.tagName), a;
    if (this.className) div.className = this.className;
    for (a in this.attributes) {
        div[a] = this.attributes[a];
    }
    objExtend(div.style, this.style);
    this.el = div;
}

function Brick__attachEvents() {
    var self = this,
        method = 'jquery',
        key, callback, m, bind, sel;
    if (!window.jQuery || !jQuery.fn || !jQuery.fn.bind) {
        if (window.addEventListener) {
            method = 'notie';
        }
        else {
            method = 'forie';
        }
    }
    for (key in self.events) {
        callback = this.events[key];
        m = /^([^\s]+)\s+(.+)$/.exec(key);
        if (m) {
            bind = m[1];
            sel  = m[2];
        }
        else {
            bind = key;
            sel  = null;
        }
        if (detectType(callback) == 'String') {
            callback = _bind(self[callback], self);
        }
        eventsSelector[method].call(self, bind, sel, callback);
    }
}
// internal methos for Brick class -->

// <!-- public methos for Brick class -->
function Brick_remove() {
    var parent = this.el.parentNode;
    if (parent) {
        parent.removeChild(this.el);
    }
}
// public methos for Brick class -->

function Brick_init(parent, extend) {
    function BrickObj(obj) {
        var self = this;
        _each(this.plugin_initializers, function(init) {
            init.call(self, obj);
        });
        if (!obj) obj = {};
        if (obj.tagName)   this.tagName = obj.tagName;
        if (obj.className) this.className = obj.className;
        if (obj.el) {
            this.el = obj.el;
        }
        else {
            Brick__buildElement.call(this);
        }
        Brick__attachEvents.call(this);
        this.initialize(obj);
    }

    BrickObj.prototype = parent;
    BrickObj.extend = extend;

    return BrickObj;
}

function Brick_extend() {
    var parent = (this)
        ? objExtend(true, {}, this.prototype)
        : {},
        c = Brick_init(parent, arguments.callee);
    _each(makeArray(arguments), function(obj) {
        objExtend(true, c.prototype, obj);
    });
    return c;
}

function Brick_create() {
    var args = Brick.plugins.load(), brick = new Brick;
    _each(args, function(arg) {
        if (arg.initialize && typeof arg.initialize == 'function') {
            brick.plugin_initializers.push(arg.initialize);
            delete arg.initialize;
        }
    });
    return Brick_extend.apply(null, args.concat(brick, makeArray(arguments)));
}

function Brick() {
    this.attributes = {};
    this.style      = {};
    this.events     = {};
    this.plugin_initializers = [];
}

eventsSelector = {
    jquery: eventsSelector_jquery,
    notie : eventsSelector_notie,
    forie : eventsSelector_forie
};

Brick.prototype = {
    tagName   : 'div',
    className : '',
    attributes: {},
    style     : {},
    events    : {},
    remove: Brick_remove,
    plugin_initializers : [],
    initialize : function() {},
    build: function() { throw new Error('define this method!'); }
};

Brick.plugins = {
    list  : [],
    set   : Brick_plugin_set,
    remove: Brick_plugin_remove,
    load  : Brick_plugin_load
};

Events.prototype = {
    initialize: Events_initialize,
    bind      : Events_bind,
    unbind    : Events_unbind,
    trigger   : Events_trigger
};

Aspects.prototype = {
    initialize : Aspects_initialize,
    addBefore  : Aspects_addBefore,
    addAfter   : Aspects_addAfter,
    addAround  : Aspects_addAround
};

Brick.plugins.set('event',   Events);
Brick.plugins.set('aspects', Aspects);

Brick.create = Brick_create;

global.Brick = Brick;

})(window);
