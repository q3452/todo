const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Cinnamon = imports.gi.Cinnamon;
const Desklet = imports.ui.desklet;
const St = imports.gi.St;
const DeskletManager = imports.ui.deskletManager;
const Lang = imports.lang;
const Tooltips = imports.ui.tooltips;
const Settings = imports.ui.settings;

function ToDoDesklet(metadata, desklet_id) {
    this._init(metadata, desklet_id);
}

ToDoDesklet.prototype = {
    __proto__: Desklet.Desklet.prototype,
    listData: [],
    enableDebug: false,
    listPath: '',
    newEntryStr: '',
    debugLog: 'Debug Log\n=======\n',
    _init: function(metadata, desklet_id) {
        Desklet.Desklet.prototype._init.call(this, metadata, desklet_id);
        this.settings = new Settings.DeskletSettings(this, metadata['uuid'], desklet_id);
        const DESKLET_DIR = DeskletManager.deskletMeta[metadata['uuid']].path;
        this.listPath = DESKLET_DIR + '/data/listData.json';
        this.readList();
        this.setupUI();
        this.updateList();
        return true;
    },
    entryChanged: function () {
        this.newEntryStr = this.newEntryField.text;
    },
    removeFromlist: function(array, index) {
        array.splice(index, 1);
        return array;
    },
    writeJSON: function(path, rawData) {
        this.logAction("Writing JSON");
        json = JSON.stringify(rawData);
        return GLib.file_set_contents(path, json);
    },
    writeList: function() {
        this.logAction("Writing List");
        this.writeJSON(this.listPath, this.listData)
    },
    readJSON: function(path) {
        this.logAction("Reading JSON");
        let json;
        if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
            let [ok,content] = GLib.file_get_contents(path);
            json = JSON.parse(content);
        } else {
            json = [];
            this.writeJSON(path, json);
        }
        return json;
    },
    // Get the todo list from disk
    readList: function() {
        this.logAction("Reading List");
        this.listData = this.readJSON(this.listPath);
    },
    updateList: function() {
        let BLUE = Clutter.Color.get_static(Clutter.StaticColor.BLUE);
        let GREEN = Clutter.Color.get_static(Clutter.StaticColor.GREEN);
        let WHITE = Clutter.Color.get_static(Clutter.StaticColor.WHITE);
        let GRAY = Clutter.Color.get_static(Clutter.StaticColor.GRAY);
        let BLACK = Clutter.Color.get_static(Clutter.StaticColor.BLACK);
        this.logAction("List updated");
        this.listContainer.remove_all_children();
        this.listData.forEach( function( item, index ) {
            let taskContainer = new St.BoxLayout({style: "margin-bottom:5px;margin-top:5px;padding-bottom:2px;font-size:12px;align-content:center;text-align-last: right",vertical: false});
            taskContainer.set_id(String(index));
            let label = new St.Label({style: "text-align: left, padding-right: 5px;color: light-green", width: 276});
            label.set_text(item.text);

            let completeTaskIcon = new St.Icon({ background_color: GREEN, style: "text-align:center;color: GRAY, background-color: GREEN", icon_size: 12, icon_name: 'emblem-default',
              icon_type: St.IconType.SYMBOLIC
            });
            let completeTaskbutton = new St.Button({style: ""});
            let buttonContainer = new St.BoxLayout({background_color: BLACK, style: "", vertical: false});
            buttonContainer.add_actor(completeTaskbutton);
            
            completeTaskbutton.set_child(completeTaskIcon);
            completeTaskbutton.connect('clicked', Lang.bind(this, this.handleCompleteTask));
            
            taskContainer.add_actor(label);
            taskContainer.add_actor(buttonContainer);
            this.listContainer.add_actor(taskContainer);
        }, this);
    },
    handleCompleteTask: function(button, clicked_button) {
        let target = button.get_parent().get_parent().get_id();
        if (target===null) {
            this.logAction("Complete clicked but not target found (null).");   
            return false;
        }
        this.logAction("Complete clicked: "+target);
        this.listData = this.removeFromlist(this.listData, target);
        this.writeList();
        this.updateList();
    },
    handleAddTask: function() {
        this.logAction("Add clicked");
        let inputText = this.newEntryField.get_text();
        if (inputText === "" ) return;
        this.listData.push({text: inputText});
        this.newEntryField.set_text("");
        this.writeList();
        this.updateList();
    },
    handleRemoveTask: function(actor, event) {
        this.logAction("Remove clicked");
        if (this.listData.length>0) this.listData = this.removeFromlist(this.listData,0);
        this.writeList();
        this.updateList();
    },
    logAction: function(logString) {
        this.debugLog = this.debugLog + "\n" + logString;
        if (this.debugLabel) this.debugLabel.set_text(this.debugLog); // Don't attempt to display the log before the log display UI has been built
    },
    handleInputFocus: function() {
        if ( global.stage_input_mode == Cinnamon.StageInputMode.FULLSCREEN ) return;
        global.set_stage_input_mode(Cinnamon.StageInputMode.FOCUSED);
        this.input.grab_key_focus();
        global.set_stage_input_mode(Cinnamon.StageInputMode.NORMAL);
    },
    handleInputKeyPress: function(actor, event) {
        let symbol = event.get_key_symbol();
        if ( symbol == Clutter.Return || symbol == Clutter.KP_Enter ) {
            this.handleAddTask();
            return true;
        }        
        return false;
    },
    setupUI: function(listData) {
        let GRAY = Clutter.Color.get_static(Clutter.StaticColor.GRAY);
        let GREEN = Clutter.Color.get_static(Clutter.StaticColor.GREEN);
        let WHITE = Clutter.Color.get_static(Clutter.StaticColor.WHITE);
        // main container for the desklet
        this.window=new St.BoxLayout({style: "padding: 5px", vertical: true});
        this.container= new St.BoxLayout({style: "padding: 5px;spacing: 5px;", vertical: true, x_align: 2});
        this.listContainer= new St.BoxLayout({style: "spacing: initial;padding: 5px;border-width: 1px;border-style: solid;border-radius: 5px;border-color: black;", vertical: true, x_align: 2});
        this.listContainer.set_height(200);
        this.listContainer.set_width(300);
        this.deskletLabel = new St.Label({style: "text-align: center;font-weight: bold;"});
        this.deskletLabel.set_text("TO DO");

        // New task fields
        this.newEntryLabel = new St.Label({style: "font-size: 16px;"});
        this.newEntryLabel.set_text("New Task: ");

        this.newEntryField = new St.Entry({width: 50, reactive: true, track_hover: false, can_focus: true, style: "font-size: 12px;background-color: #ffffff; color: #000000;"});

        this.newEntryContainer = new St.BoxLayout({style: "spacing: 5px; padding: 5px;border-width: 1px;border-style: solid;border-radius: 5px;border-color: black;", vertical: false});
        // add task button
        this.addTaskIconButton=new St.Icon({ background_color: GRAY, icon_size: 16, icon_name: 'list-add-symbolic',
          icon_type: St.IconType.SYMBOLIC
        });
        this.addTaskbutton=new St.Button({style: ""}); // container for add icon
        this.addTaskbutton.set_label('New');
        this.addTaskbutton.set_child(this.addTaskIconButton);
        this.addTaskbutton.connect('clicked', Lang.bind(this, this.handleAddTask));
        this.refreshTooltip = new Tooltips.Tooltip(this.addTaskbutton, 'New list item');
        this.newEntryContainer.add_actor(this.newEntryLabel);
        this.newEntryContainer.add(this.newEntryField, { expand: true });
        this.newEntryContainer.add_actor(this.addTaskbutton);
        
        // Debug field (needs debugging)
        this.debugContainer = new St.BoxLayout({vertical: true, style: "spacing: 5px; padding: 5px;"});
        this.debugScroll = new St.ScrollView();
        this.debugLabel = new St.Label();
        this.debugLabel.set_text(this.debugLog);
        this.debugContainer.add_actor(this.debugLabel);
        this.debugScroll.add_actor(this.debugContainer);
       
        this.container.add_actor(this.deskletLabel);
        this.container.add_actor(this.listContainer);
        this.container.add_actor(this.newEntryContainer);        
        if (this.enableDebug) this.container.add_actor(this.debugScroll);
        this.window.add_child(this.container);
        this.newEntryField.clutter_text.connect("button_press_event", Lang.bind(this, this.handleInputFocus));
        this.newEntryField.clutter_text.connect("key_press_event", Lang.bind(this, this.handleInputKeyPress));
        this.setContent(this.window);
        this.logAction("UI built");
    }
}

function main(metadata, desklet_id) {
    return new ToDoDesklet(metadata, desklet_id);
}