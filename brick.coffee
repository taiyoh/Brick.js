makeArray = (args, sp) ->
        return Array::slice.call args, sp ? 0

detectType = (o) ->
        return Object::toString.call(o)
                .replace /^\[object (.+)\]$/, '$1'

_bind = (f, self) ->
        args = makeArray arguments, 2
        return ->
                f.apply self, args.concat makeArray arguments

objExtend = ((re) ->
        _cloneObject = (o, type) ->
                type ?= detectType o
                switch type
                        when "Array"
                                return (_cloneObject(e) for e in o)
                        when "Object", "Arguments"
                                return _extendObject {}, o, true
                        when "Date"
                                return new Date o.toString()
                        else
                                return o

        _extendObject = (p, o, deepCopy) ->
                for k, v of o
                        type = detectType v
                        if /^\+/.test(k) and type is "Object"
                                key = k.replace /^\+/, ''
                                p[key] = _extendObject p[key], v, deepCopy
                        else
                                p[k] = if deepCopy and re.test(type) then _cloneObject(v, type) else v

                return p

        return ->
                deepCopy = false
                args = makeArray(arguments)
                deepCopy = args.shift() if detectType(args[0]) is "Boolean"
                parent = args.shift()
                _extendObject(parent, obj, deepCopy) for obj in args
                return parent

)(/Object|Array|Date|Arguments/i)

String::ucFirst ?= ->
        @replace /^(.)(.+)$/, ->
                a = makeArray arguments, 1
                a[0].toUpperCase() + a[1].toLowerCase()

class Events
        initialize: ->
                @_stack ?= {}

        bind: (name, callback) ->
                @_stack[name] ?= []
                @_stack[name].push(_bind callback, this)
                return

        unbind: (name, callback) ->
                return unless @_stack[name]
                @_stack[name] = (c for c in @_stack[name] when c != callback)
                return

        trigger: (name) ->
                return unless @_stack[name]
                args = makeArray arguments, 1
                c.apply(null, args) for c in @_stack[name]
                return

class Aspects
        initialize: ->
                @aspects ?= {}
                @__ensure()

        __ensure: ->
                re = /^(\w+)(\s*):(\s*)(\w+)$/
                for label, code of @aspects
                        continue unless detectType(code) is "Function"
                        m = re.exec label
                        method = m[4]
                        sign   = m[1]
                        continue if !method or !sign
                        sign = sign.ucFirst()
                        this["add#{sign}"]?.call(this, method, code)
                return

        addBefore: (label, code) ->
                orig = this[label]
                return unless orig
                self = this
                self[label] = ->
                        args = makeArray arguments
                        code.apply self, args
                        orig.apply self, args
                return

        addAfter: (label, code) ->
                orig = this[label]
                return unless orig
                self = this
                self[label] = ->
                        args = makeArray arguments
                        res  = orig.apply self, args
                        args.unshift res
                        code.apply self, args
                        res
                return

        addAround: (label, code) ->
                orig = this[label]
                return unless orig
                self = this
                self[label] = ->
                        args = makeArray arguments
                        args.unshift orig
                        code.apply self, args
                return


this.Brick = ((Brick) ->
        _eventsSelector =
                jquery: (bind, sel, callback) ->
                        el = if sel then $(sel, @el) else $(@el)
                        el.bind bind, callback
                        return

                notie: (bind, sel, callback) ->
                        if sel
                                els = @el.querySelectorAll sel
                                el.addEventListener(bind, callback, false) for el in els
                        else
                                @el.addEventListener bind, callback, false
                        return

                forie: (bind, sel, callback) ->
                        throw new Error("sorry... use jQuery" ) if sel
                        @el.attachEvent("on#{bind}", callback)
                        return

        Brick.plugins =
                list  : []
                set   : (label, klass) ->
                        selected = false
                        for e in @list
                                if e.label is label
                                        e.klass = klass
                                        selected = true
                                        break
                        @list.push({ label: label, klass: klass }) unless selected
                        return
                remove: (label) ->
                        @list = (e for e in @list when e.label != label)
                        return
                load  : -> (objExtend({}, new e.klass) for e in @list)

        _buildElement = ->
                return unless @el
                div = document.createElement @tagName
                div.className = @className if @className
                div[a] = v for a, v of @attributes
                objExtend div.style, @style
                @el = div
                return

        Brick.prototype =
                tagName   : 'div'
                className : ''
                attributes: {}
                style     : {}
                events    : {}
                plugin_initializers : []
                initialize : ->
                build: ->
                        throw new Error('define this method!')
                        return
                attachEvents: ->
                        method = 'jquery'
                        if !window.jQuery? || !jQuery.fn? || !jQuery.fn.bind?
                                method = if windw.addEventListener? then "notie" else "forie"
                        for key, callback of @events
                                m = /^([^\s]+)\s+(.+)$/.exec key
                                if m
                                        bind = m[1]
                                        sel  = m[2]
                                else
                                        bind = key
                                        sel  = null
                                callback = _bind this[callback], this if detectType(callback) is "String"
                                _eventsSelector[method].call this, bind, sel, callback
                        return
                remove: ->
                        @el.parentNode?.removeChild @el
                        return

        Brick_init = (parent, extend) ->
                BrickObj = (obj) ->
                        obj ?= {}
                        init.call(this, obj) for init in @plugin_initializers
                        @tagName   = obj.tagName if obj.tagName
                        @className = obj.className if obj.className
                        if obj.el?
                                @el = obj.el
                        else
                                _buildElement.call this
                        @attachEvents()
                        @initialize obj
                        return

                BrickObj.prototype = parent
                BrickObj.extend    = extend

                return BrickObj

        Brick_extend = ->
                parent = if this then objExtend(true, {}, @prototype) else {}
                c = Brick_init parent, arguments.callee
                for obj in makeArray(arguments)
                        objExtend true, c.prototype, obj
                c

        Brick.create = ->
                args = Brick.plugins.load()
                brick = new Brick
                for arg in args
                        if arg.initialize? and typeof arg.initialize is "function"
                                brick.plugin_initializers.push arg.initialize
                                delete arg.initialize
                Brick_extend.apply null, args.concat brick, makeArray arguments
                return

        Brick.plugins.set 'event',   Events
        Brick.plugins.set 'aspects', Aspects

        return Brick
)(->
        @attributes = {}
        @style      = {}
        @events     = {}
        @plugin_initializers = []
        return
)
