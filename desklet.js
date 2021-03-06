const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Cinnamon = imports.gi.Cinnamon;
const Desklet = imports.ui.desklet;
const St = imports.gi.St;
const DeskletManager = imports.ui.deskletManager;
const Lang = imports.lang;
const Tooltips = imports.ui.tooltips;
const Settings = imports.ui.settings;
const GtkPolicies = imports.gi.Gtk.PolicyType;

// Task statuses
const INCOMPLETE = 'i';
const COMPLETE = 'c';

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
    removeFromlist: function(array, index) {
        array.splice(index, 1);
        return array;
    }, // write JSON to disk
    writeJSON: function(path, rawData) {
        this.logAction("Writing JSON");
        json = JSON.stringify(rawData);
        return GLib.file_set_contents(path, json);
    }, // gather data and call writeJSON
    writeList: function() {
        this.logAction("Writing List");
        this.writeJSON(this.listPath, this.listData)
    }, // read JSON from disk
    readJSON: function(path) {
        this.logAction("Reading JSON");
        let json;
        // TODO: We should be testing the directory as well as the file
        if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
            let [ok,content] = GLib.file_get_contents(path);
            json = JSON.parse(content);
        } else {
            json = [];
            this.writeJSON(path, json);
        }
        return json;
    }, // call readJSON and store the read data
    readList: function() {
        this.logAction("Reading List");
        this.listData = this.readJSON(this.listPath);
    }, // main update loop, builds the task list
    /* This could be converted to store references to the task containers 
     *  and allow them to be deleted/hidden by the complete/delete functions
     *  rather than rebuilding the task list on every update.  Updates are 
     *  rare enough not to worry about it though.
     */
    updateList: function() {
        let BLUE = Clutter.Color.get_static(Clutter.StaticColor.BLUE);
        let GREEN = Clutter.Color.get_static(Clutter.StaticColor.GREEN);
        let WHITE = Clutter.Color.get_static(Clutter.StaticColor.WHITE);
        let GRAY = Clutter.Color.get_static(Clutter.StaticColor.GRAY);
        let BLACK = Clutter.Color.get_static(Clutter.StaticColor.BLACK);
        let RED = Clutter.Color.get_static(Clutter.StaticColor.RED);
        this.logAction("List updated");
        this.listContainer.remove_all_children();
        this.listData.forEach( function( item, index ) {
            if (item.status!=INCOMPLETE) return true; // Skip completed tasks
            // Set up the task container
            let taskContainer = new St.BoxLayout({style: "margin-bottom:5px;margin-top:5px;padding-bottom:2px;font-size:12px;align-content:center;text-align-last: right",vertical: false});
            taskContainer.set_id(String(index)); // Store the task id somewhere we can get it later (for complete/delete events)
            // Main task text field
            let label = new St.Label({style: "text-align: left, padding-right: 5px;color: light-green", width: 270});
            label.set_text(item.text);
            // Task buttons, complete & delete
            let completeTaskIcon = new St.Icon({ background_color: GREEN, style: "color: GRAY, background-color: GREEN", icon_size: 12, icon_name: 'emblem-default',
              icon_type: St.IconType.SYMBOLIC
            });
            let completeTaskbutton = new St.Button({style: "text-align:center;"});
            let deleteTaskIcon = new St.Icon({ style: "color: RED;", icon_size: 12, icon_name: 'process-stop',
              icon_type: St.IconType.SYMBOLIC
            });
            let deleteTaskbutton = new St.Button({style: "text-align:center;padding-left: 2px;"});
            let buttonContainer = new St.BoxLayout({style: "", vertical: false});
            buttonContainer.add_actor(completeTaskbutton);
            buttonContainer.add_actor(deleteTaskbutton);
            // set up events
            completeTaskbutton.set_child(completeTaskIcon);
            completeTaskbutton.connect('clicked', Lang.bind(this, this.handleCompleteTask));
            deleteTaskbutton.set_child(deleteTaskIcon);
            deleteTaskbutton.connect('clicked', Lang.bind(this, this.handleDeleteTask));
            // place everything in order
            taskContainer.add_actor(label);
            taskContainer.add_actor(buttonContainer);
            this.listContainer.add_actor(taskContainer);
        }, this);
    },
    handleDeleteTask: function(button, clicked_button) {
        let target = button.get_parent().get_parent().get_id();
        if (target===null) {
            this.logAction("Delete clicked but no target found (null).");   
            return false;
        }
        this.logAction("Delete clicked: "+target);
        this.listData = this.removeFromlist(this.listData, target);
        this.writeList();
        this.updateList();
    },
    handleCompleteTask: function(button, clicked_button) {
        let target = button.get_parent().get_parent().get_id();
        if (target===null) {
            this.logAction("Complete clicked but no target found (null).");   
            return false;
        }
        this.logAction("Complete clicked: "+target);
        this.listData[target].status = COMPLETE
        this.writeList();
        this.updateList();
    },
    handleAddTask: function() {
        this.logAction("Add clicked");
        let inputText = this.newEntryField.get_text();
        if (inputText === "" ) return;
        this.listData.push({text: inputText, status: INCOMPLETE});
        this.newEntryField.set_text("");
        this.writeList();
        this.updateList();
    }, // Debug log, not used much but handy occasionally
    logAction: function(logString) {
        this.debugLog = this.debugLog + "\n" + logString;
        if (this.debugLabel) this.debugLabel.set_text(this.debugLog); // Don't attempt to display the log before the log display UI has been built
    }, // Capture the keyboard input focus when cursor enters the text field
    handleInputFocus: function() {
        if ( global.stage_input_mode == Cinnamon.StageInputMode.FULLSCREEN ) return;
        global.set_stage_input_mode(Cinnamon.StageInputMode.FOCUSED);
        this.input.grab_key_focus();
        global.set_stage_input_mode(Cinnamon.StageInputMode.NORMAL);
    }, // add the task when ENTER key pressed
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
        let mainContainer= new St.BoxLayout({style: "padding: 5px;spacing: 5px;", vertical: true, x_align: 2});
        this.listContainer= new St.BoxLayout({vertical: true, x_align: 2});
        let deskletLabel = new St.Label({style: "text-align: center;font-weight: bold;"});
        deskletLabel.set_text("TO DO");

        // Container for task list
        let listScroll = new St.ScrollView({style: "spacing: initial;padding: 5px;border-width: 1px;border-style: solid;border-radius: 5px;border-color: black;"});
        listScroll.set_policy(GtkPolicies.NEVER, GtkPolicies.ALWAYS);
        listScroll.set_height(200);
        this.listContainer.set_width(300);
        listScroll.add_actor(this.listContainer);

        // New task fields
        let newEntryLabel = new St.Label({style: "font-size: 14px;"});
        newEntryLabel.set_text("New Task: ");
        this.newEntryField = new St.Entry({width: 50, reactive: true, track_hover: false, can_focus: true, style: "font-size: 12px;background-color: #ffffff; color: #000000;"});
        let newEntryContainer = new St.BoxLayout({style: "spacing: 5px; padding: 5px;border-width: 1px;border-style: solid;border-radius: 5px;border-color: black;", vertical: false});
        // add task button
        let addTaskIconButton=new St.Icon({ background_color: GRAY, icon_size: 16, icon_name: 'list-add-symbolic',
          icon_type: St.IconType.SYMBOLIC
        });
        let addTaskbutton = new St.Button({style: ""}); // container for add icon
        addTaskbutton.set_child(addTaskIconButton);
        addTaskbutton.connect('clicked', Lang.bind(this, this.handleAddTask));
        this.newTaskTooltip = new Tooltips.Tooltip(addTaskbutton, 'New list item');
        newEntryContainer.add_actor(newEntryLabel);
        newEntryContainer.add(this.newEntryField, { expand: true });
        newEntryContainer.add_actor(addTaskbutton);
        
        // Debug log
        this.debugLabel = new St.Label();
        this.debugLabel.set_text(this.debugLog);
        let debugContainer = new St.BoxLayout({vertical: true, style: "spacing: 5px; padding: 5px;"});
        debugContainer.add_actor(this.debugLabel);
        let debugScroll = new St.ScrollView({style: "spacing: initial;padding: 5px;border-width: 1px;border-style: solid;border-radius: 5px;border-color: black;"});
        debugScroll.set_policy(GtkPolicies.NEVER, GtkPolicies.ALWAYS);
        debugScroll.set_height(200);
        debugScroll.add_actor(debugContainer);
       
        // Tie all the containers together
        mainContainer.add_actor(deskletLabel);
        mainContainer.add_actor(listScroll);
        mainContainer.add_actor(newEntryContainer);        
        if (this.enableDebug) mainContainer.add_actor(debugScroll);
        this.window.add_child(mainContainer);
        this.newEntryField.clutter_text.connect("button_press_event", Lang.bind(this, this.handleInputFocus));
        this.newEntryField.clutter_text.connect("key_press_event", Lang.bind(this, this.handleInputKeyPress));
        this.setContent(this.window);
        this.logAction("UI built");
    }
}

function main(metadata, desklet_id) {
    return new ToDoDesklet(metadata, desklet_id);
}