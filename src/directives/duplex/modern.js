
var valueHijack = require('./valueHijack')

var newField = require('./newField')
var initField = require('./bindEvents.modern')
var updateField = require('./updateField.modern')
var addField = require('./addField')
var update = require('../_update')

var evaluatorPool = require('../../strategy/parser/evaluatorPool')

avalon.directive('duplex', {
    priority: 2000,
    parse: function (cur, pre, binding) {
        var id = binding.expr
        newField(binding, pre)
        avalon.caches[id] = pre.field
        cur.vmodel = '__vmodel__'
        var type = pre.props.type
        if (type) {
            cur.props.type = avalon.quote(type)
        }
        cur.props['ms-duplex'] = avalon.quote(id)
        cur.props['data-duplex-get'] = evaluatorPool.get('duplex:' + id)
        cur.props['data-duplex-set'] = evaluatorPool.get('duplex:set:' + id)

        var format = evaluatorPool.get('duplex:format:' + id)
        if (format) {
            cur.props['data-duplex-format'] = format
        }
    },
    diff: function (cur, pre, steps) {
        var duplexID = cur.props["ms-duplex"]
        cur.field = pre.field || avalon.mix({}, avalon.caches[duplexID])
        var field = cur.field
        if (!field.set) {
            initField(cur)
        }

        var value = field.get(field.vmodel)
        if (cur.type !== 'select' && cur.props.type !== 'checkbox')
            cur.props.value = value

        if (cur.type === 'select' && !cur.children.length) {
            avalon.Array.merge(cur.children, avalon.lexer(cur.template, 0, 2))
            fixVirtualOptionSelected(cur, value)
        }

        if (!field.element) {
            var isEqual = false
        } else {
            var preValue = pre.props.value
            if (Array.isArray(value)) {
                isEqual = value + '' === preValue + ''
            } else {
                isEqual = value === preValue
            }
        }

        if (!isEqual) {
            field.modelValue = value
            update(cur, this.update, steps, 'duplex', 'afterChange')
        }
    },
    update: function (node, vnode) {
        var field = node._ms_field_ = vnode.field
        if (!field.element) {//这是一次性绑定
            field.element = node //方便进行垃圾回收
            var events = field.events
            for (var name in events) {
                avalon.bind(node, name, events[name])
                delete events[name]
            }
        }
        addField(node, vnode)
        if (!avalon.msie && valueHijack === false && !node.valueHijack) {
            //chrome 42及以下版本需要这个hack
            node.valueHijack = field.update
            var intervalID = setInterval(function () {
                if (!avalon.contains(avalon.root, node)) {
                    clearInterval(intervalID)
                } else {
                    node.valueHijack()
                }
            }, 30)
        }

        var viewValue = field.format(field.modelValue)
        if (field.viewValue !== viewValue) {
            field.viewValue = viewValue
            updateField[field.type].call(field)
            if (node.caret) {
                var pos = field.caretPos
                pos && field.updateCaret(node, pos.start, pos.end)
                field.caretPos = null
            }
        }
    }
})


function fixVirtualOptionSelected(cur, curValue) {
    var options = []
    cur.children.forEach(function (a) {
        if (a.type === 'option') {
            options.push(a)
        } else if (a.type === 'optgroup') {
            a.children.forEach(function (c) {
                if (c.type === 'option') {
                    options.push(c)
                }
            })
        }
    })
    var multi = cur.props.multiple
    var map = {}
    var one = multi === null || multi === void 0 || multi === false
    if (Array.isArray(curValue)) {
        curValue.forEach(function (a) {
            map[a] = 1
        })
    } else {
        map[curValue] = 1
    }
    for (var i = 0, option; option = options[i++]; ) {
        var v = 'value' in option.props ? option.props.value : (option.children[0] || {nodeValue: ''}).nodeValue.trim()
        option.props.selected = !!map[v]
        if (map[v] && one) {
            break
        }
    }
}
