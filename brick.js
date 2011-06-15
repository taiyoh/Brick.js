/**
 * Brick.js
 */

(function(global) {

// util functions
function detectType(o) {
	return Object.prototype.toString.call(o)
		.replace(/^\[object (.+)\]$/, '$1');
}

function makeArray(args, sp) {
	if (!sp) sp = 0;
	return Array.prototype.slice.call(args, sp);
}

var objExtend = (function() {
	var re = new RegExp('Object|Array|Date|Arguments', 'i');

	function _cloneObject(o, type) {
		if(!type) type = detectType(o);
		if (type == 'Array') {
			var newList = new Array;
			for (var i = 0, e; e = o[i];  i++) {
				newList.push(_cloneObject(e));
			}
			return newList;
		}
		else if (type == 'Object' || type == 'Arguments') {
			return _extendObject(new Object, o, true);
		}
		else if (type == 'Date') {
			return new Date(o.toString());
		}
		else {
			return o;
		}
	}

	function _extendObject(p, o, deepCopy) {
		for (var k in o) {
			var v = o[k];
			var type = detectType(v);
			if (/^\+/.test(k) && type == 'Object') {
				var key = k.replace(/^\+/, '');
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
		var deepCopy = false;
		var args = makeArray(arguments);
		if (detectType(args[0]) == 'Boolean') {
			deepCopy = args.shift();
		}
		var parent = args.shift();
		for (var i = 0, obj; obj = args[i]; i++) {
			_extendObject(parent, obj, deepCopy);
		}
		return parent;
	};
})();

if (!Function.prototype.bind)
Function.prototype.bind = function() {
	var f = this;
	var args = makeArray(arguments);
	var self = args.shift();
	return function() {
		return f.apply(self, args.concat(makeArray(arguments)));
	};
};

if (!String.prototype.ucFirst)
String.prototype.ucFirst = function() {
	return this.replace(/^(.)(.+)$/, function() {
		var a = makeArray(arguments, 1);
		return a[0].toUpperCase() + a[1].toLowerCase();
	});
};

function Events() {
	this._stack = new Object;
}
Events.prototype = {
	_stack: new Object,
	bind: function(name, callback) {
		if(!this._stack[name]) {
			this._stack[name] = new Array;
		}
		this._stack[name].push(callback.bind(this));
	},
	unbind: function(name, callback) {
		if (typeof this._stack[name] == undefined) return;
		var callbacks = new Array;
		if (callback) {
			for (var i = 0, c; c = this._stack[name][i]; i++) {
				if (c != callback) {
					callbacks.push(c);
				}
			}
		}
		this._stack[name] = callbacks;
	},
	trigger: function(name) {
		if (!this._stack[name]) return;
		var args = Array.prototype.slice.call(arguments, 1);
		for (var i = 0, c; c = this._stack[name][i]; i++) {
			c.apply(null, args);
		}
	}
};

function Aspects() {
	this.aspects = new Object;
}
Aspects.prototype = {
	aspects  : new Object,
	_ensureAspects: function() {
		var self = this;
		var aspects = self.aspects;
		var re = /^(\w+)(\s*):(\s*)(\w+)$/;
		for (var label in aspects) {
			var code = aspects[label];
			if (detectType(code) != 'Function') continue;
			var m = re.exec(label);
			var method = m[4], sign = m[1];
			if (!method || !sign) continue;
			sign = sign.ucFirst();
			if (self['add' + sign])
				self['add' + sign](method, code);
		}
	},
	addBefore: function(label, code) {
		var self = this;
		var orig = self[label];
		if (!orig) return;
		self[label] = function() {
			code.apply(self, arguments);
			return orig.apply(self, arguments);
		};
	},
	addAfter: function(label, code) {
		var self = this;
		var orig = self[label];
		if (!orig) return;
		self[label] = function() {
			var args = makeArray(arguments);
			var res = orig.apply(self, args);
			args.unshift(res);
			code.apply(self, args);
			return res;
		};
	},
	addAround: function(label, code) {
		var self = this;
		var orig = self[label];
		if (!orig) return;
		self[label] = function() {
			var args = makeArray(arguments);
			args.unshift(orig);
			return code.apply(self, args);
		};
	}
};

function Brick() {}
Brick.prototype = {
	tagName   : 'div',
	className : '',
	attributes: new Object,
	style     : new Object,
	events    : new Object,
	_buildElement: function() {
		if (this.el) return;
		var div = document.createElement(this.tagName);
		if (this.className) div.className = this.className;
		for (var a in this.attributes) {
			div[a] = this.attributes[a];
		}
		objExtend(div.style, this.style);
		this.el = div;
	},
	_attachEventsSelector: {
		jquery: function(bind, sel, callback) {
			var el = sel ? $(sel, this.el) : $(this.el);
			el.bind(bind, callback);
		},
		notie: function(bind, sel, callback) {
			var self = this;
			if (sel) {
				var els = self.el.querySelectorAll(sel);
				for (var i = 0, el; el = els[i]; i++) {
					e.addEventListener(bind, callback, false);
				}
			}
			else {
				self.el.addEventListener(bind, callback, false);
			}
		},
		forie: function(bind, sel, callback) {
			var self = this;
			if (sel) {
				//TODO: CSS Selector...
				throw new Error('sorry... use jQuery');
			}
			else {
				self.el.attachEvent('on' + bind, callback);
			}
		}
	},
	_attachEvents: function() {
		var self = this;
		var method = 'jquery';
		if (!window.jQuery || !jQuery.fn || !jQuery.fn.bind) {
			if (window.addEventListener) {
				method = 'notie';
			}
			else {
				method = 'forie';
			}
		}
		for (var key in self.events) {
			var callback = self.events[key];
			var m = /^([^\s]+)\s+(.+)$/.exec(key);
			var bind, sel;
			if (m) {
				bind = m[1];
				sel  = m[2];
			}
			else {
				bind = key;
				sel  = null;
			}
			if (detectType(callback) == 'String') {
				callback = self[callback].bind(self);
			}
			self._attachEventsSelector[method].call(self, bind, sel, callback);
		}
	},
	initialize: function() {},
	build: function() { throw new Error('define this method!'); },
	remove: function() {
		var parent = this.el.parentNode;
		if (parent) {
			parent.removeChild(this.el);
		}
	}
};

Brick.create = function() {
	var initBrick = function() {
		return function BrickObj(obj) {
			this._stack = new Object;
			this._ensureAspects();
			if (obj) {
				if (obj.tagName)   this.tagName   = obj.tagName;
				if (obj.className) this.className = obj.className;
				if (obj.el) {
					this.el = obj.el;
				}
				else {
					this._buildElement();
				}
			}
			else {
				this._buildElement();
			}
			this._attachEvents();
			this.initialize.call(this, obj);
		};
	};
	var _extend = function() {
		var func = arguments.callee;
		var args = makeArray(arguments);
		var parent = (this)
			? objExtend(true, new Object, this.prototype)
			: new Object;
		var c = initBrick();
		c.extend = func;
		c.prototype = parent;
		for (var i = 0, obj; obj = args[i]; i++) {
			objExtend(true, c.prototype, obj);
		}
		return c;
	};
	var args = [new Events, new Aspects, new Brick].concat(makeArray(arguments));
	return _extend.apply(null, args);
};

global.Brick = Brick;

})(window);
