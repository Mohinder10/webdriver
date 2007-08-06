FirefoxDriver.prototype.click = function(position) {
    var element = Utils.getElementAt(position, this.context);
    if (!element) {
        this.server.respond(this.context, "click");
        return;
    }

    // Attach a listener so that we can wait until any page load this causes to complete
    var driver = this;
    var server = this.server;
	var alreadyReplied = false;
    var clickListener = new WebLoadingListener(this, function(event) {
		if (!alreadyReplied) {
			alreadyReplied = true;
        	server.respond(driver.context, "click");
		}
    });

    element.focus();
    Utils.fireMouseEventOn(this.context, element, "mousedown");

    // Now do the click
    if (element["click"]) {
        element.click();
    } else {
        // Send the mouse event too. Not sure if this will cause the thing to be double clicked....
        Utils.fireMouseEventOn(this.context, element, "click");
    }

    Utils.fireMouseEventOn(this.context, element, "mouseup");
	var browser = Utils.getBrowser(this.context);

    var checkForLoad = function() {
        // Returning should be handled by the click listener, unless we're not actually loading something. Do a check and return if we are.
        // There's a race condition here, in that the click event and load may have finished before we get here. For now, let's pretend that
        // doesn't happen. The other race condition is that we make this check before the load has begun. With all the javascript out there,
        // this might actually be a bit of a problem.
        var docLoaderService = Utils.getBrowser(driver.context).webProgress
        if (!docLoaderService.isLoadingDocument) {
            WebLoadingListener.removeListener(browser, clickListener);
			if (!alreadyReplied) {
				alreadyReplied = true;
            	server.respond(driver.context, "click");
			}
        }
    }

    Utils.getBrowser(this.context).contentWindow.setTimeout(checkForLoad, 50);
};

FirefoxDriver.prototype.getElementText = function(elementId) {
    var element = Utils.getElementAt(elementId, this.context);
	 if (element.tagName == "TITLE") {
		this.server.respond(this.context, "getElementText", Utils.getBrowser(this.context).contentTitle);
	} else {
    	this.server.respond(this.context, "getElementText", Utils.getText(element, true));
	}
}

FirefoxDriver.prototype.getElementValue = function(value) {
    var element = Utils.getElementAt(value, this.context);
    if (element.tagName.toLowerCase() == "textarea") {
        this.server.respond(this.context, "getElementValue", "OK\n" + element.value);
		return 
	}

	if (element["value"]) {
		this.server.respond(this.context, "getElementValue", "OK\n" + element.value);
		return;
	}

	if (element.hasAttribute("value")) {
		this.server.respond(this.context, "getElementValue", "OK\n" + element.getAttribute("value"));
		return;
	}
		
	this.server.respond(this.context, "getElementValue", "No match\n");
}

FirefoxDriver.prototype.setElementValue = function(value) {
    var spaceIndex = value.indexOf(" ");
    var element = Utils.getElementAt(value.substring(0, spaceIndex), this.context);
    spaceIndex = value.indexOf(" ", spaceIndex);
    var newValue = value.substring(spaceIndex + 1);

    Utils.type(this.context, element, newValue);

    this.server.respond(this.context, "setElementValue");
}

FirefoxDriver.prototype.getElementAttribute = function(value) {
    var spaceIndex = value.indexOf(" ");
    var element = Utils.getElementAt(value.substring(0, spaceIndex), this.context);
    spaceIndex = value.indexOf(" ", spaceIndex);
    var attributeName = value.substring(spaceIndex + 1);

    if (element.hasAttribute(attributeName)) {
        var response = element.getAttribute(attributeName);

        if (attributeName.toLowerCase() == "disabled") {
            response = element.disabled;
        } else if (attributeName.toLowerCase() == "selected") {
            response = element.selected;
        } else if (attributeName.toLowerCase() == "checked") {
            response = response.toLowerCase() == "checked" || response.toLowerCase() == "true";
        }

        this.server.respond(this.context, "getElementAttribute", "OK\n" + response);
        return;
    }

    attributeName = attributeName.toLowerCase();
    if (attributeName == "disabled") {
        this.server.respond(this.context, "getElementAttribute", "OK\n" + element.disabled);
        return;
    } else if (attributeName == "checked" && element.tagName.toLowerCase() == "input") {
        this.server.respond(this.context, "getElementAttribute", "OK\n" + element.checked);
        return;
    } else if (attributeName == "selected" && element.tagName.toLowerCase() == "option") {
        this.server.respond(this.context, "getElementAttribute", "OK\n" + element.selected);
        return;
    }

    this.server.respond(this.context, "getElementAttribute", "No match");
}

FirefoxDriver.prototype.submitElement = function(elementId) {
    var element = Utils.getElementAt(elementId, this.context);

    var submitElement = Utils.findForm(element);
    if (submitElement) {
        var server = this.server;
        var driver = this;
        new WebLoadingListener(this, function(event) {
            server.respond(driver.context, "submitElement");
        });
        if (submitElement["submit"])
            submitElement.submit();
        else
            submitElement.click();
    } else {
        server.respond(this.context, "submitElement");
    }
}

FirefoxDriver.prototype.getElementChildren = function(elementIdAndTagName) {
    var parts = elementIdAndTagName.split(" ");
    var element = Utils.getElementAt(parts[0], this.context);

    var children = element.getElementsByTagName(parts[1]);
    var response = "";
    for (var i = 0; i < children.length; i++) {
        response += Utils.addToKnownElements(children[i], this.context) + " ";
    }
    this.server.respond(this.context, "getElementChildren", response);
}

FirefoxDriver.prototype.getElementSelected = function(elementId) {
    var element = Utils.getElementAt(elementId, this.context);
    var selected = false;

    try {
        var option = element.QueryInterface(Components.interfaces.nsIDOMHTMLOptionElement)
        selected = option.selected;
    } catch(e) {}

    try {
        var inputElement = element.QueryInterface(Components.interfaces.nsIDOMHTMLInputElement)
        if (inputElement.type == "checkbox" || inputElement.type == "radio") {
            selected = inputElement.checked;
        }
    } catch(e) {}

    this.server.respond(this.context, "getElementSelected", selected);
}

FirefoxDriver.prototype.setElementSelected = function(elementId) {
    var element = Utils.getElementAt(elementId, this.context);
    var wasSet = "You may not select an unselectable element";

	try {
		var inputElement = element.QueryInterface(Components.interfaces.nsIDOMHTMLInputElement)
		if (inputElement.disabled) {
			this.server.respond(this.context, "setElementSelected", "You may not select a disabled element");
			return;
		}
	} catch(e) {
	}

    try {
        var option = element.QueryInterface(Components.interfaces.nsIDOMHTMLOptionElement)
		if (!option.selected) {
            option.selected = true;
            Utils.fireHtmlEvent(this.context, option, "change");
        }
        wasSet = "";
    } catch(e) {}

    try {
        var checkbox = element.QueryInterface(Components.interfaces.nsIDOMHTMLInputElement)
        if (checkbox.type == "checkbox" || checkbox.type == "radio") {
			if (!checkbox.checked) {
	            checkbox.checked = true;
				Utils.fireHtmlEvent(this.context, checkbox, "change");
			}
            wasSet = "";
		}
    } catch(e) {}

    this.server.respond(this.context, "setElementSelected", wasSet);
}

FirefoxDriver.prototype.toggleElement = function(elementId) {
	var element = Utils.getElementAt(elementId, this.context);
	
	try {
		var checkbox = element.QueryInterface(Components.interfaces.nsIDOMHTMLInputElement);
		if (checkbox.type == "checkbox") {
			checkbox.checked = !checkbox.checked;
			Utils.fireHtmlEvent(this.context, checkbox, "change");
			this.server.respond(this.context, "toggleElement");
			return;
		}
	} catch(e) {}
	
	try {
		var option = element.QueryInterface(Components.interfaces.nsIDOMHTMLOptionElement);
		
		// Find our containing select and see if it allows multiple selections
		var select = option.parentNode;
		while (select && select.tagName != "SELECT") {
			select = select.parentNode;
		}
		
		if (select && select.multiple) {
			option.selected = !option.selected;
			Utils.fireHtmlEvent(this.context, option, "change");
			this.server.respond(this.context, "toggleElement");
			return;
		}
	} catch(e) {}
	
	this.server.respond(this.context, "toggleElement", "You may only toggle an element that is either a checkbox or an option in a select that allows multiple selections");
};