/**
 * The main class required to set up a Tree instance in the browser.
 *
 * @class Tree
 **/

define(function(require, exports, module) {
"use strict";

var oop = require("ace-code/src/lib/oop");
var Scrollable = require("./scrollable");
var dom = require("ace-code/src/lib/dom");
var escapeHTML = require("ace-code/src/lib/lang").escapeHTML;

var DataProvider = function(root) {
    this.rowHeight = 25;
    this.setRoot(root);
};

(function() {
    this.rowHeight = undefined;
    this.rowHeightInner = undefined;
    this.$indentSize = 10;
    
    oop.implement(this, Scrollable);

    this.$sortNodes = true;
    
    this.setRoot = function(root){
        if (Array.isArray(root))
            root = {items: root};
        
        this.root = root || {};
        
        if (this.root.$depth == undefined) {
            this.root.$depth = -1;
        }
        if (this.root.$depth < 0) {
            this.visibleItems = [];
            this.open(this.root);
            this.visibleItems.unshift();
        } else {
            this.visibleItems = [this.root];
        }
        this.$selectedNode = this.root;
        
        this._signal("setRoot");
        this._signal("change");
    };
    
    this.open = 
    this.expand = function(node, deep, silent) {
        if (typeof deep != "number")
            deep = deep ? 100 : 0;
        if (!node)
            return;
        
        var items = this.visibleItems;
        if (this.isOpen(node) && (node !== this.root || items.length))
            return;
        var ch = this.getChildren(node);
        if (this.loadChildren && this.shouldLoadChildren(node, ch)) {
            var timer = setTimeout(function() {
                node.status = "loading";
                this._signal("change", node);
            }.bind(this), 100);
            this.loadChildren(node, function(err, ch) {
                clearTimeout(timer);
                this.collapse(node, null, true);
                node.status = "loaded";
                if (!err)
                    this.expand(node, null, false);
            }.bind(this));
            this.setOpen(node, true);
            return;
        }
        this.setOpen(node, true);
        var i = items.indexOf(node);
        if (!ch) {
            this._signal("change", node);
            return;
        }
        if (i === -1 && items.length || this.forceEmpty)
            return;
        ch = [i + 1, 0].concat(ch);
        items.splice.apply(items, ch);
        
        for (var j = 2; j < ch.length; j++) {
            var childNode = ch[j];
            if (this.isOpen(childNode)) {
                this.setOpen(childNode, false);
                this.open(childNode, deep - 1, silent);
            } else if (deep > 0) {
                this.open(childNode, deep - 1, silent);
            }
        }
        
        this.rows = items.length;
        silent || this._signal("expand", node);
    };
    
    this.close =
    this.collapse = function(node, deep, silent) {
        if (typeof deep != "number")
            deep = deep ? 1000 : 0;
        var items = this.visibleItems;
        var isRoot = node === this.root;
        if (isRoot) {
            this.setOpen(node, false);
            if (deep) {
                for (var i = 0; i < items.length; i++) {
                    var ch = items[i];
                    if (!ch.isRoot)
                    if (this.isOpen(ch) && ch.$depth - node.$depth < deep) {
                        this.setOpen(ch, false);
                        silent || this._signal("collapse", ch);
                    }
                }
            }
            items.length = 0;
            if (isRoot)
                this.open(this.root, 0, silent);
            return;
        }

        if (!node || !this.isOpen(node))
            return;
        var i = items.indexOf(node);
        if (i === -1)
            return;
        var thisDepth = node.$depth;
        var deletecount = 0;
        for (var t = i + 1; t < items.length; t++) {
            if (items[t].$depth > thisDepth)
                deletecount++;
            else
                break;
        }
        
        if (deep) {
            for (var j = 0; j < deletecount; j++) {
                var ch = items[j + i];
                if (this.isOpen(ch) && ch.$depth - node.$depth < deep) {
                    this.setOpen(ch, false);
                    silent || this._signal("collapse", ch);
                }
            }
        }
        items.splice(i + 1, deletecount);
        this.setOpen(node, false);
        silent || this._signal("collapse", node);
        
        if (isRoot)
            this.open(this.root, 0, silent);
    };
    
    this.toggleNode = function(node, deep, silent) {
        if (node && this.isOpen(node))
            this.close(node, deep, silent);
        else
            this.open(node, deep, silent);
    };
        
    this.sort = function(children, compare) {
        if (!compare) {
            compare = alphanumCompare;
        }
        return children.sort(function(a, b) {
            var aChildren = a.children || a.map;
            var bChildren = b.children || b.map;
            if (aChildren && !bChildren) return -1;
            if (!aChildren && bChildren) return 1;
            
            return compare(a.label || "", b.label || "");
        });
    };
    
    this.setFilter = function(fn) {
        this.$filterFn = fn;
        this.setRoot(this.root);
    };
    this.getChildren = function(node) {
        var children = node.children;
        if (!children) {
            if (node.status === "pending")
                return;
            if (node.map) {
                children = Object.keys(node.map).map(function(key) {
                    var ch = node.map[key];
                    ch.parent = node;
                    return ch;
                });
            } else if (node.items) {
                children = node.items;
            }
            if (children) {
                node.children = children;
            }
        }
        var ch = children && children[0] && children[0];
        if (ch) {
            var d = (node.$depth + 1) || 0;
            children.forEach(function(n) {
                 n.$depth = d;
                 n.parent = node;
            });
        }
        
        if (this.$filterFn) {
            children = children && children.filter(this.$filterFn);
        }

        if (this.$sortNodes && !node.$sorted) {
            children && this.sort(children);
        }
        return children;
    };
    this.loadChildren = null;
    this.shouldLoadChildren = function(node, ch) {
        return node.status === "pending";
    };
    
    this.hasChildren = function(node) {
        if (node.children)
            return node.children.length !== 0;
        return node.map || node.status === "pending"
            || node.items && node.items.length;
    };
    
    this.findNodeByPath = function() {
    
    };
    
    this.getSibling = function(node, dir) {
        if (!dir) dir = 1;
        var parent = node.parent;
        var ch = this.getChildren(parent);
        var pos = ch.indexOf(node);
        return ch[pos + dir];
    };
    
    this.getNodeAtIndex = function(i) {
        return this.visibleItems[i];
    };
    
    this.getIndexForNode = function(node) {
        return this.visibleItems.indexOf(node);
    };
    
    this.getMinIndex = function() {return 0};
    this.getMaxIndex = function() {return this.visibleItems.length - 1};
    
    this.setOpen = function(node, val) {
        return node.isOpen = val;
    };
    this.isOpen = function(node) {
        return node.isOpen;
    };
    this.isVisible = function(node) {
        return this.visibleItems.indexOf(node) !== -1;
    };
    this.isSelected = function(node) {
        return node.isSelected;
    };
    this.setSelected = function(node, val) {
        return node.isSelected = !!val;
    };
    this.isSelectable = function(node) {
        return !node || !(node.noSelect || node.$depth < 0);
    };
    
    this.isAncestor = function(node, child) {
        do {
            if (child == node)
                return true;
        } while (child = child.parent);
        return false;
    };
    
    this.setAttribute = function(node, name, value) {
        node[name] = value;
        this._signal("change", node);
    };
    
    this.getDataRange = function(rows, columns, callback) {
        var view = this.visibleItems.slice(rows.start, rows.start + rows.length);        
        callback(null, view, false);
        return view;
    };
    
    this.getRange = function(top, bottom) {
        var start = Math.floor(top / this.rowHeight);
        var end = Math.ceil(bottom / this.rowHeight) + 1;
        var range = this.visibleItems.slice(start, end);
        range.count = start;
        range.size = this.rowHeight * range.count;
        return range;
    };
    this.getTotalHeight = function(top, bottom) {
        return this.rowHeight * this.visibleItems.length;
    };
    
    this.getNodePosition = function(node) {
        var i = this.visibleItems.indexOf(node);
        if (i == -1 && node && node.parent) {
            i = this.visibleItems.indexOf(node.parent);
        }
        var top = i * this.rowHeight;
        var height = this.rowHeight;
        return {top: top, height: height};
    };
    
    this.findItemAtOffset = function(offset, clip) {
        var index = Math.floor(offset / this.rowHeight);
        if (clip) 
            index = Math.min(Math.max(0, index), this.visibleItems.length - 1);
        return this.visibleItems[index];
    };
    this.getIconHTML = function(node) {
        return "";
    };
    this.getClassName = function(node) {
        return (node.className || "") + (node.status == "loading" ? " loading" : "");
    };
    this.setClass = function(node, name, include) {
        node.className = node.className || "";
        dom.setCssClass(node, name, include);
        this._signal("changeClass");
    };
    this.redrawNode = null;
    this.getCaptionHTML = function(node) {
        return escapeHTML(node.label || node.name || (typeof node == "string" ? node : ""));
    };
    this.getContentHTML = null;
    this.getEmptyMessage = function() { return this.emptyMessage || "" };
    this.getText = function(node) {
        return node.label || node.name || "";
    };
    this.getRowIndent = function(node){
        return node.$depth;
    };
    this.hideAllNodes = function(){
        this.visibleItems = [];
        this.forceEmpty   = true;
        this.setRoot(this.root);
    };
    this.showAllNodes = function(){
        this.forceEmpty   = false;
        this.setRoot(this.root);
    };
    
}).call(DataProvider.prototype);

function alphanumCompare(a, b) {
    var caseOrder = 0;
    for (var x = 0, l = Math.min(a.length, b.length); x < l; x++) {
        var ch1 = a.charCodeAt(x);
        var ch2 = b.charCodeAt(x);
        
        if (ch1 < 58 && ch2 < 58 && ch1 > 47 && ch2 > 47) {
            var num1 = 0, num2 = 0;
            var n = x;
            do {
                num1 = 10 * num1 + (ch1 - 48);
                ch1 = a.charCodeAt(++n);
            } while(ch1 > 47 && ch1 < 58);
            n = x;
            do {
                num2 = 10 * num2 + (ch2 - 48);
                ch2 = b.charCodeAt(++n);
            } while(ch2 > 47 && ch2 < 58);
            
            if (num1 === num2)
                x = n - 1;
            else
                return num1 - num2;
        } else if (ch1 !== ch2) {
            var ch1L = a[x].toLowerCase();
            var ch2L = b[x].toLowerCase();
            if (ch1L < ch2L) return -1;
            if (ch1L > ch2L) return 1;
            if (!caseOrder) caseOrder = ch2 - ch1;
        }
    }
    return caseOrder || a.length - b.length;
}

DataProvider.alphanumCompare = alphanumCompare;
DataProvider.prototype.alphanumCompare = alphanumCompare;
DataProvider.variableHeightRowMixin = function() {
    var reset = function () {
        this.$cachedTotalHeight = 0;
    }.bind(this);
    this.on("collapse", reset);
    this.on("expand", reset);
    // this.rowCache 
    this.getNodePosition = function(node) {
        var i = this.visibleItems.indexOf(node);
        if (i == -1 && node && node.parent) {
            i = this.visibleItems.indexOf(node.parent);
        }
        
        var items = this.visibleItems;
        var top = 0, height = 0;
        for (var index = 0; index < i; index++) {
            height = this.getItemHeight(items[index], index);
            top += height;
        }
        height = this.getItemHeight(items[i], i);
        return {top: top, height: height};
    };
    
    this.findIndexAtOffset = function(offset, clip) {
        var items = this.visibleItems;
        var top = 0, index = 0, l = items.length;
        while (index < l) {
            var height = this.getItemHeight(items[index], index);
            top += height;
            index++;
            if (top >= offset) {
                index--;
                top -= height;
                break;
            }
        }
        
        if (clip) 
            index = Math.min(Math.max(0, index), items.length - 1);
        return index;
    }; 
    
    this.findItemAtOffset = function(offset, clip) {
        var index = this.findIndexAtOffset(offset, clip);
        return this.visibleItems[index];
    };
    
    this.getItemHeight = function(node, index) {
        return node.height || this.rowHeight;
    };
    
    this.getRange = function(top, bottom) {
        var items = this.visibleItems;
        var startH = 0, index = 0, l = items.length;
        while (index < l) {
            var height = this.getItemHeight(items[index], index);
            startH += height;
            index++;
            if (startH >= top) {
                index--;
                startH -= height;
                break;
            }
        }
        index = Math.min(Math.max(0, index), items.length - 1);
        
        var start = index;
        var end = this.findIndexAtOffset(bottom, true) + 1;
        var range = this.visibleItems.slice(start, end);
        range.count = start;
        range.size = startH;
        return range;
    };
    
    this.getTotalHeight = function () {
        if (!this.$cachedTotalHeight) {
            var items = this.visibleItems;
            var height = 0;
            for (var index = 0; index < items.length; index++) {
                height += this.getItemHeight(items[index], index);
            }
            this.$cachedTotalHeight = height;
        }
        return this.$cachedTotalHeight;
    };
};
module.exports = DataProvider;
});
