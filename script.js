let driverList = [];
let vehicleList = [];
let driverColumns = [];
let vehicleColumns = [];
let timesColumns = [];
let timesArray = [];
let COMPortsArray = [];
let serialPort;
let conePenalty;
let driversTable;
let vehiclesTable;
let timesTable;
let maxNumberOfRuns;
let modalResponse;
const TIMESTAMP_FORMAT = "h:mm:ss A";
const modalFade = 250;

///////////////////////////////////////////////////////////////////
// DOM READY 
///////////////////////////////////////////////////////////////////
$(document).ready(function() {
    checkForTimingDevice();
    // populateCOMPortDropdown(); // not necessary due to auto-selection of timing device COM port
    createSampleDriverList(); // sample driver list
    createSampleVehicleList(); // sample vehicle list

    defineTimesColumns();
    defineDriverColumns();
    defineVehicleColumns();
    defineInteractions();

    createInitialTimesArray();
    createSampleTimesArray(); // sample times array

    initializeTimesTable();
    initializeDriverListTable();
    initializeVehicleListTable();

    setTabulatorModifiers();

    launchTestInterface()

    // loadStoredPracticeData(true);
    updateAllData(true);
    
});


///////////////////////////////////////////////////////////////////
// INITIALIZATION 
///////////////////////////////////////////////////////////////////
function launchTestInterface() {
    chrome.app.window.create("test.html", {alwaysOnTop: true, id: "testWindow", innerBounds: {height: 512}}, (createdWindow) => {
        timesArray = timesTable.getData();
        createdWindow.timesArray = timesArray;
        createdWindow.averageTime = chrome.app.window.current().averageTime;
    })

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        addLapTime(request.timeReceived, moment(request.timestampISO));
    })
}

function defineInteractions() {
    // SETUP PANE
        // DOM
        ///////////////////////////////////////////////////////////////////
        $("#setup-pane-button").click(function(event) {
            toggleSetupPane(600, 20);
        });

        $(".setup-pane-header").click(function(event) {
            if (event.target.type !== "button" && event.target.type !== "file" && event.target.type !== "input" && event.target.parentElement.tagName !== "LABEL" && !event.target.parentElement.classList.contains("checkbox")) $(this).next(".setup-pane-content").slideToggle(200, function() {
                if (this.style.display !== "none") {
                    switch (this.id) {
                        case "drivers-content": 
                            updateDriverListTable(true);
                            break;

                        case "vehicles-content":
                            updateVehicleListTable(true);
                            break;
                    }
                }

            });        
        });

        $("#show-all-vehicles").change(function() {
            toggleVehicleDisplay();
        })

        $("#hide-completed-drivers").change(function() {
            toggleDisplayCompletedDrivers();
        })


        // Practice date
        ///////////////////////////////////////////////////////////////////
        document.getElementById("practice-date").valueAsDate = new Date();
        $("#practice-date").change(function() {
            loadStoredPracticeData();
        });

        
        // Timing device
        ///////////////////////////////////////////////////////////////////
        $(".timing-device-status-icon").click(function() {
            if (!$(this).hasClass("disabled")) {
                checkForTimingDevice();
            }
        });


        // Number of runs
        ///////////////////////////////////////////////////////////////////
        maxNumberOfRuns = parseInt($("#number-of-runs").val());
        $("#number-of-runs").change(function() {
            maxNumberOfRuns = parseInt($(this).val());
            updateAllData();
        });

        
        // Cone penalty
        ///////////////////////////////////////////////////////////////////
        conePenalty = $("#cone-penalty")[0].valueAsNumber;
        $("#cone-penalty").change(function() {
            conePenalty = this.valueAsNumber;
            updateAllData();
        })
        
    
    // TIMES PANE
        // DOM
        ///////////////////////////////////////////////////////////////////
        $(".times-pane").css("margin-top", $(".app-header").outerHeight());

        // $(".setup-pane").resizable({
        //     handles: "e",
        //     minWidth: 500,
        //     resizeHeight: false,
        // })

        $(".times-button").hover(
            // adjust position of tooltip to not overflow past window view

            function(eventIn) {
                let windowWidth = $(window).width();
                let tooltipPosition = $(this).find(".button-tooltip").offset();
                let tooltipWidth = $(this).find(".button-tooltip").width();
                let tooltipOffset = windowWidth - (tooltipPosition.left + tooltipWidth);

                if (tooltipOffset < 10) {
                    let tooltipOffsetNew = Math.round(10 - tooltipOffset);

                    $(this).find(".button-tooltip").css("margin-left",  -tooltipWidth / 2 - tooltipOffsetNew + "px");
                    $(this).find(".button-tooltip .triangle").css("left", (50 + tooltipOffsetNew / tooltipWidth * 100) + "%");
                }

                $(this).find(".button-tooltip").css({
                    "visibility": "visible",
                    "opacity": 1,
                });
            }, 
            function(eventOut) {
                let tooltipWidth = $(this).find(".button-tooltip").width();

                $(this).find(".button-tooltip").css({
                    "visibility": "hidden",
                    "opacity": 0,
                    "margin-left": -tooltipWidth / 2 + "px",
                });

                $(this).find(".button-tooltip .triangle").css("left", "50%");
            }
        );

        
        // Times table
        ///////////////////////////////////////////////////////////////////
        $(document).keyup(function(event) {
            if (event.ctrlKey && event.key == "n") {
                addLapTime();
            }
        });

        
        // Buttons
        ///////////////////////////////////////////////////////////////////
        $(".add-laptime").click(function() {
            addLapTime();
        })

        $("#import-data-button").click(function() {
            $("#import-data-input").trigger("click");
        });

        $("#import-data-input").change(event => importDataFromSpreadsheet(event, true));

        $("#download-excel-data").click(function() {
            let practiceDateFormatted = moment($("#practice-date").val()).format("YYYY-MM-DD");
            openModalDisplay("download", "Download All Data from " + practiceDateFormatted).then(function(modalResponse) {
                if (modalResponse.confirmed) {
                    downloadExcelData();
                }
            })
            
        });

        $("#delete-all-times").click(function() {
            let practiceDateFormatted = moment($("#practice-date").val()).format("YYYY-MM-DD");
            openModalDisplay("deleteAllTimes", "Delete All Times from " + practiceDateFormatted).then(function(modalResponse) {
                if (modalResponse.confirmed) {
                    timesTable.clearData();
                    createInitialTimesArray();
                    timesTable.setData(timesArray);
                    updateAllData();
                }
            })
        })
}

function defineTimesColumns() {
    timesColumns = [
        {field: "deleteRun", align: "center", headerSort: false, resizable: false,
            formatter: function(cell) {
                return "<div class='delete-laptime' id='delete-" + cell.getData().id + "'><i class='fas fa-minus-circle'></i></div>";
            },
            cellMouseOver: function(event, cell) {
                if (cell.getTable().rowManager.rows.length > 1) $(cell.getElement()).find("[id^=delete]").show();
            },
            cellMouseLeave: function(event, cell) {
                if ($("#modal-display").hasClass("ui-dialog-content")) {
                    if (!$("#modal-display").dialog("isOpen")) {
                        $(cell.getElement()).find("[id^=delete]").hide();
                    }
                }
                else {
                    $(cell.getElement()).find("[id^=delete]").hide();
                }
                
            },
            cellClick: function(event, cell) { 
                if (cell.getTable().rowManager.rows.length <= 1) return false;

                let data = cell.getData();
                if ((data.name) || (data.vehicle) || (data.cones) || (data.timestamp)) {
                    openModalDisplay("deleteRun", "Delete Run " + cell.getData().id, cell).then(function(modalResponse) {
                        if (modalResponse.confirmed) {
                            timesTable.deleteRow(modalResponse.cell.getRow());
                        }
                        $(cell.getElement()).find("[id^=delete]").hide()
                    })
                }
                else {
                    timesTable.deleteRow(cell.getRow());
                }
            }
        },
        {title: "ID", field: "id", align: "center", rowHandle: true},
        {title: "Name", field: "name", headerFilter: "input", headerFilterPlaceholder: "filter names", editor: "autocomplete", editorParams: {
            values: driverList.map(x => x.name),
            showListOnEmpty: true,
            freetext: false,    
            allowEmpty: true,
        }, 
            cellEdited: function(cell) {
                updateAllData();

                if (!isEmptyOrUndefined(cell.getData()) && isEmptyOrUndefined(cell.getData().vehicle)) {
                    cell.nav().right();
                }
            },
            formatter: function(cell) {
                if (cell.getValue()) {
                    cell.getElement().classList.remove("placeholder-text");
                    return cell.getValue();
                }
                else {
                    cell.getElement().classList.add("placeholder-text");
                    return "Enter a name";
                }
            },
        },
        {title: "Vehicle", field: "vehicle", headerFilter: "input", headerFilterPlaceholder: "filter vehicles", editor: "autocomplete", editorParams: {
            values: vehicleList.filter(x => x.inUse == true).map(x => x.name),
            showListOnEmpty: true,
            freetext: false,
            allowEmpty: true,
        }, 
            cellEdited: function(cell) {
                if (!isEmptyOrUndefined(cell.getData().name) && !isEmptyOrUndefined(cell.getValue())) {
                    addLapTime();
                }
            },
            formatter: function(cell) {
                if (cell.getValue()) {
                    cell.getElement().classList.remove("placeholder-text");
                    return cell.getValue();
                }
                else {
                    cell.getElement().classList.add("placeholder-text");
                    return "Enter a vehicle";
                }
            },
        },
        {title: "Cones", field: "cones", editor: "input", align: "center", validator: "integer", 
            cellEdited: function(cell) {
                (cell.getValue() == 0) ? cell.setValue("") : cell.setValue(Number(cell.getValue()));
                updateAllData();
            },
        },
        {title: "Run", field: "run", align: "center", 
            formatter: function(cell, formatterParams) {
                cell.getElement().classList.add("calculated-column");
                // cell.getValue() == maxNumberOfRuns ? cell.getElement().classList.add("last-run") : cell.getElement().classList.add("calculated-column");

                return cell.getValue();
            }
        },
        {title: "Time (raw)", field: "timeRaw", 
            formatter: function(cell, formatterParams) {
                cell.getElement().classList.add("calculated-column");

                return cell.getValue() ? cell.getValue().toFixed(3) : cell.getValue();
            }
        },
        {title: "Time (adj)", field: "timeAdj", sorter: "alphanum", 
            formatter: function(cell, formatterParams) {
                cell.getElement().classList.add("calculated-column");

                return typeof cell.getValue() == "number" ? cell.getValue().toFixed(3) : cell.getValue();
            }
        },
        {title: "Timestamp", field: "timestamp", sorter: "time", sorterParams: {
            format: "hh:mm:ss a"
            },
            formatter: function(cell, formatterParams) {
                cell.getElement().classList.add("calculated-column");

                return (cell.getValue()) ? cell.getValue().format("h:mm:ss A") : cell.getValue();
            }
        },
        {title: "DNF", field: "dnf", align: "center", headerSort: false, formatter: "tickCross", formatterParams: {
            tickElement: "<i class='fas fa-check-square'></i>",
            crossElement: "<i class='fas fa-square'></i>",
        }, 
            cellClick: function(event, cell) {
                cell.setValue(!cell.getValue());
                processTimesModifiers();
            }
        },
        {title: "INS", field: "ins", align: "center", headerSort: false, formatter: "tickCross", formatterParams: {
            tickElement: "<i class='fas fa-check-square'></i>",
            crossElement: "<i class='fas fa-square'></i>",        
        }, 
            cellClick: function(event, cell) {
                cell.setValue(!cell.getValue());
                processTimesModifiers();
                // timesTable.updateData(timesArray);
            }
        },
        {title: "N/A", field: "na", align: "center", headerSort: false, formatter: "tickCross", formatterParams: {
            tickElement: "<i class='fas fa-check-square'></i>",
            crossElement: "<i class='fas fa-square'></i>",        
        }, 
            cellClick: function(event, cell) {
                cell.setValue(!cell.getValue());
                processTimesModifiers();
                // timesTable.updateData(timesArray);
            }
        },
        {title: "Ignore Run Count", field: "ignoreRunCount", visible: false},
        {title: "Ignore Time (Raw)", field: "ignoreTimeRaw", visible: false},
        {title: "Ignore Time (Adj)", field: "ignoreTimeAdj", visible: false},
    ];
}

function defineDriverColumns() {
    driverColumns = [
        {title: "Heat", field: "heat", downloadTitle: "heat", sorter: "number", align: "center", headerSort: true},
        {title: "Name", field: "name", downloadTitle: "name", headerSort: true},
        {title: "Runs", field: "runs", downloadTitle: "runs", align: "center", headerSort: false,
            formatter: function(cell) {
                return cell.getValue() == 0 ? "" : cell.getValue(); 
            }
        },   
        {title: "FTD", field: "ftd", downloadTitle: "heat", sorter: "number",
            formatter: function(cell) {
                return (cell.getValue() == "") ? "" : Number(cell.getValue()).toFixed(3);
            }
        },
        {title: "Vehicle", field: "vehicle", downloadTitle: "vehicle"},
    ];
}

function defineVehicleColumns() {
    vehicleColumns = [
        {title: "In Use", field: "inUse", downloadTitle: "inUse", headerSort: false, formatter: "tickCross", visible: false,
            formatterParams: {
                tickElement: "<i class='fas fa-check-square'></i>",
                crossElement: "<i class='fas fa-square'></i>",        
            }, 
            titleFormatter: function(cell) {
                return "";
            },
            cellClick: function(event, cell) {
                cell.setValue(!cell.getValue());
                timesTable.options.columns.filter(x => x.field == "vehicle").map(x => x.editorParams.values = vehicleList.filter(x => x.inUse == true).map(x => x.name));
            },
        },
        {title: "Name", field: "name", downloadTitle: "name", headerSort: false},
        {title: "Index", field: "index", downloadTitle: "index", headerSort: false, align: "center",
            formatter: function(cell) {
                return cell.getValue().toFixed(3);
            }
        },
        {title: "Runs", field: "runs", downloadTitle: "runs", headerSort: false, resizable: true, align: "center",},
        {title: "FTD", field: "ftd", downloadTitle: "ftd", headerSort: false, resizable: true,
            formatter: function(cell) {
                return (cell.getValue() == "") ? "" : Number(cell.getValue()).toFixed(3);
            },
        },
        {title: "Driver", field: "driver", downloadTitle: "driver", headerSort: false, resizable: true},
    ];
}

function initializeTimesTable() {
    timesTable = new Tabulator("#times-table", {
        ajaxLoader: true,
        height: window.innerHeight - $(".app-header").outerHeight() - $(".times-header").outerHeight() - 60,
        columnMinWidth: 30,
        columns: timesColumns,
        data: timesArray,
        history: true,
        layout:"fitDataFill",
        index: "id",
        initialSort: [
            {column: "id", dir: "desc"}
        ],
        keybindings: {
            // "addLapTime": "ctrl + 78",
        },  
        // movableRows: true,
        // movableRowsSender: "preventMovingCompletedRun",
        rowFormatter: function(row) {
            let data = row.getData();
            data.run == maxNumberOfRuns ? row.getElement().classList.add("last-run") : row.getElement().classList.remove("last-run");

        },
        dataEdited: function(row) {
            updateAllData();
        },
        rowDeleted: function(row) {
            updateAllData();
        },
        historyUndo: function(action, component, data) {
            updateAllData();
            this.setSort("id", "desc");

            // component.getElement().classList.add("flash-red");
        },
        historyRedo: function() {
            updateAllData();
            this.setSort("id", "desc");
        }
    });
}

function initializeDriverListTable() {
    driversTable = new Tabulator("#drivers-table", {
        columns: driverColumns,
        data: driverList,
        initialSort: [
            {column: "heat", dir: "asc"}
        ],
        layout: "fitDataFill",
        rowFormatter: function(row) {
            let data = row.getData();
            (data.runs >= maxNumberOfRuns) ? row.getElement().classList.add("last-run") : row.getElement().classList.remove("last-run");

        },
    });
}

function initializeVehicleListTable() {
    vehiclesTable = new Tabulator("#vehicles-table", {
        columns: vehicleColumns,
        data: vehicleList,
        initialFilter: [
            {field: "inUse", type: "=", value: true},
        ],
        layout: "fitDataFill",
        layoutColumnsOnNewData: true,
        index: "vehicleNumber",
    });
}

function setTabulatorModifiers() {
    Tabulator.prototype.extendModule("keybindings", "actions", {
        "addLapTime": function() {
            addLapTime();
        }
    });

    Tabulator.prototype.extendModule("moveRow", "senders", {
        preventMovingCompletedRun: function(fromRow, toRow, fromTable) {
            console.log(fromRow);
            return true;
        }
    });    
}


///////////////////////////////////////////////////////////////////
// DATA IMPORT / EXPORT
///////////////////////////////////////////////////////////////////
function importDataFromSpreadsheet(event, includeTimes) {
    let files = event.target.files;
    let f = files[0];
    let reader = new FileReader();

    reader.onload = function(event) {
        let data = new Uint8Array(event.target.result);
        let workbook = XLSX.read(data, {type: "array"});

        driverList = XLSX.utils.sheet_to_json(workbook.Sheets.Drivers);
        vehicleList = XLSX.utils.sheet_to_json(workbook.Sheets.Vehicles);

        if (driverList.length > 0) {
            driverList.sort((a, b) => (a.name < b.name) ? -1 : (a.name > b.name) ? 1 : 0); // sort in alphabetical order
            driversTable.setData(driverList);
        }

        if (vehicleList.length > 0) {
            vehicleList.sort((a, b) => (a.name < b.name) ? -1 : (a.name > b.name) ? 1 : 0); // sort in numerical order
            vehicleList.forEach(x => x.vehicleNumber = Number(x.name.slice(0, 2))); // add vehicle numbers
            vehiclesTable.setData(vehicleList);

            chrome.storage.local.set({vehicles: {vehicleList: vehicleList, lastSaved: moment().toJSON()}});
        }        

        if (includeTimes) {
            timesArray = XLSX.utils.sheet_to_json(workbook.Sheets.Times);

            if (timesArray.length > 0) {
                timesArray.map(x => x.timestamp = x.timestamp.replace(/['"]+/g, ''));
                timesArray.filter(x => !isEmptyOrUndefined(x.timestamp)).map(x => x.timestamp = moment(x.timestamp, moment.ISO_8601, true));
                timesTable.setData(timesArray);
            }            
        }

        updateAllData();
    }

    reader.readAsArrayBuffer(f);

    $(event.target).val("");
}

function downloadExcelData() {
    let vehiclesTableFilters = vehiclesTable.getFilters();
    let inUseVisible = vehiclesTable.getColumn("inUse").getVisibility();

    vehiclesTable.showColumn("inUse");
    vehiclesTable.clearFilter();

    let practiceDateFormatted = moment($("#practice-date").val()).format("YYYY-MM-DD");
    let sheets = {
        "Times": true,
        "Drivers": driversTable,
        "Vehicles": vehiclesTable,
    };
   
    timesTable.download("xlsx", practiceDateFormatted + " Times Export.xlsx", {sheets: sheets});

    if (!inUseVisible) vehiclesTable.hideColumn("inUse");
    vehiclesTable.setFilter(vehiclesTableFilters);
}


///////////////////////////////////////////////////////////////////
// CALCULATION FUNCTIONS
///////////////////////////////////////////////////////////////////
let isEmptyOrUndefined = function(input) {
    return (input) ? false : true;
}

let cardinalNumber = function(n){
    return n += [,'st','nd','rd'][n%100>>3^1&&n%10] || 'th'; 
} 

let calcTimeAdj = function(timeRaw, coneCount) {
    return (timeRaw == undefined) ? "" : parseFloat((timeRaw + conePenalty * coneCount).toFixed(3));
}

let createInitialTimesArray = function() {
    timesArray = [{id: 1}];
}


///////////////////////////////////////////////////////////////////
// DISPLAY MANIPULATION
///////////////////////////////////////////////////////////////////
function toggleSetupPane(width, padding) {
    let setupPaneButton = $("#setup-pane-button");
    let setupPane = $(".setup-pane");
    // let splitter  = $(".splitter");
    let timesPane = $(".times-pane");
    let appHeader = $(".app-header");
    let appHeaderHeight = appHeader.outerHeight();

    const SETUP_PANE_WIDTH = width;
    const SETUP_PANE_PADDING = padding;

    // if (!isEmptyOrUndefined(SETUP_PANE_WIDTH) && SETUP_PANE_WIDTH !== setupPane.width()) {

    // }
    if (1) {
        setupPaneButton.toggleClass("is-active");

        if (setupPaneButton.hasClass("is-active")) {
            setupPane.css("width", SETUP_PANE_WIDTH + "px");

            setupPane.css([
                "padding", appHeaderHeight + "px " + SETUP_PANE_PADDING + "px 0 " + SETUP_PANE_PADDING + "px",
                "width", SETUP_PANE_WIDTH + "px",
                ]);
            // splitter.css("margin-left", SETUP_PANE_WIDTH + 2*SETUP_PANE_PADDING + "px");
            timesPane.css("margin-left", SETUP_PANE_WIDTH + 2*SETUP_PANE_PADDING + "px");

            setupPane.toggle("slide", 300, function() {
                if (!driversTable) initializeDriverListTable();
                driversTable.setData(driverList);

                if (!vehiclesTable) initializeVehicleListTable();
                vehiclesTable.setData(vehicleList);
            })
            
            // vehiclesTable.setFilter("inUse", "=", true);
        }
        else {
          // setupPane.css("width", "0");
          // setupPane.css("padding", "0");
          timesPane.css("margin-left", "0");

          setupPane.toggle("slide", 300);
        }
    }   
}

function openModalDisplay(modalType, titleInput, cell) {
    let defer = $.Deferred();
    let buttonsConfig;
    switch(modalType) {
        case "deleteRun":
        case "deleteAllTimes":
            buttonsConfig = {
                "Delete": function() {
                    defer.resolve({confirmed: true, cell: cell});
                    $(this).dialog("close");
                },
                "Cancel": function() {
                    defer.resolve({confirmed: false, cell: cell});
                    $(this).dialog("close");
                }
            };
            break;
        case "download":
            buttonsConfig = {
                "Download": function() {
                    defer.resolve({confirmed: true, cell: cell});
                    $(this).dialog("close");
                },
                "Cancel": function() {
                    defer.resolve({confirmed: false, cell: cell});
                    $(this).dialog("close");
                }
            };   
            break;      
        default:
            buttonsConfig = {
                "OK": function() {
                    defer.resolve({confirmed: true, cell: cell});
                    $(this).dialog("close");
                },
                "Cancel": function() {
                    defer.resolve({confirmed: false, cell: cell});
                    $(this).dialog("close");
                }
            };                 
    }


    $("#modal-display").dialog({
        // autoOpen: false,
        resizable: false,
        height: "auto",
        width: 500,
        modal: true,
        show: {duration: modalFade},
        hide: {duration: modalFade},
        title: titleInput, 
        buttons: buttonsConfig,
    });

    switch(modalType) {
        case "deleteRun":
            cell.getData().name
            ? $("#modal-display").html("<p>Are you sure you want to delete " + cell.getData().name + "'s " + cardinalNumber(cell.getData().run) + " run?</p>")
            : $("#modal-display").html("<p>Are you sure you want to delete this run?</p>");
            break;
        case "download":
            $("#modal-display").html("<p>Are you sure you want to generate an Excel export?</p>");
            break;
        case "deleteAllTimes":
            $("#modal-display").html("<p>Are you sure you want to delete all recorded times for this event?</p>");
            break;
    }

    

    return defer.promise();
}

function toggleVehicleDisplay() {
    if (vehiclesTable.getFilters().length > 0) {
        vehiclesTable.showColumn("inUse");
        vehiclesTable.clearFilter();
    }
    else {
        vehiclesTable.hideColumn("inUse");
        vehiclesTable.setFilter("inUse", "=", true);
    }
}

function toggleDisplayCompletedDrivers() {
    if (driversTable.getFilters().length > 0) {
        driversTable.clearFilter();
    }
    else {
        driversTable.setFilter("runs", "<", maxNumberOfRuns);
    }
}


///////////////////////////////////////////////////////////////////
// PROCESS AND UPDATE DATA
///////////////////////////////////////////////////////////////////
function addLapTime(timeReceived, timestampReceived) {
    timesArray = timesTable.getData();
    let nextID;

    if (timesArray.length == 0) {
        createInitialTimesArray();
        nextID = 1;
    }
    else {
        nextID = timesArray.reduce((a, b) => (a.id > b.id) ? a : b).id + 1;
    }

    if (timeReceived === undefined) {
        timesTable.addRow({id: nextID}, true);
    }
    else {
        if (timesArray.filter(x => x.timestamp == undefined).length > 0) {
            let lowestEmptyID = timesArray.filter(x => x.id == timesArray.filter(x => isEmptyOrUndefined(x.timestamp)).reduce((a, b) => (a.id > b.id) ? b : a).id)[0];

            lowestEmptyID.timeRaw = timeReceived;
            lowestEmptyID.timestamp = timestampReceived;

            timesTable.setData(timesArray);
        }
        else {
            timesTable.addRow({id: nextID, timeRaw: timeReceived, timestamp: timestampReceived}, true);
        }  
        
    }

    updateAllData();

    let lowestEmptyName = timesArray.filter(x => x.id == timesArray.filter(x => isEmptyOrUndefined(x.name)).reduce((a, b) => (a.id > b.id) ? b : a).id)[0];
    if (nextID == lowestEmptyName.id) timesTable.getRow(nextID).getCell("name").edit();
}

function updateAllData(noSaveData) {
    processTimesModifiers();
    updateVehicleListTable();
    updateDriverListTable();
    updatePracticeStats();

    if (!noSaveData) savePracticeData();   
}

function processTimesModifiers() {
    timesArray = timesTable.getData();

    timesArray.filter(x => x.dnf == true || x.na == true).map(x => x.ignoreTimeAdj = true);

    timesArray.filter(x => x.ins == true).map(x => x.ignoreRunCount = true);
    timesArray.filter(x => x.ins !== true).map(x => x.ignoreRunCount = false);

    timesArray.filter(x => x.na == true).map(x => x.ignoreRunCount = true);
    // timesArray.filter(x => isEmptyOrUndefined(x.timestamp)).map(x => x.ignoreRunCount = true); //ignore runs in list but not yet completed

    timesArray.filter(x => x.dnf !== true && x.na !== true).map(x => x.ignoreTimeAdj = false);

    updateRunCounts();

    timesArray.filter(x => isEmptyOrUndefined(x.name)).map(x => x.run = "");
    
    timesArray.filter(x => x.ins == true).map(y => y.run = "INS");
    timesArray.filter(x => x.na == true).map(y => y.run = "N/A");
    timesArray.filter(x => x.na == true).map(y => y.timeAdj = "N/A");
    timesArray.filter(x => x.dnf == true).map(y => y.timeAdj = "DNF");



    timesArray.filter(x => x.ignoreTimeAdj !== true).map(y => y.timeAdj = calcTimeAdj(y.timeRaw, y.cones || 0));

    if (timesTable) timesTable.updateData(timesArray);
}

function updatePracticeStats() {
    timesArray = timesTable.getData();

    let runCount = timesArray.filter(x => !isEmptyOrUndefined(x.timestamp)).length;
    $("#runs").html(runCount);

    let timestampsArray = timesArray.map(x => moment(x.timestamp, TIMESTAMP_FORMAT)).filter(x => x.isValid());
    timestampsArray = timestampsArray.sort((a, b) => a.valueOf() - b.valueOf());
    let timeDiffsArray = [];

    for (let i = 1; i < timestampsArray.length; i++) {
        timeDiffsArray.push(timestampsArray[i].diff(timestampsArray[i-1]) / 1000);
    }

    let averageTime = timeDiffsArray.reduce((a, b) => a + b, 0) / runCount;
    $("#average-time").html(moment("1900-01-01 00:00:00").add(averageTime, "seconds").format("mm:ss"));

    let totalTime = moment.utc(moment.max(timestampsArray).diff(moment.min(timestampsArray))).format("HH:mm:ss");
    $("#total-time").html(totalTime);

    let totalTimeEst = moment.utc(driverList.length * maxNumberOfRuns * averageTime*1000).format("HH:mm:ss");
    $("#total-time-est").html(totalTimeEst);

    let endEst = moment.min(timestampsArray).add(moment.duration(driverList.length * maxNumberOfRuns * averageTime*1000)).format("h:mm A");
    $("#end-est").html(endEst);

    let conesHit = timesArray.map(x => x.cones).filter(x => x > 0).reduce((a, b) => a + b, 0);
    $("#cones-hit").html(conesHit);

    let remainingRuns = driverList.length * maxNumberOfRuns - timesArray.filter(x => x.ignoreRunCount !== true).length;
    $("#remaining-runs").html(remainingRuns);

    let percentComplete = (driverList.length * maxNumberOfRuns - remainingRuns) / (driverList.length * maxNumberOfRuns) * 100;
    $("#complete").html(percentComplete.toFixed(0) + "%");  

    chrome.app.window.current().averageTime = averageTime;
}

function updateDriverListTable() {
    if (!driverList) initializeDriverListTable();

    timesArray = timesTable.getData();
    driverList = driversTable.getData();

    driverList.map(x => x.ftd = "");
    driverList.map(x => x.driver = "");

    driverList.map(x => x.runs = timesArray.filter(y => y.name == x.name).length);


    driverList.map(x => x.ftd = timesArray.filter(y => y.name == x.name && Number(y.timeAdj) && !isEmptyOrUndefined(y.vehicle)).sort((a, b) => a.timeAdj < b.timeAdj ? 1 : -1).reduce((a, b) => a.timeAdj < b.TimeAdj ? a.timeAdj : b.timeAdj, ""));
    driverList.map(x => x.vehicle = timesArray.filter(y => y.name == x.name && Number(y.timeAdj) && !isEmptyOrUndefined(y.vehicle)).sort((a, b) => a.timeAdj < b.timeAdj ? 1 : -1).reduce((a, b) => a.timeAdj < b.TimeAdj ? a.vehicle : b.vehicle, ""));

    $("#driver-count").html(" (" + driverList.length + ")");

    driversTable.setData(driverList);

    timesTable.options.columns.filter(x => x.field == "name").map(x => x.editorParams.values = driverList.map(x => x.name));
}

function updateVehicleListTable(set) {
    if (!vehicleList) initializeVehicleListTable();

    timesArray = timesTable.getData();
    vehicleList = vehiclesTable.getData();

    let numberOfRuns = 0;
    let runsThisVehicle = [];

    vehicleList.forEach(function(thisVehicle) {
        numberOfRuns = timesArray.filter(x => x.vehicle == thisVehicle.name).length;

        if (numberOfRuns !== 0) {
            thisVehicle.runs = numberOfRuns;
            runsThisVehicle = timesArray.filter(x => x.vehicle == thisVehicle.name && Number(x.timeAdj));

            thisVehicle.ftd = runsThisVehicle.reduce((a, b) => a.timeAdj < b.timeAdj ? a : b, 0).timeAdj || "";
            thisVehicle.driver = runsThisVehicle.reduce((a, b) => a.timeAdj < b.timeAdj ? a : b, 0).name || "";
        }
        else {
            thisVehicle.ftd = "";
            thisVehicle.runs = "";
            thisVehicle.driver = "";
        }
    });

    $("#active-vehicle-count").html(" (" + vehicleList.filter(x => x.inUse).length + ")");

    set ? vehiclesTable.setData(vehicleList) : vehiclesTable.updateData(vehicleList);

    timesTable.options.columns.filter(x => x.field == "vehicle").map(x => x.editorParams.values = vehicleList.filter(x => x.inUse == true).map(x => x.name));
}

function updateRunCounts() {
    let uniqueNames = [...new Set(timesArray.map(x => x.name))];
    let thisNameTimes = [];

    uniqueNames.forEach(function(thisName) {
        if (thisName) {
            thisNameTimes = timesArray.filter(x => x.name == thisName);
            thisNameTimes.sort((a, b) => a.id > b.id ? 1 : - 1);

            // thisNameTimes.filter(x => x.ins == true).map(x => x.run = "INS");
            // thisNameTimes.filter(x => x.na == true).map(x => x.run = "N/A");

            thisNameTimes.filter(x => x.ignoreRunCount !== true).map(x => x.run = thisNameTimes.filter(x => x.ignoreRunCount !== true).indexOf(x) + 1);

            // timesArray.filter(x => isEmptyOrUndefined(x.name)).map(x => x.run = "");
        } 
    });
}


///////////////////////////////////////////////////////////////////
// CHROME STORAGE
///////////////////////////////////////////////////////////////////
function loadStoredPracticeData(initialLoad) {
    chrome.storage.local.get(null, function(data) {
        storedVehicles = data.vehicles.vehicleList;
        lastSavedVehicles = moment(data.vehicles.lastSaved, moment.ISO_8601, true);

        if (storedVehicles) {
            vehicleList = storedVehicles;
            vehiclesTable.setData(vehicleList);

            updateAllData(true);
        }

        let lastPracticeLoaded = data.lastPracticeLoaded;

        let practiceDateFormatted = (initialLoad && lastPracticeLoaded) ? lastPracticeLoaded : moment($("#practice-date").val()).format("YYYY-MM-DD");
        $("#practice-date").val(practiceDateFormatted);

        let practiceForThisDate = data[practiceDateFormatted];

        if (practiceForThisDate) {
            $("#number-of-runs").val(parseInt(practiceForThisDate.maxNumberOfRuns));
            maxNumberOfRuns = parseInt(practiceForThisDate.maxNumberOfRuns);

            if (practiceForThisDate.drivers.length > 0) {
                driverList = practiceForThisDate.drivers;
                driversTable.setData(driverList);
            }

            if (practiceForThisDate.vehicles.length > 0) {
                vehicleList = practiceForThisDate.vehicles;
                vehiclesTable.setData(vehicleList);
            }

            if (practiceForThisDate.times.length > 0) {
                timesArray = practiceForThisDate.times;
                timesArray.filter(x => !isEmptyOrUndefined(x.timestamp)).map(x => x.timestamp = moment(x.timestamp, moment.ISO_8601, true));
                timesTable.setData(timesArray);
            }

            chrome.storage.local.set({"lastPracticeLoaded": practiceDateFormatted});

            updateAllData(true);
        }
    })    
}

function savePracticeData() {
    let practiceDateFormatted = moment($("#practice-date").val()).format("YYYY-MM-DD");
    let storageArray = {};

    storageArray.times = timesArray;
    storageArray.times.filter(x => !isEmptyOrUndefined(x.timestamp)).map(x => x.timestamp = x.timestamp.toISOString());

    storageArray.drivers = driverList;
    storageArray.vehicles = vehicleList;
    storageArray.maxNumberOfRuns = maxNumberOfRuns;
    storageArray.conePenalty = conePenalty;
    storageArray.lastSaved = moment().toISOString();

    chrome.storage.local.set({[practiceDateFormatted]: storageArray, "lastPracticeLoaded": practiceDateFormatted});
}


///////////////////////////////////////////////////////////////////
// SERIAL DATA 
///////////////////////////////////////////////////////////////////
let serialOptions = {bitrate: 1200, dataBits: "eight", parityBit: "no", stopBits: "one"};
let stringReceived = "";
let timeReceived;
let inCurrentMessage = false;

chrome.serial.getDevices(onGetDevices);
chrome.serial.onReceive.addListener(onReceiveCallback);
chrome.serial.onReceiveError.addListener(onReceiveErrorCallback);

function populateCOMPortDropdown() { // Currently not in timer app due to auto-selection of timing device COM port
    let COMPortDropdown = $("#com-port");

    COMPortsArray.forEach(function(thisCOMPort) {
        COMPortDropdown.append($("<option>", {value: thisCOMPort.path, text: thisCOMPort.path}));
    });    
}

function checkForTimingDevice() {
    let productID = 8963;
    let vendorID = 1659;

    serialPort = COMPortsArray.filter(x => x.productId == 8963 && x.vendorId == 1659).map(x => x.path)[0];

    if (serialPort) {
        chrome.serial.connect(serialPort, serialOptions, onConnect);
        $("#timing-device-status").html("Connected<div class='timing-device-status-icon disabled'><i class='fas fa-link'></i></div>");
    }
    else {
        $("#timing-device-status").html("Not Found<div class='timing-device-status-icon'><i class='fas fa-unlink'></i></div>");
    }
}

function onGetDevices(ports) {
    let COMPortDropdown = $("#com-port");

    for (let i = 0; i < ports.length; i++) {
        COMPortsArray.push(ports[i]);
        // COMPortDropdown.append($("<option>", {value: ports[i].path, text: ports[i].path}));
        
        console.log(ports[i].path);
    }

    COMPortsArray.sort();
}

function onConnect(connectionInfo) {
    console.log(connectionInfo.connectionId);
}

function onReceiveCallback(info) {
    let thisInteger = convertSerialToASCII(info.data);

    if (thisInteger == 13) {
        inCurrentMessage = !inCurrentMessage;
        if (inCurrentMessage) {
            stringReceived = "";
            timeReceived = undefined;
        }
        else {
            timeReceived = parseFloat(stringReceived);
            addLapTime(timeReceived, moment());
        }
    }

    if (thisInteger !== 14 && thisInteger !== 15 && inCurrentMessage) {
        stringReceived += String.fromCharCode(thisInteger);
    }
}

function onReceiveErrorCallback(info) {
    $("#timing-device-status").html("Not Found<div class='timing-device-status-icon'><i class='fas fa-unlink'></i></div>");
}

function convertSerialToASCII(serialData) {
    return new Int8Array(serialData)[0];
}

function writeSerial(str) {
  chrome.serial.send(connectionId, convertStringToArrayBuffer(str), onSend);
}

function convertStringToArrayBuffer(str) { // Convert string to ArrayBuffer
  let buf = new ArrayBuffer(str.length);
  let bufView = new Uint8Array(buf);
  for (let i = 0; i < str.length; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

function connectToSerialPort() {
    // let selectedCOMPort = $("#com-port").val() || COMPortsArray[0];
    chrome.serial.connect(selectedCOMPort, {bitrate: 1200, dataBits: "eight", parityBit: "no", stopBits: "one"}, onConnect);
    chrome.serial.onReceive.addListener(onReceiveCallback);
}


///////////////////////////////////////////////////////////////////
// SAMPLE DATA
///////////////////////////////////////////////////////////////////
function createSampleDriverList() {
    driverList = [
        {name: "Aaron Linke", heat: 1},
        {name: "Alexandra Honey", heat: 2},
        {name: "Amaarah Johnson", heat: 2},
        {name: "Andrew Schembri", heat: 1},
        {name: "Anthony Donatelli", heat: 1},
        {name: "Bob Davies", heat: 2},
        {name: "Brandon Bishop", heat: 1},
        {name: "Chase Lowder", heat: 1},
        {name: "Christopher Biddle", heat: 2},
        {name: "Christopher Heinzen", heat: 1},
        {name: "Cody Pae", heat: 1},
        {name: "Daniel Mozel", heat: 2},
        {name: "David Hoch", heat: 2},
        {name: "Demitry Belski", heat: 2},
        {name: "Devon Hall", heat: 1},
        {name: "Dylan Studden", heat: 1},
        {name: "Eddie Franklin Jr", heat: 2},
        {name: "Edward Pancost", heat: 1},
        {name: "Ethan Winberg", heat: 1},
        {name: "Forrest Berg", heat: 2},
        {name: "Hector Lozada", heat: 1},
        {name: "Henry Chen", heat: 2},
        {name: "James Gross", heat: 1},
        {name: "Jason Blair", heat: 2},
        {name: "Joel Fernandez", heat: 1},
        {name: "Jon D Stanley", heat: 2},
        {name: "Joshua Rios", heat: 1},
        {name: "Joshua Stroup", heat: 2},
        {name: "Julie Starr", heat: 1},
        {name: "Kalvin Parker", heat: 1},
        {name: "Kamran Ahmed", heat: 1},
        {name: "Karl Riggs", heat: 2},
        {name: "Kevin Albert", heat: 2},
        {name: "Kevin Killian", heat: 1},
        {name: "Lawson Sumner", heat: 2},
        {name: "Leslie Urff", heat: 2},
        {name: "Lindsey Scheer", heat: 1},
        {name: "Louis Cohen", heat: 1},
        {name: "Luke Au", heat: 1},
        {name: "Manuel Sanchez", heat: 1},
        {name: "Matthew CHEMBOLA", heat: 1},
        {name: "Michael Nakhla", heat: 2},
        {name: "Paul Townsend", heat: 2},
        {name: "Rodrigo Rojas Mondragon", heat: 1},
        {name: "Ryan Sierzega", heat: 1},
        {name: "Safadyn Ramahi", heat: 1},
        {name: "Seth Brown", heat: 1},
        {name: "Stephen Dissler Jr", heat: 2},
        {name: "Stephen Hayes", heat: 1},
        {name: "Stephen Ioas", heat: 2},
        {name: "Tyler Chantrenne", heat: 1},
        {name: "Valerie Malaney", heat: 1},
        {name: "Varun Patel", heat: 1},
        {name: "Vikram Krishnan", heat: 1},
        {name: "Wesley Haney", heat: 2},
        {name: "William Bennett", heat: 1},
    ];

    driverList.sort((a, b) => (a.name < b.name) ? -1 : (a.name > b.name) ? 1 : 0);
}

function createSampleVehicleList() {
    vehicleList = [
        {name : "15 - Orange Bolt", index: 0.829839304135878, inUse : false, runs: "", ftd: "", driver: ""},
        {name : "18 - Blue Auto ATS-V", index: 0.954912681138899, inUse : false, runs: "", ftd: "", driver: ""},
        {name : "19 - Blue ATS-2.0T", index: 0.91, inUse : true, runs: "", ftd: "", driver: ""},
        {name : "20 - Red Regal GS", index: 0.925059522358475, inUse : true, runs: "", ftd: "", driver: ""},
        {name : "21 - White V6 Camaro", index: 0.96509245828935, inUse : true, runs: "", ftd: "", driver: ""},
        {name : "22 - Birdcage Z/28", index: 0.970679569945508, inUse : false, runs: "", ftd: "", driver: ""},
        {name : "23 - Red CTS V-Sport", index: 0.867871520045433, inUse : true, runs: "", ftd: "", driver: ""},
        {name : "24 - Red Holden Wagon", index: 0.963, inUse : false, runs: "", ftd: "", driver: ""},
        {name : "86 - Black Camaro LT1", index: 0.98, inUse : true, runs: "", ftd: "", driver: ""},
        {name : "87 - Deep Red Camaro LTG 1LE", index: 0.975089785017268, inUse : false, runs: "", ftd: "", driver: ""},
        {name : "88 - Deep Red Corvette GS", index: 0.993498631557278, inUse : false, runs: "", ftd: "", driver: ""},
        {name : "89 - Grey ATS-V.C", index: 0.96, inUse : false, runs: "", ftd: "", driver: ""},
        {name : "90 - Red Camaro Z/28", index: 0.979275793108152, inUse : false, runs: "", ftd: "", driver: ""},
        {name : "91 - Red Corvette GS", index: 1, inUse : true, runs: "", ftd: "", driver: ""},
        {name : "92 - Orange Corvette Z06", index: 1, inUse : false, runs: "", ftd: "", driver: ""},
        {name : "94 - White Corvette Z06", index: 1, inUse : true, runs: "", ftd: "", driver: ""},
        {name : "95 - Black Camaro LTG", index: 0.935537505721598, inUse : false, runs: "", ftd: "", driver: ""},
        {name : "96 - Black Camaro LTG 1LE", index: 0.92, inUse : false, runs: "", ftd: "", driver: ""},
        {name : "97 - Blue Camaro SS", index: 0.945, inUse : false, runs: "", ftd: "", driver: ""},
        {name : "98 - Red Camaro SS 1LE", index: 0.974901700495802, inUse : true, runs: "", ftd: "", driver: ""},
        {name : "99 - Red Turbo 1LE", index: 0.978212446342272, inUse : true, runs: "", ftd: "", driver: ""},

    ];

    vehicleList.sort((a, b) => (a.name < b.name) ? -1 : (a.name > b.name) ? 1 : 0); // short in numerical order
    vehicleList.forEach(x => x.vehicleNumber = Number(x.name.slice(0, 2))); // add vehicle numbers
}

function createSampleTimesArray() {
    timesArray = [
        {id: 1, name: "Lawson Sumner", vehicle: "94 - White Corvette Z06", cones: 1, timeRaw: 59.265, timestamp: moment($('#practice-date').val() + ' ' + "9:31:08 AM"), dnf: false, ins: false, na: false},
        {id: 2, name: "Cody Pae", vehicle: "19 - Blue ATS-2.0T", cones: "", timeRaw: 63.966, timestamp: moment($('#practice-date').val() + ' ' + "9:31:53 AM"), dnf: false, ins: true, na: false},
        {id: 3, name: "Brandon Bishop", vehicle: "21 - White V6 Camaro", cones: "", timeRaw: 64.888, timestamp: moment($('#practice-date').val() + ' ' + "9:33:42 AM"), dnf: false, ins: false, na: false},
        {id: 4, name: "Aaron Linke", vehicle: "99 - Red Turbo 1LE", cones: "", timeRaw: 62.687, timestamp: moment($('#practice-date').val() + ' ' + "9:34:13 AM"), dnf: false, ins: false, na: false},
        {id: 5, name: "Andrew Schembri", vehicle: "98 - Red Camaro SS 1LE", cones: 2, timeRaw: 57.927, timestamp: moment($('#practice-date').val() + ' ' + "9:34:44 AM"), dnf: false, ins: false, na: false},
        {id: 6, name: "Hector Lozada", vehicle: "22 - Bill's Red Z/28", cones: 2, timeRaw: 61.379, timestamp: moment($('#practice-date').val() + ' ' + "9:36:41 AM"), dnf: false, ins: false, na: false},
        {id: 7, name: "Anthony Donatelli", vehicle: "23 - Red CTS V-Sport", cones: "", timeRaw: 65.075, timestamp: moment($('#practice-date').val() + ' ' + "9:37:14 AM"), dnf: false, ins: false, na: false},
        {id: 8, name: "Lindsey Scheer", vehicle: "91 - Red Corvette GS", cones: 3, timeRaw: 62.042, timestamp: moment($('#practice-date').val() + ' ' + "9:37:49 AM"), dnf: false, ins: false, na: false},
        {id: 9, name: "James Gross", vehicle: "19 - Blue ATS-2.0T", cones: 1, timeRaw: 65.132, timestamp: moment($('#practice-date').val() + ' ' + "9:39:39 AM"), dnf: false, ins: false, na: false},
        {id: 10, name: "Lawson Sumner", vehicle: "94 - White Corvette Z06", cones: "", timeRaw: 55.385, timestamp: moment($('#practice-date').val() + ' ' + "9:40:06 AM"), dnf: false, ins: false, na: false},
        {id: 11, name: "Aaron Linke", vehicle: "99 - Red Turbo 1LE", cones: "", timeRaw: 58.011, timestamp: moment($('#practice-date').val() + ' ' + "9:40:34 AM"), dnf: false, ins: false, na: false},
        {id: 12, name: "Andrew Schembri", vehicle: "98 - Red Camaro SS 1LE", cones: 2, timeRaw: 57.516, timestamp: moment($('#practice-date').val() + ' ' + "9:43:19 AM"), dnf: false, ins: false, na: false},
        {id: 13, name: "Brandon Bishop", vehicle: "21 - White V6 Camaro", cones: "", timeRaw: 61.177, timestamp: moment($('#practice-date').val() + ' ' + "9:43:47 AM"), dnf: false, ins: false, na: false},
        {id: 14, name: "Hector Lozada", vehicle: "22 - Bill's Red Z/28", cones: "", timeRaw: 60.264, timestamp: moment($('#practice-date').val() + ' ' + "9:44:19 AM"), dnf: false, ins: false, na: false},
        {id: 15, name: "Anthony Donatelli", vehicle: "23 - Red CTS V-Sport", cones: "", timeRaw: 67.412, timestamp: moment($('#practice-date').val() + ' ' + "9:46:30 AM"), dnf: false, ins: false, na: false},
        {id: 16, name: "Lindsey Scheer", vehicle: "91 - Red Corvette GS", cones: 3, timeRaw: 60.245, timestamp: moment($('#practice-date').val() + ' ' + "9:46:57 AM"), dnf: false, ins: false, na: false},
        {id: 17, name: "James Gross", vehicle: "19 - Blue ATS-2.0T", cones: 2, timeRaw: 65.291, timestamp: moment($('#practice-date').val() + ' ' + "9:48:40 AM"), dnf: false, ins: false, na: false},
        {id: 18, name: "Lawson Sumner", vehicle: "94 - White Corvette Z06", cones: "", timeRaw: 54.475, timestamp: moment($('#practice-date').val() + ' ' + "9:50:19 AM"), dnf: false, ins: false, na: false},
        {id: 19, name: "Vikram Krishnan", vehicle: "99 - Red Turbo 1LE", cones: "", timeRaw: 65.771, timestamp: moment($('#practice-date').val() + ' ' + "9:51:05 AM"), dnf: false, ins: false, na: false},
        {id: 20, name: "Rodrigo Rojas Mondragon", vehicle: "98 - Red Camaro SS 1LE", cones: "", timeRaw: 59.699, timestamp: moment($('#practice-date').val() + ' ' + "9:53:04 AM"), dnf: true, ins: false, na: false},
        {id: 21, name: "Brandon Bishop", vehicle: "21 - White V6 Camaro", cones: 2, timeRaw: 59.019, timestamp: moment($('#practice-date').val() + ' ' + "9:53:33 AM"), dnf: false, ins: false, na: false},
        {id: 22, name: "Joel Fernandez", vehicle: "22 - Bill's Red Z/28", cones: 1, timeRaw: 59.583, timestamp: moment($('#practice-date').val() + ' ' + "9:55:10 AM"), dnf: false, ins: false, na: false},
        {id: 23, name: "Lindsey Scheer", vehicle: "91 - Red Corvette GS", cones: 2, timeRaw: 57.906, timestamp: moment($('#practice-date').val() + ' ' + "9:55:34 AM"), dnf: false, ins: false, na: false},
        {id: 24, name: "Anthony Donatelli", vehicle: "23 - Red CTS V-Sport", cones: "", timeRaw: 64.753, timestamp: moment($('#practice-date').val() + ' ' + "9:57:43 AM"), dnf: false, ins: false, na: false},
        {id: 25, name: "James Gross", vehicle: "19 - Blue ATS-2.0T", cones: 2, timeRaw: 67.836, timestamp: moment($('#practice-date').val() + ' ' + "9:58:16 AM"), dnf: false, ins: false, na: false},
        {id: 26, name: "Vikram Krishnan", vehicle: "99 - Red Turbo 1LE", cones: 1, timeRaw: 60.444, timestamp: moment($('#practice-date').val() + ' ' + "9:59:39 AM"), dnf: false, ins: false, na: false},
        {id: 27, name: "Lawson Sumner", vehicle: "94 - White Corvette Z06", cones: 1, timeRaw: 53.249, timestamp: moment($('#practice-date').val() + ' ' + "10:00:06 AM"), dnf: false, ins: false, na: false},
        {id: 28, name: "Rodrigo Rojas Mondragon", vehicle: "98 - Red Camaro SS 1LE", cones: "", timeRaw: 59.024, timestamp: moment($('#practice-date').val() + ' ' + "10:01:46 AM"), dnf: false, ins: false, na: false},
        {id: 29, name: "Seth Brown", vehicle: "21 - White V6 Camaro", cones: 2, timeRaw: 58.418, timestamp: moment($('#practice-date').val() + ' ' + "10:03:34 AM"), dnf: false, ins: false, na: false},
        {id: 30, name: "Joel Fernandez", vehicle: "22 - Bill's Red Z/28", cones: "", timeRaw: 56.801, timestamp: moment($('#practice-date').val() + ' ' + "10:05:02 AM"), dnf: false, ins: false, na: false},
        {id: 31, name: "Anthony Donatelli", vehicle: "23 - Red CTS V-Sport", cones: "", timeRaw: 63.472, timestamp: moment($('#practice-date').val() + ' ' + "10:05:51 AM"), dnf: false, ins: false, na: false},
        {id: 32, name: "James Gross", vehicle: "19 - Blue ATS-2.0T", cones: 1, timeRaw: 64.087, timestamp: moment($('#practice-date').val() + ' ' + "10:06:23 AM"), dnf: false, ins: false, na: false},
        {id: 33, name: "Christopher Heinzen", vehicle: "91 - Red Corvette GS", cones: "", timeRaw: 57.924, timestamp: moment($('#practice-date').val() + ' ' + "10:07:38 AM"), dnf: false, ins: true, na: false},
        {id: 34, name: "Aaron Linke", vehicle: "99 - Red Turbo 1LE", cones: "", timeRaw: 57.73, timestamp: moment($('#practice-date').val() + ' ' + "10:09:56 AM"), dnf: false, ins: false, na: false},
        {id: 35, name: "Luke Au", vehicle: "94 - White Corvette Z06", cones: "", timeRaw: 63.765, timestamp: moment($('#practice-date').val() + ' ' + "10:10:33 AM"), dnf: true, ins: false, na: false},
        {id: 36, name: "Andrew Schembri", vehicle: "98 - Red Camaro SS 1LE", cones: 2, timeRaw: 57.759, timestamp: moment($('#practice-date').val() + ' ' + "10:10:57 AM"), dnf: false, ins: false, na: false},
        {id: 37, name: "Hector Lozada", vehicle: "22 - Bill's Red Z/28", cones: "", timeRaw: 57.537, timestamp: moment($('#practice-date').val() + ' ' + "10:13:13 AM"), dnf: false, ins: false, na: false},
        {id: 38, name: "Seth Brown", vehicle: "21 - White V6 Camaro", cones: 2, timeRaw: 56.974, timestamp: moment($('#practice-date').val() + ' ' + "10:13:57 AM"), dnf: false, ins: false, na: false},
        {id: 39, name: "Anthony Donatelli", vehicle: "23 - Red CTS V-Sport", cones: "", timeRaw: 62.179, timestamp: moment($('#practice-date').val() + ' ' + "10:16:48 AM"), dnf: false, ins: false, na: false},
        {id: 40, name: "Lindsey Scheer", vehicle: "91 - Red Corvette GS", cones: 1, timeRaw: 64.62, timestamp: moment($('#practice-date').val() + ' ' + "10:17:20 AM"), dnf: false, ins: false, na: false},
        {id: 41, name: "James Gross", vehicle: "19 - Blue ATS-2.0T", cones: "", timeRaw: 67.086, timestamp: moment($('#practice-date').val() + ' ' + "10:17:47 AM"), dnf: false, ins: false, na: false},
        {id: 42, name: "Aaron Linke", vehicle: "99 - Red Turbo 1LE", cones: 1, timeRaw: 56.333, timestamp: moment($('#practice-date').val() + ' ' + "10:18:14 AM"), dnf: false, ins: false, na: false},
        {id: 43, name: "Andrew Schembri", vehicle: "98 - Red Camaro SS 1LE", cones: "", timeRaw: 57.142, timestamp: moment($('#practice-date').val() + ' ' + "10:20:20 AM"), dnf: false, ins: false, na: false},
        {id: 44, name: "Hector Lozada", vehicle: "22 - Bill's Red Z/28", cones: 1, timeRaw: 203.2, timestamp: moment($('#practice-date').val() + ' ' + "10:21:10 AM"), dnf: false, ins: false, na: true},
        {id: 45, name: "Luke Au", vehicle: "94 - White Corvette Z06", cones: "", timeRaw: 59.999, timestamp: moment($('#practice-date').val() + ' ' + "10:21:14 AM"), dnf: false, ins: false, na: false},
        {id: 46, name: "Seth Brown", vehicle: "21 - White V6 Camaro", cones: 1, timeRaw: 56.864, timestamp: moment($('#practice-date').val() + ' ' + "10:22:35 AM"), dnf: false, ins: false, na: false},
        {id: 47, name: "Aaron Linke", vehicle: "99 - Red Turbo 1LE", cones: "", timeRaw: 57.251, timestamp: moment($('#practice-date').val() + ' ' + "10:23:46 AM"), dnf: false, ins: false, na: false},
        {id: 48, name: "Valerie Malaney", vehicle: "98 - Red Camaro SS 1LE", cones: 3, timeRaw: 60.639, timestamp: moment($('#practice-date').val() + ' ' + "10:24:19 AM"), dnf: false, ins: false, na: false},
        {id: 49, name: "Lindsey Scheer", vehicle: "23 - Red CTS V-Sport", cones: "", timeRaw: 66.588, timestamp: moment($('#practice-date').val() + ' ' + "10:26:30 AM"), dnf: false, ins: false, na: false},
        {id: 50, name: "Hector Lozada", vehicle: "22 - Bill's Red Z/28", cones: 2, timeRaw: 56.722, timestamp: moment($('#practice-date').val() + ' ' + "10:28:41 AM"), dnf: false, ins: false, na: false},
        {id: 51, name: "Seth Brown", vehicle: "21 - White V6 Camaro", cones: 3, timeRaw: 56.971, timestamp: moment($('#practice-date').val() + ' ' + "10:30:22 AM"), dnf: false, ins: false, na: false},
        {id: 52, name: "Luke Au", vehicle: "94 - White Corvette Z06", cones: "", timeRaw: 58.783, timestamp: moment($('#practice-date').val() + ' ' + "10:32:08 AM"), dnf: true, ins: false, na: false},
        {id: 53, name: "Valerie Malaney", vehicle: "98 - Red Camaro SS 1LE", cones: 1, timeRaw: 61.97, timestamp: moment($('#practice-date').val() + ' ' + "10:34:04 AM"), dnf: false, ins: false, na: false},
        {id: 54, name: "Vikram Krishnan", vehicle: "99 - Red Turbo 1LE", cones: 3, timeRaw: 59.944, timestamp: moment($('#practice-date').val() + ' ' + "10:36:17 AM"), dnf: false, ins: false, na: false},
        {id: 55, name: "Hector Lozada", vehicle: "22 - Bill's Red Z/28", cones: "", timeRaw: 55.973, timestamp: moment($('#practice-date').val() + ' ' + "10:38:00 AM"), dnf: false, ins: false, na: false},
        {id: 56, name: "Seth Brown", vehicle: "21 - White V6 Camaro", cones: 2, timeRaw: 56.379, timestamp: moment($('#practice-date').val() + ' ' + "10:38:30 AM"), dnf: false, ins: false, na: false},
        {id: 57, name: "Luke Au", vehicle: "94 - White Corvette Z06", cones: 3, timeRaw: 59.097, timestamp: moment($('#practice-date').val() + ' ' + "10:39:28 AM"), dnf: false, ins: false, na: false},
        {id: 58, name: "Valerie Malaney", vehicle: "98 - Red Camaro SS 1LE", cones: 1, timeRaw: 59.281, timestamp: moment($('#practice-date').val() + ' ' + "10:41:02 AM"), dnf: false, ins: false, na: false},
        {id: 59, name: "Vikram Krishnan", vehicle: "99 - Red Turbo 1LE", cones: 1, timeRaw: 58.558, timestamp: moment($('#practice-date').val() + ' ' + "10:42:11 AM"), dnf: false, ins: false, na: false},
        {id: 60, name: "Joel Fernandez", vehicle: "22 - Bill's Red Z/28", cones: 2, timeRaw: 57.461, timestamp: moment($('#practice-date').val() + ' ' + "10:42:36 AM"), dnf: false, ins: false, na: false},
        {id: 61, name: "Luke Au", vehicle: "94 - White Corvette Z06", cones: 2, timeRaw: 57.741, timestamp: moment($('#practice-date').val() + ' ' + "10:44:43 AM"), dnf: false, ins: false, na: false},
        {id: 62, name: "Joel Fernandez", vehicle: "22 - Bill's Red Z/28", cones: 1, timeRaw: 55.919, timestamp: moment($('#practice-date').val() + ' ' + "10:45:53 AM"), dnf: false, ins: false, na: false},
        {id: 63, name: "Rodrigo Rojas Mondragon", vehicle: "98 - Red Camaro SS 1LE", cones: "", timeRaw: 58.348, timestamp: moment($('#practice-date').val() + ' ' + "10:46:26 AM"), dnf: false, ins: false, na: false},
        {id: 64, name: "Brandon Bishop", vehicle: "21 - White V6 Camaro", cones: 1, timeRaw: 58.258, timestamp: moment($('#practice-date').val() + ' ' + "10:49:24 AM"), dnf: false, ins: false, na: false},
        {id: 65, name: "Vikram Krishnan", vehicle: "99 - Red Turbo 1LE", cones: "", timeRaw: 58.807, timestamp: moment($('#practice-date').val() + ' ' + "10:51:26 AM"), dnf: false, ins: false, na: false},
        {id: 66, name: "Lawson Sumner", vehicle: "94 - White Corvette Z06", cones: "", timeRaw: 53.417, timestamp: moment($('#practice-date').val() + ' ' + "10:51:49 AM"), dnf: false, ins: false, na: false},
        {id: 67, name: "Joel Fernandez", vehicle: "22 - Bill's Red Z/28", cones: "", timeRaw: 55.732, timestamp: moment($('#practice-date').val() + ' ' + "10:52:23 AM"), dnf: false, ins: false, na: false},
        {id: 68, name: "Brandon Bishop", vehicle: "21 - White V6 Camaro", cones: "", timeRaw: 59.304, timestamp: moment($('#practice-date').val() + ' ' + "10:52:55 AM"), dnf: false, ins: false, na: false},
        {id: 69, name: "Ryan Sierzega", vehicle: "99 - Red Turbo 1LE", cones: "", timeRaw: 64.558, timestamp: moment($('#practice-date').val() + ' ' + "10:54:46 AM"), dnf: true, ins: false, na: false},
        {id: 70, name: "Rodrigo Rojas Mondragon", vehicle: "86 - Black Camaro LT1", cones: 2, timeRaw: 57.584, timestamp: moment($('#practice-date').val() + ' ' + "10:56:30 AM"), dnf: false, ins: false, na: false},
        {id: 71, name: "Chase Lowder", vehicle: "22 - Bill's Red Z/28", cones: "", timeRaw: 67.11, timestamp: moment($('#practice-date').val() + ' ' + "10:57:08 AM"), dnf: true, ins: false, na: false},
        {id: 72, name: "Ryan Sierzega", vehicle: "99 - Red Turbo 1LE", cones: "", timeRaw: 60.598, timestamp: moment($('#practice-date').val() + ' ' + "10:58:48 AM"), dnf: false, ins: false, na: false},
        {id: 73, name: "Valerie Malaney", vehicle: "94 - White Corvette Z06", cones: 2, timeRaw: 57.927, timestamp: moment($('#practice-date').val() + ' ' + "10:59:14 AM"), dnf: false, ins: false, na: false},
        {id: 74, name: "Chase Lowder", vehicle: "22 - Bill's Red Z/28", cones: 1, timeRaw: 65.095, timestamp: moment($('#practice-date').val() + ' ' + "11:00:35 AM"), dnf: false, ins: false, na: false},
        {id: 75, name: "Ryan Sierzega", vehicle: "99 - Red Turbo 1LE", cones: "", timeRaw: 58.623, timestamp: moment($('#practice-date').val() + ' ' + "11:01:56 AM"), dnf: false, ins: false, na: false},
        {id: 76, name: "Chase Lowder", vehicle: "22 - Bill's Red Z/28", cones: 1, timeRaw: 60.856, timestamp: moment($('#practice-date').val() + ' ' + "11:03:31 AM"), dnf: false, ins: false, na: false},
        {id: 77, name: "Ryan Sierzega", vehicle: "99 - Red Turbo 1LE", cones: 3, timeRaw: 59.514, timestamp: moment($('#practice-date').val() + ' ' + "11:04:57 AM"), dnf: false, ins: false, na: false},
        {id: 78, name: "Chase Lowder", vehicle: "22 - Bill's Red Z/28", cones: 5, timeRaw: 62.355, timestamp: moment($('#practice-date').val() + ' ' + "11:06:27 AM"), dnf: false, ins: false, na: false},
        {id: 79, name: "Edward Pancost", vehicle: "94 - White Corvette Z06", cones: "", timeRaw: 57.645, timestamp: moment($('#practice-date').val() + ' ' + "11:12:29 AM"), dnf: false, ins: false, na: false},
        {id: 80, name: "Cody Pae", vehicle: "86 - Black Camaro LT1", cones: "", timeRaw: 55.288, timestamp: moment($('#practice-date').val() + ' ' + "11:12:54 AM"), dnf: false, ins: false, na: false},
        {id: 81, name: "Safadyn Ramahi", vehicle: "20 - Red Regal GS", cones: "", timeRaw: 58.404, timestamp: moment($('#practice-date').val() + ' ' + "11:13:22 AM"), dnf: false, ins: false, na: false},
        {id: 82, name: "Kevin Killian", vehicle: "23 - Red CTS V-Sport", cones: "", timeRaw: 73.496, timestamp: moment($('#practice-date').val() + ' ' + "11:14:34 AM"), dnf: false, ins: false, na: false},
        {id: 83, name: "Christopher Heinzen", vehicle: "22 - Bill's Red Z/28", cones: "", timeRaw: 57.019, timestamp: moment($('#practice-date').val() + ' ' + "11:14:49 AM"), dnf: false, ins: false, na: false},
        {id: 84, name: "Wesley Haney", vehicle: "94 - White Corvette Z06", cones: 2, timeRaw: 54.529, timestamp: moment($('#practice-date').val() + ' ' + "11:15:16 AM"), dnf: false, ins: false, na: false},
        {id: 85, name: "Cody Pae", vehicle: "86 - Black Camaro LT1", cones: 1, timeRaw: 55.177, timestamp: moment($('#practice-date').val() + ' ' + "11:17:17 AM"), dnf: false, ins: false, na: false},
        {id: 86, name: "Safadyn Ramahi", vehicle: "20 - Red Regal GS", cones: "", timeRaw: 68.874, timestamp: moment($('#practice-date').val() + ' ' + "11:18:03 AM"), dnf: false, ins: false, na: false},
        {id: 87, name: "Kevin Killian", vehicle: "23 - Red CTS V-Sport", cones: "", timeRaw: 115.695, timestamp: moment($('#practice-date').val() + ' ' + "11:19:30 AM"), dnf: false, ins: false, na: false},
        {id: 88, name: "Louis Cohen", vehicle: "99 - Red Turbo 1LE", cones: "", timeRaw: 93.851, timestamp: moment($('#practice-date').val() + ' ' + "11:19:37 AM"), dnf: false, ins: false, na: false},
        {id: 89, name: "Edward Pancost", vehicle: "94 - White Corvette Z06", cones: 2, timeRaw: 57.193, timestamp: moment($('#practice-date').val() + ' ' + "11:20:39 AM"), dnf: false, ins: false, na: false},
        {id: 90, name: "Stephen Hayes", vehicle: "22 - Bill's Red Z/28", cones: "", timeRaw: 63.536, timestamp: moment($('#practice-date').val() + ' ' + "11:22:07 AM"), dnf: false, ins: false, na: false},
        {id: 91, name: "Cody Pae", vehicle: "86 - Black Camaro LT1", cones: "", timeRaw: 55.653, timestamp: moment($('#practice-date').val() + ' ' + "11:22:27 AM"), dnf: false, ins: false, na: false},
        {id: 92, name: "Louis Cohen", vehicle: "99 - Red Turbo 1LE", cones: "", timeRaw: 56.124, timestamp: moment($('#practice-date').val() + ' ' + "11:22:59 AM"), dnf: false, ins: false, na: false},
        {id: 93, name: "Safadyn Ramahi", vehicle: "20 - Red Regal GS", cones: 1, timeRaw: 62.162, timestamp: moment($('#practice-date').val() + ' ' + "11:23:29 AM"), dnf: false, ins: false, na: false},
        {id: 94, name: "Kevin Killian", vehicle: "23 - Red CTS V-Sport", cones: 1, timeRaw: 72.082, timestamp: moment($('#practice-date').val() + ' ' + "11:24:47 AM"), dnf: false, ins: false, na: false},
        {id: 95, name: "Cody Pae", vehicle: "86 - Black Camaro LT1", cones: 1, timeRaw: 55.376, timestamp: moment($('#practice-date').val() + ' ' + "11:25:44 AM"), dnf: false, ins: false, na: false},
        {id: 96, name: "Wesley Haney", vehicle: "94 - White Corvette Z06", cones: 1, timeRaw: 73.744, timestamp: moment($('#practice-date').val() + ' ' + "11:26:34 AM"), dnf: false, ins: false, na: false},
        {id: 97, name: "Safadyn Ramahi", vehicle: "20 - Red Regal GS", cones: "", timeRaw: 62.977, timestamp: moment($('#practice-date').val() + ' ' + "11:27:37 AM"), dnf: true, ins: false, na: false},
        {id: 98, name: "Stephen Hayes", vehicle: "22 - Bill's Red Z/28", cones: "", timeRaw: 59.031, timestamp: moment($('#practice-date').val() + ' ' + "11:30:02 AM"), dnf: false, ins: false, na: false},
        {id: 99, name: "Louis Cohen", vehicle: "99 - Red Turbo 1LE", cones: "", timeRaw: 55.798, timestamp: moment($('#practice-date').val() + ' ' + "11:30:32 AM"), dnf: false, ins: false, na: false},
        {id: 100, name: "William Bennett", vehicle: "98 - Red Camaro SS 1LE", cones: 1, timeRaw: 60.018, timestamp: moment($('#practice-date').val() + ' ' + "11:31:03 AM"), dnf: false, ins: false, na: false},
        {id: 101, name: "Kevin Killian", vehicle: "23 - Red CTS V-Sport", cones: 2, timeRaw: 72.986, timestamp: moment($('#practice-date').val() + ' ' + "11:31:42 AM"), dnf: false, ins: false, na: false},
        {id: 102, name: "Edward Pancost", vehicle: "94 - White Corvette Z06", cones: 1, timeRaw: 59.151, timestamp: moment($('#practice-date').val() + ' ' + "11:34:45 AM"), dnf: false, ins: false, na: false},
        {id: 103, name: "Ethan Winberg", vehicle: "86 - Black Camaro LT1", cones: 2, timeRaw: 57.166, timestamp: moment($('#practice-date').val() + ' ' + "11:36:03 AM"), dnf: false, ins: false, na: false},
        {id: 104, name: "Stephen Hayes", vehicle: "22 - Bill's Red Z/28", cones: 2, timeRaw: 59.092, timestamp: moment($('#practice-date').val() + ' ' + "11:36:31 AM"), dnf: false, ins: false, na: false},
        {id: 105, name: "Louis Cohen", vehicle: "99 - Red Turbo 1LE", cones: "", timeRaw: 54.908, timestamp: moment($('#practice-date').val() + ' ' + "11:38:25 AM"), dnf: true, ins: false, na: false},
        {id: 106, name: "Manuel Sanchez", vehicle: "19 - Blue ATS-2.0T", cones: 1, timeRaw: 63.748, timestamp: moment($('#practice-date').val() + ' ' + "11:39:21 AM"), dnf: false, ins: false, na: false},
        {id: 107, name: "Kamran Ahmed", vehicle: "98 - Red Camaro SS 1LE", cones: 2, timeRaw: 60.133, timestamp: moment($('#practice-date').val() + ' ' + "11:41:41 AM"), dnf: false, ins: false, na: false},
        {id: 108, name: "Edward Pancost", vehicle: "94 - White Corvette Z06", cones: 2, timeRaw: 56.515, timestamp: moment($('#practice-date').val() + ' ' + "11:44:01 AM"), dnf: false, ins: false, na: false},
        {id: 109, name: "Ethan Winberg", vehicle: "86 - Black Camaro LT1", cones: "", timeRaw: 56.211, timestamp: moment($('#practice-date').val() + ' ' + "11:44:17 AM"), dnf: false, ins: false, na: false},
        {id: 110, name: "Manuel Sanchez", vehicle: "19 - Blue ATS-2.0T", cones: 3, timeRaw: 71.514, timestamp: moment($('#practice-date').val() + ' ' + "11:46:37 AM"), dnf: false, ins: false, na: false},
        {id: 111, name: "Wesley Haney", vehicle: "99 - Red Turbo 1LE", cones: "", timeRaw: 55.224, timestamp: moment($('#practice-date').val() + ' ' + "11:48:26 AM"), dnf: false, ins: false, na: false},
        {id: 112, name: "Dylan Studden", vehicle: "98 - Red Camaro SS 1LE", cones: "", timeRaw: 66.963, timestamp: moment($('#practice-date').val() + ' ' + "11:49:18 AM"), dnf: true, ins: false, na: false},
        {id: 113, name: "Stephen Hayes", vehicle: "23 - Red CTS V-Sport", cones: 3, timeRaw: 62.051, timestamp: moment($('#practice-date').val() + ' ' + "11:49:34 AM"), dnf: false, ins: false, na: false},
        {id: 114, name: "Ethan Winberg", vehicle: "86 - Black Camaro LT1", cones: 1, timeRaw: 57.81, timestamp: moment($('#practice-date').val() + ' ' + "11:51:21 AM"), dnf: false, ins: false, na: false},
        {id: 115, name: "Devon Hall", vehicle: "94 - White Corvette Z06", cones: "", timeRaw: 56.631, timestamp: moment($('#practice-date').val() + ' ' + "11:52:08 AM"), dnf: false, ins: false, na: false},
        {id: 116, name: "Manuel Sanchez", vehicle: "19 - Blue ATS-2.0T", cones: 1, timeRaw: 62.8, timestamp: moment($('#practice-date').val() + ' ' + "11:52:45 AM"), dnf: false, ins: false, na: false},
        {id: 117, name: "Wesley Haney", vehicle: "99 - Red Turbo 1LE", cones: 1, timeRaw: 55.873, timestamp: moment($('#practice-date').val() + ' ' + "11:54:08 AM"), dnf: false, ins: false, na: false},
        {id: 118, name: "William Bennett", vehicle: "98 - Red Camaro SS 1LE", cones: "", timeRaw: 57.96, timestamp: moment($('#practice-date').val() + ' ' + "11:56:49 AM"), dnf: true, ins: false, na: false},
        {id: 119, name: "Manuel Sanchez", vehicle: "19 - Blue ATS-2.0T", cones: 1, timeRaw: 63.012, timestamp: moment($('#practice-date').val() + ' ' + "11:57:22 AM"), dnf: false, ins: false, na: false},
        {id: 120, name: "Ethan Winberg", vehicle: "86 - Black Camaro LT1", cones: 1, timeRaw: 58.081, timestamp: moment($('#practice-date').val() + ' ' + "11:59:25 AM"), dnf: false, ins: false, na: false},
        {id: 121, name: "Devon Hall", vehicle: "94 - White Corvette Z06", cones: 2, timeRaw: 56.92, timestamp: moment($('#practice-date').val() + ' ' + "12:00:56 PM"), dnf: false, ins: false, na: false},
        {id: 122, name: "Varun Patel", vehicle: "99 - Red Turbo 1LE", cones: 1, timeRaw: 60.45, timestamp: moment($('#practice-date').val() + ' ' + "12:02:10 PM"), dnf: false, ins: false, na: false},
        {id: 123, name: "Kamran Ahmed", vehicle: "98 - Red Camaro SS 1LE", cones: 2, timeRaw: 57.412, timestamp: moment($('#practice-date').val() + ' ' + "12:04:08 PM"), dnf: false, ins: false, na: false},
        {id: 124, name: "Paul Townsend", vehicle: "86 - Black Camaro LT1", cones: 1, timeRaw: 54.303, timestamp: moment($('#practice-date').val() + ' ' + "12:06:17 PM"), dnf: false, ins: false, na: false},
        {id: 125, name: "Varun Patel", vehicle: "99 - Red Turbo 1LE", cones: 1, timeRaw: 58.012, timestamp: moment($('#practice-date').val() + ' ' + "12:08:06 PM"), dnf: false, ins: false, na: false},
        {id: 126, name: "Julie Starr", vehicle: "94 - White Corvette Z06", cones: "", timeRaw: 60.274, timestamp: moment($('#practice-date').val() + ' ' + "12:09:40 PM"), dnf: false, ins: false, na: false},
        {id: 127, name: "Kamran Ahmed", vehicle: "98 - Red Camaro SS 1LE", cones: 3, timeRaw: 58.7, timestamp: moment($('#practice-date').val() + ' ' + "12:10:08 PM"), dnf: false, ins: false, na: false},
        {id: 128, name: "Dylan Studden", vehicle: "19 - Blue ATS-2.0T", cones: 1, timeRaw: 68.613, timestamp: moment($('#practice-date').val() + ' ' + "12:13:16 PM"), dnf: false, ins: false, na: false},
        {id: 129, name: "Karl Riggs", vehicle: "86 - Black Camaro LT1", cones: 1, timeRaw: 55.132, timestamp: moment($('#practice-date').val() + ' ' + "12:13:55 PM"), dnf: false, ins: false, na: false},
        {id: 130, name: "Varun Patel", vehicle: "99 - Red Turbo 1LE", cones: 1, timeRaw: 56.881, timestamp: moment($('#practice-date').val() + ' ' + "12:16:00 PM"), dnf: false, ins: false, na: false},
        {id: 131, name: "Julie Starr", vehicle: "94 - White Corvette Z06", cones: "", timeRaw: 60.433, timestamp: moment($('#practice-date').val() + ' ' + "12:17:17 PM"), dnf: true, ins: false, na: false},
        {id: 132, name: "Tyler Chantrenne", vehicle: "98 - Red Camaro SS 1LE", cones: "", timeRaw: 57.012, timestamp: moment($('#practice-date').val() + ' ' + "12:17:44 PM"), dnf: false, ins: false, na: false},
        {id: 133, name: "Dylan Studden", vehicle: "19 - Blue ATS-2.0T", cones: 1, timeRaw: 68.17, timestamp: moment($('#practice-date').val() + ' ' + "12:21:33 PM"), dnf: false, ins: false, na: false},
        {id: 134, name: "Karl Riggs", vehicle: "86 - Black Camaro LT1", cones: 5, timeRaw: 61.722, timestamp: moment($('#practice-date').val() + ' ' + "12:22:09 PM"), dnf: false, ins: false, na: false},
        {id: 135, name: "Varun Patel", vehicle: "99 - Red Turbo 1LE", cones: "", timeRaw: 56.74, timestamp: moment($('#practice-date').val() + ' ' + "12:23:53 PM"), dnf: false, ins: false, na: false},
        {id: 136, name: "Christopher Heinzen", vehicle: "98 - Red Camaro SS 1LE", cones: 2, timeRaw: 58.206, timestamp: moment($('#practice-date').val() + ' ' + "12:24:38 PM"), dnf: false, ins: false, na: false},
        {id: 137, name: "Julie Starr", vehicle: "94 - White Corvette Z06", cones: 1, timeRaw: 58.528, timestamp: moment($('#practice-date').val() + ' ' + "12:26:18 PM"), dnf: false, ins: false, na: false},
        {id: 138, name: "Dylan Studden", vehicle: "19 - Blue ATS-2.0T", cones: "", timeRaw: 70.258, timestamp: moment($('#practice-date').val() + ' ' + "12:27:03 PM"), dnf: true, ins: false, na: false},
        {id: 139, name: "Karl Riggs", vehicle: "86 - Black Camaro LT1", cones: "", timeRaw: 56.861, timestamp: moment($('#practice-date').val() + ' ' + "12:28:38 PM"), dnf: true, ins: false, na: false},
        {id: 140, name: "Tyler Chantrenne", vehicle: "98 - Red Camaro SS 1LE", cones: "", timeRaw: 57.278, timestamp: moment($('#practice-date').val() + ' ' + "12:30:13 PM"), dnf: true, ins: false, na: false},
        {id: 141, name: "Joshua Rios", vehicle: "99 - Red Turbo 1LE", cones: 2, timeRaw: 57.845, timestamp: moment($('#practice-date').val() + ' ' + "12:31:36 PM"), dnf: false, ins: false, na: false},
        {id: 142, name: "Devon Hall", vehicle: "94 - White Corvette Z06", cones: 1, timeRaw: 55.639, timestamp: moment($('#practice-date').val() + ' ' + "12:33:29 PM"), dnf: false, ins: false, na: false},
        {id: 143, name: "Karl Riggs", vehicle: "86 - Black Camaro LT1", cones: "", timeRaw: 56.61, timestamp: moment($('#practice-date').val() + ' ' + "12:34:09 PM"), dnf: false, ins: false, na: false},
        {id: 144, name: "William Bennett", vehicle: "98 - Red Camaro SS 1LE", cones: 3, timeRaw: 57.721, timestamp: moment($('#practice-date').val() + ' ' + "12:35:44 PM"), dnf: false, ins: false, na: false},
        {id: 145, name: "Joshua Rios", vehicle: "99 - Red Turbo 1LE", cones: "", timeRaw: 58.776, timestamp: moment($('#practice-date').val() + ' ' + "12:38:30 PM"), dnf: false, ins: false, na: false},
        {id: 146, name: "Devon Hall", vehicle: "94 - White Corvette Z06", cones: "", timeRaw: 56.269, timestamp: moment($('#practice-date').val() + ' ' + "12:39:01 PM"), dnf: false, ins: false, na: false},
        {id: 147, name: "Christopher Heinzen", vehicle: "98 - Red Camaro SS 1LE", cones: "", timeRaw: 59.625, timestamp: moment($('#practice-date').val() + ' ' + "12:39:34 PM"), dnf: true, ins: false, na: false},
        {id: 148, name: "Joshua Rios", vehicle: "99 - Red Turbo 1LE", cones: 1, timeRaw: 56.169, timestamp: moment($('#practice-date').val() + ' ' + "12:41:38 PM"), dnf: false, ins: false, na: false},
        {id: 149, name: "William Bennett", vehicle: "86 - Black Camaro LT1", cones: 3, timeRaw: 61.531, timestamp: moment($('#practice-date').val() + ' ' + "12:42:36 PM"), dnf: false, ins: false, na: false},
        {id: 150, name: "Joshua Rios", vehicle: "99 - Red Turbo 1LE", cones: "", timeRaw: 58.868, timestamp: moment($('#practice-date').val() + ' ' + "12:44:32 PM"), dnf: true, ins: false, na: false},
        {id: 151, name: "Julie Starr", vehicle: "94 - White Corvette Z06", cones: 2, timeRaw: 59.419, timestamp: moment($('#practice-date').val() + ' ' + "12:45:46 PM"), dnf: false, ins: false, na: false},
        {id: 152, name: "Tyler Chantrenne", vehicle: "98 - Red Camaro SS 1LE", cones: 1, timeRaw: 56.461, timestamp: moment($('#practice-date').val() + ' ' + "12:47:07 PM"), dnf: false, ins: false, na: false},
        {id: 153, name: "Kamran Ahmed", vehicle: "86 - Black Camaro LT1", cones: "", timeRaw: 71.93, timestamp: moment($('#practice-date').val() + ' ' + "12:47:52 PM"), dnf: true, ins: false, na: false},
        {id: 154, name: "Julie Starr", vehicle: "94 - White Corvette Z06", cones: "", timeRaw: 57.914, timestamp: moment($('#practice-date').val() + ' ' + "12:50:43 PM"), dnf: false, ins: false, na: false},
        {id: 155, name: "Christopher Heinzen", vehicle: "98 - Red Camaro SS 1LE", cones: "", timeRaw: 56.568, timestamp: moment($('#practice-date').val() + ' ' + "12:51:13 PM"), dnf: false, ins: false, na: false},
        {id: 156, name: "Tyler Chantrenne", vehicle: "98 - Red Camaro SS 1LE", cones: "", timeRaw: 56.207, timestamp: moment($('#practice-date').val() + ' ' + "12:54:55 PM"), dnf: false, ins: false, na: false},
        {id: 157, name: "Jason Blair", vehicle: "99 - Red Turbo 1LE", cones: "", timeRaw: 56.831, timestamp: moment($('#practice-date').val() + ' ' + "1:05:05 PM"), dnf: false, ins: false, na: false},
        {id: 158, name: "Henry Chen", vehicle: "86 - Black Camaro LT1", cones: 1, timeRaw: 60.712, timestamp: moment($('#practice-date').val() + ' ' + "1:05:38 PM"), dnf: false, ins: false, na: false},
        {id: 159, name: "Christopher Biddle", vehicle: "94 - White Corvette Z06", cones: "", timeRaw: 59.185, timestamp: moment($('#practice-date').val() + ' ' + "1:07:03 PM"), dnf: false, ins: false, na: false},
        {id: 160, name: "Joshua Stroup", vehicle: "19 - Blue ATS-2.0T", cones: "", timeRaw: 68.917, timestamp: moment($('#practice-date').val() + ' ' + "1:07:43 PM"), dnf: false, ins: false, na: false},
        {id: 161, name: "Lawson Sumner", vehicle: "20 - Red Regal GS", cones: "", timeRaw: 60.811, timestamp: moment($('#practice-date').val() + ' ' + "1:08:23 PM"), dnf: false, ins: false, na: false},
        {id: 162, name: "Demitry Belski", vehicle: "98 - Red Camaro SS 1LE", cones: "", timeRaw: 79.349, timestamp: moment($('#practice-date').val() + ' ' + "1:09:12 PM"), dnf: true, ins: false, na: false},
        {id: 163, name: "Stephen Ioas", vehicle: "23 - Red CTS V-Sport", cones: "", timeRaw: 69.325, timestamp: moment($('#practice-date').val() + ' ' + "1:10:51 PM"), dnf: false, ins: false, na: false},
        {id: 164, name: "Henry Chen", vehicle: "86 - Black Camaro LT1", cones: 2, timeRaw: 58.829, timestamp: moment($('#practice-date').val() + ' ' + "1:11:18 PM"), dnf: false, ins: false, na: false},
        {id: 165, name: "Paul Townsend", vehicle: "99 - Red Turbo 1LE", cones: 2, timeRaw: 53.633, timestamp: moment($('#practice-date').val() + ' ' + "1:12:42 PM"), dnf: false, ins: false, na: false},
        {id: 166, name: "Joshua Stroup", vehicle: "19 - Blue ATS-2.0T", cones: 1, timeRaw: 66.027, timestamp: moment($('#practice-date').val() + ' ' + "1:13:24 PM"), dnf: false, ins: false, na: false},
        {id: 167, name: "Christopher Biddle", vehicle: "94 - White Corvette Z06", cones: "", timeRaw: 55.814, timestamp: moment($('#practice-date').val() + ' ' + "1:15:47 PM"), dnf: false, ins: false, na: false},
        {id: 168, name: "Forrest Berg", vehicle: "98 - Red Camaro SS 1LE", cones: "", timeRaw: 58.985, timestamp: moment($('#practice-date').val() + ' ' + "1:16:22 PM"), dnf: false, ins: false, na: false},
        {id: 169, name: "Amaarah Johnson", vehicle: "20 - Red Regal GS", cones: "", timeRaw: 72.655, timestamp: moment($('#practice-date').val() + ' ' + "1:17:09 PM"), dnf: true, ins: false, na: false},
        {id: 170, name: "Stephen Ioas", vehicle: "23 - Red CTS V-Sport", cones: "", timeRaw: 74.744, timestamp: moment($('#practice-date').val() + ' ' + "1:19:08 PM"), dnf: true, ins: false, na: false},
        {id: 171, name: "Karl Riggs", vehicle: "19 - Blue ATS-2.0T", cones: "", timeRaw: 62.674, timestamp: moment($('#practice-date').val() + ' ' + "1:19:30 PM"), dnf: false, ins: true, na: false},
        {id: 172, name: "Henry Chen", vehicle: "86 - Black Camaro LT1", cones: 2, timeRaw: 59.482, timestamp: moment($('#practice-date').val() + ' ' + "1:20:23 PM"), dnf: false, ins: false, na: false},
        {id: 173, name: "Paul Townsend", vehicle: "99 - Red Turbo 1LE", cones: "", timeRaw: 53.383, timestamp: moment($('#practice-date').val() + ' ' + "1:22:06 PM"), dnf: false, ins: false, na: false},
        {id: 174, name: "Forrest Berg", vehicle: "98 - Red Camaro SS 1LE", cones: "", timeRaw: 57.682, timestamp: moment($('#practice-date').val() + ' ' + "1:22:36 PM"), dnf: false, ins: false, na: false},
        {id: 175, name: "Daniel Mozel", vehicle: "94 - White Corvette Z06", cones: "", timeRaw: 71.361, timestamp: moment($('#practice-date').val() + ' ' + "1:24:03 PM"), dnf: true, ins: false, na: false},
        {id: 176, name: "Amaarah Johnson", vehicle: "20 - Red Regal GS", cones: 3, timeRaw: 72.937, timestamp: moment($('#practice-date').val() + ' ' + "1:24:42 PM"), dnf: false, ins: false, na: false},
        {id: 177, name: "Joshua Stroup", vehicle: "19 - Blue ATS-2.0T", cones: "", timeRaw: 65.141, timestamp: moment($('#practice-date').val() + ' ' + "1:27:04 PM"), dnf: true, ins: false, na: false},
        {id: 178, name: "Henry Chen", vehicle: "86 - Black Camaro LT1", cones: 4, timeRaw: 57.205, timestamp: moment($('#practice-date').val() + ' ' + "1:28:55 PM"), dnf: false, ins: false, na: false},
        {id: 179, name: "Jason Blair", vehicle: "99 - Red Turbo 1LE", cones: 1, timeRaw: 55.761, timestamp: moment($('#practice-date').val() + ' ' + "1:30:52 PM"), dnf: false, ins: false, na: false},
        {id: 180, name: "Michael Nakhla", vehicle: "23 - Red CTS V-Sport", cones: 1, timeRaw: 68.35, timestamp: moment($('#practice-date').val() + ' ' + "1:31:35 PM"), dnf: false, ins: false, na: false},
        {id: 181, name: "Demitry Belski", vehicle: "98 - Red Camaro SS 1LE", cones: "", timeRaw: 69.118, timestamp: moment($('#practice-date').val() + ' ' + "1:33:37 PM"), dnf: true, ins: false, na: false},
        {id: 182, name: "Daniel Mozel", vehicle: "94 - White Corvette Z06", cones: 1, timeRaw: 62.512, timestamp: moment($('#practice-date').val() + ' ' + "1:34:05 PM"), dnf: false, ins: false, na: false},
        {id: 183, name: "Paul Townsend", vehicle: "91 - Red Corvette GS", cones: 1, timeRaw: 53.017, timestamp: moment($('#practice-date').val() + ' ' + "1:35:46 PM"), dnf: false, ins: false, na: false},
        {id: 184, name: "Amaarah Johnson", vehicle: "20 - Red Regal GS", cones: 3, timeRaw: 73.91, timestamp: moment($('#practice-date').val() + ' ' + "1:37:44 PM"), dnf: false, ins: false, na: false},
        {id: 185, name: "Stephen Dissler Jr", vehicle: "86 - Black Camaro LT1", cones: "", timeRaw: 80.731, timestamp: moment($('#practice-date').val() + ' ' + "1:39:46 PM"), dnf: true, ins: false, na: false},
        {id: 186, name: "Joshua Stroup", vehicle: "19 - Blue ATS-2.0T", cones: "", timeRaw: 64.65, timestamp: moment($('#practice-date').val() + ' ' + "1:40:11 PM"), dnf: false, ins: false, na: false},
        {id: 187, name: "Leslie Urff", vehicle: "99 - Red Turbo 1LE", cones: "", timeRaw: 56.947, timestamp: moment($('#practice-date').val() + ' ' + "1:40:41 PM"), dnf: true, ins: false, na: false},
        {id: 188, name: "Demitry Belski", vehicle: "98 - Red Camaro SS 1LE", cones: 1, timeRaw: 66.741, timestamp: moment($('#practice-date').val() + ' ' + "1:42:32 PM"), dnf: false, ins: false, na: false},
        {id: 189, name: "Christopher Biddle", vehicle: "94 - White Corvette Z06", cones: "", timeRaw: 68.052, timestamp: moment($('#practice-date').val() + ' ' + "1:43:11 PM"), dnf: true, ins: false, na: false},
        {id: 190, name: "Alexandra Honey", vehicle: "23 - Red CTS V-Sport", cones: 1, timeRaw: 79.43, timestamp: moment($('#practice-date').val() + ' ' + "1:45:50 PM"), dnf: false, ins: false, na: false},
        {id: 191, name: "Paul Townsend", vehicle: "91 - Red Corvette GS", cones: 1, timeRaw: 53.296, timestamp: moment($('#practice-date').val() + ' ' + "1:48:05 PM"), dnf: false, ins: false, na: false},
        {id: 192, name: "Amaarah Johnson", vehicle: "20 - Red Regal GS", cones: 1, timeRaw: 71.423, timestamp: moment($('#practice-date').val() + ' ' + "1:48:48 PM"), dnf: false, ins: false, na: false},
        {id: 193, name: "Bob Davies", vehicle: "19 - Blue ATS-2.0T", cones: "", timeRaw: 67.954, timestamp: moment($('#practice-date').val() + ' ' + "1:50:33 PM"), dnf: false, ins: false, na: false},
        {id: 194, name: "Leslie Urff", vehicle: "99 - Red Turbo 1LE", cones: "", timeRaw: 61.915, timestamp: moment($('#practice-date').val() + ' ' + "1:51:07 PM"), dnf: true, ins: false, na: false},
        {id: 195, name: "Demitry Belski", vehicle: "98 - Red Camaro SS 1LE", cones: 1, timeRaw: 63.45, timestamp: moment($('#practice-date').val() + ' ' + "1:53:22 PM"), dnf: false, ins: false, na: false},
        {id: 196, name: "Christopher Biddle", vehicle: "94 - White Corvette Z06", cones: "", timeRaw: 55.699, timestamp: moment($('#practice-date').val() + ' ' + "1:53:53 PM"), dnf: false, ins: false, na: false},
        {id: 197, name: "Alexandra Honey", vehicle: "23 - Red CTS V-Sport", cones: "", timeRaw: 70.405, timestamp: moment($('#practice-date').val() + ' ' + "1:55:55 PM"), dnf: false, ins: false, na: false},
        {id: 198, name: "Daniel Mozel", vehicle: "20 - Red Regal GS", cones: 1, timeRaw: 65.791, timestamp: moment($('#practice-date').val() + ' ' + "1:56:25 PM"), dnf: false, ins: false, na: false},
        {id: 199, name: "Leslie Urff", vehicle: "99 - Red Turbo 1LE", cones: "", timeRaw: 56.33, timestamp: moment($('#practice-date').val() + ' ' + "1:58:05 PM"), dnf: true, ins: false, na: false},
        {id: 200, name: "Eddie Franklin Jr", vehicle: "91 - Red Corvette GS", cones: 1, timeRaw: 56.307, timestamp: moment($('#practice-date').val() + ' ' + "2:00:02 PM"), dnf: false, ins: false, na: false},
        {id: 201, name: "Wesley Haney", vehicle: "19 - Blue ATS-2.0T", cones: "", timeRaw: 63.979, timestamp: moment($('#practice-date').val() + ' ' + "2:02:14 PM"), dnf: false, ins: true, na: false},
        {id: 202, name: "Jon D Stanley", vehicle: "94 - White Corvette Z06", cones: 1, timeRaw: 71.642, timestamp: moment($('#practice-date').val() + ' ' + "2:02:53 PM"), dnf: false, ins: false, na: false},
        {id: 203, name: "Forrest Berg", vehicle: "98 - Red Camaro SS 1LE", cones: 1, timeRaw: 59.722, timestamp: moment($('#practice-date').val() + ' ' + "2:03:10 PM"), dnf: false, ins: false, na: false},
        {id: 204, name: "Daniel Mozel", vehicle: "20 - Red Regal GS", cones: "", timeRaw: 65.334, timestamp: moment($('#practice-date').val() + ' ' + "2:05:40 PM"), dnf: false, ins: false, na: false},
        {id: 205, name: "Leslie Urff", vehicle: "99 - Red Turbo 1LE", cones: 3, timeRaw: 56.34, timestamp: moment($('#practice-date').val() + ' ' + "2:06:17 PM"), dnf: false, ins: false, na: false},
        {id: 206, name: "Eddie Franklin Jr", vehicle: "91 - Red Corvette GS", cones: 2, timeRaw: 57.176, timestamp: moment($('#practice-date').val() + ' ' + "2:08:08 PM"), dnf: false, ins: false, na: false},
        {id: 207, name: "Michael Nakhla", vehicle: "19 - Blue ATS-2.0T", cones: 1, timeRaw: 70.544, timestamp: moment($('#practice-date').val() + ' ' + "2:09:39 PM"), dnf: false, ins: false, na: false},
        {id: 208, name: "Forrest Berg", vehicle: "98 - Red Camaro SS 1LE", cones: "", timeRaw: 57.917, timestamp: moment($('#practice-date').val() + ' ' + "2:10:03 PM"), dnf: false, ins: false, na: false},
        {id: 209, name: "Jon D Stanley", vehicle: "94 - White Corvette Z06", cones: "", timeRaw: 63.686, timestamp: moment($('#practice-date').val() + ' ' + "2:11:45 PM"), dnf: false, ins: false, na: false},
        {id: 210, name: "Jason Blair", vehicle: "99 - Red Turbo 1LE", cones: "", timeRaw: 54.815, timestamp: moment($('#practice-date').val() + ' ' + "2:12:05 PM"), dnf: false, ins: false, na: false},
        {id: 211, name: "Eddie Franklin Jr", vehicle: "91 - Red Corvette GS", cones: 4, timeRaw: 56.428, timestamp: moment($('#practice-date').val() + ' ' + "2:12:38 PM"), dnf: false, ins: false, na: false},
        {id: 212, name: "Michael Nakhla", vehicle: "19 - Blue ATS-2.0T", cones: "", timeRaw: 68.073, timestamp: moment($('#practice-date').val() + ' ' + "2:14:38 PM"), dnf: false, ins: false, na: false},
        {id: 213, name: "Jon D Stanley", vehicle: "94 - White Corvette Z06", cones: "", timeRaw: 60.788, timestamp: moment($('#practice-date').val() + ' ' + "2:15:06 PM"), dnf: false, ins: false, na: false},
        {id: 214, name: "Jason Blair", vehicle: "99 - Red Turbo 1LE", cones: "", timeRaw: 62.537, timestamp: moment($('#practice-date').val() + ' ' + "2:15:40 PM"), dnf: true, ins: false, na: false},
        {id: 215, name: "Eddie Franklin Jr", vehicle: "91 - Red Corvette GS", cones: "", timeRaw: 57.303, timestamp: moment($('#practice-date').val() + ' ' + "2:17:05 PM"), dnf: false, ins: false, na: false},
        {id: 216, name: "Michael Nakhla", vehicle: "19 - Blue ATS-2.0T", cones: "", timeRaw: 68.489, timestamp: moment($('#practice-date').val() + ' ' + "2:18:21 PM"), dnf: false, ins: false, na: false},
        {id: 217, name: "Jon D Stanley", vehicle: "94 - White Corvette Z06", cones: 3, timeRaw: 76.076, timestamp: moment($('#practice-date').val() + ' ' + "2:19:13 PM"), dnf: false, ins: false, na: false},
        {id: 218, name: "Bob Davies", vehicle: "99 - Red Turbo 1LE", cones: "", timeRaw: 61.359, timestamp: moment($('#practice-date').val() + ' ' + "2:19:37 PM"), dnf: false, ins: false, na: false},
        {id: 219, name: "Wesley Haney", vehicle: "19 - Blue ATS-2.0T", cones: "", timeRaw: 61.775, timestamp: moment($('#practice-date').val() + ' ' + "2:21:17 PM"), dnf: false, ins: true, na: false},
        {id: 220, name: "Kevin Albert", vehicle: "91 - Red Corvette GS", cones: "", timeRaw: 55.944, timestamp: moment($('#practice-date').val() + ' ' + "2:22:04 PM"), dnf: false, ins: false, na: false},
        {id: 221, name: "Bob Davies", vehicle: "99 - Red Turbo 1LE", cones: 1, timeRaw: 76.361, timestamp: moment($('#practice-date').val() + ' ' + "2:23:18 PM"), dnf: false, ins: false, na: false},
        {id: 222, name: "Stephen Ioas", vehicle: "19 - Blue ATS-2.0T", cones: "", timeRaw: 64.808, timestamp: moment($('#practice-date').val() + ' ' + "2:24:28 PM"), dnf: false, ins: false, na: false},
        {id: 223, name: "David Hoch", vehicle: "94 - White Corvette Z06", cones: 2, timeRaw: 57.062, timestamp: moment($('#practice-date').val() + ' ' + "2:25:00 PM"), dnf: false, ins: false, na: false},
        {id: 224, name: "Kevin Albert", vehicle: "91 - Red Corvette GS", cones: "", timeRaw: 56.238, timestamp: moment($('#practice-date').val() + ' ' + "2:26:40 PM"), dnf: true, ins: false, na: false},
        {id: 225, name: "Bob Davies", vehicle: "99 - Red Turbo 1LE", cones: 1, timeRaw: 59.788, timestamp: moment($('#practice-date').val() + ' ' + "2:28:17 PM"), dnf: false, ins: false, na: false},
        {id: 226, name: "Stephen Ioas", vehicle: "19 - Blue ATS-2.0T", cones: "", timeRaw: 64.599, timestamp: moment($('#practice-date').val() + ' ' + "2:29:35 PM"), dnf: true, ins: false, na: false},
        {id: 227, name: "David Hoch", vehicle: "94 - White Corvette Z06", cones: 2, timeRaw: 54.357, timestamp: moment($('#practice-date').val() + ' ' + "2:30:38 PM"), dnf: false, ins: false, na: false},
        {id: 228, name: "Kevin Albert", vehicle: "91 - Red Corvette GS", cones: 4, timeRaw: 54.691, timestamp: moment($('#practice-date').val() + ' ' + "2:32:04 PM"), dnf: false, ins: false, na: false},
        {id: 229, name: "David Hoch", vehicle: "94 - White Corvette Z06", cones: 1, timeRaw: 54.984, timestamp: moment($('#practice-date').val() + ' ' + "2:33:40 PM"), dnf: false, ins: false, na: false},
        {id: 230, name: "Kevin Albert", vehicle: "91 - Red Corvette GS", cones: 2, timeRaw: 55.574, timestamp: moment($('#practice-date').val() + ' ' + "2:34:35 PM"), dnf: false, ins: false, na: false},
        {id: 231, name: "David Hoch", vehicle: "94 - White Corvette Z06", cones: 1, timeRaw: 54.764, timestamp: moment($('#practice-date').val() + ' ' + "2:35:27 PM"), dnf: false, ins: false, na: false},
        {id: 232, name: "Alexandra Honey", vehicle: "91 - Red Corvette GS", cones: 2, timeRaw: 58.134, timestamp: moment($('#practice-date').val() + ' ' + "2:37:50 PM"), dnf: false, ins: false, na: false},
        {id: 233, name: "Stephen Dissler Jr", vehicle: "94 - White Corvette Z06", cones: "", timeRaw: 70.11, timestamp: moment($('#practice-date').val() + ' ' + "2:40:10 PM"), dnf: false, ins: false, na: false},
        {id: 234, name: "Alexandra Honey", vehicle: "91 - Red Corvette GS", cones: 2, timeRaw: 59.473, timestamp: moment($('#practice-date').val() + ' ' + "2:40:31 PM"), dnf: false, ins: false, na: false},
        {id: 235, name: "Stephen Dissler Jr", vehicle: "91 - Red Corvette GS", cones: "", timeRaw: 66.072, timestamp: moment($('#practice-date').val() + ' ' + "2:44:25 PM"), dnf: false, ins: false, na: false},
        {id: 236, name: "Stephen Dissler Jr", vehicle: "91 - Red Corvette GS", cones: "", timeRaw: 64.324, timestamp: moment($('#practice-date').val() + ' ' + "2:46:01 PM"), dnf: false, ins: false, na: false},
    ];
}
