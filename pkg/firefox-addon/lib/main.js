var widgets = require("sdk/widget");
var tabs = require("sdk/tabs");
var self = require("sdk/self");

var button = widgets.Widget({
    id: "stxt-icon",
    label: "stxt button",
    contentURL: self.data.url("html/stxt-button.html"),
    onClick: function() { tabs.open(self.data.url("html/stxt-main.html")) }
});
