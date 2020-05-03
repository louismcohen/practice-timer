let driversList = [];
let vehiclesList = [];
let driversColumns = [];
let vehiclesColumns = [];
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

let placeholder = function(cell, formatterParams) {
    let cellValue = cell.getValue();
    if (cellValue === "") {
        return "Enter a vehicle";
    }
    else {
        return cellValue;
    }
}

let formatTimeRaw = function(cell, params) {
    return (cell.getData().na == true) ? "N/A" : cell.getValue();
}

let isEmptyOrUndefined = function(input) {
    return (input) ? false : true;
}

$(document).ready(function() {
    // chrome.serial.getDevices(onGetDevices);

    checkForTimingDevice();
    populateCOMPortDropdown();
    // populateDriverList();
	populateVehicleList();

    timesColumns = [
        {field: "deleteRun", align: "center", headerSort: false, resizable: false,
            formatter: function(cell) {
                return "<div class='delete-laptime' id='delete-" + cell.getData().id + "'><i class='fas fa-minus-circle'></i></div>";
            },
            cellMouseOver: function(event, cell) {
                $(cell.getElement()).find("[id^=delete]").show()
            },
            cellMouseLeave: function(event, cell) {
                if ($("#delete-run-modal").hasClass("ui-dialog-content")) {
                    if (!$("#delete-run-modal").dialog("isOpen")) {
                        $(cell.getElement()).find("[id^=delete]").hide();
                    }
                }
                else {
                    $(cell.getElement()).find("[id^=delete]").hide();
                }
                
            },
            cellClick: function(event, cell) {                
                let data = cell.getData();
                if ((data.name) || (data.vehicle) || (data.cones) || (data.timestamp)) {
                    confirmDeleteRun("Delete Run " + cell.getData().id, cell).then(function(modalResponse) {
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
        {title: "ID", field: "id", align: "center"},
        {title: "Name", field: "name", headerFilter: "input", headerFilterPlaceholder: "filter names", editor: "autocomplete", editorParams: {
            values: driversList.map(x => x.name),
            showListOnEmpty: true,
            freetext: false,    
            allowEmpty: true,
        }, 
            cellEdited: function(cell) {
                updateAllData();
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
            values: vehiclesList.filter(x => x.inUse == true).map(x => x.name),
            showListOnEmpty: true,
            freetext: false,
            allowEmpty: true,
        }, 
            cellEdited: function(cell) {

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

    driversColumns = [
        {title: "Name", field: "name", downloadTitle: "name", headerSort: true},
        {title: "Runs", field: "runs", downloadTitle: "runs", align: "center", headerSort: false,
            formatter: function(cell) {
                return cell.getValue() == 0 ? "" : cell.getValue(); 
            }
        },
        {title: "Heat", field: "heat", downloadTitle: "heat", align: "center", headerSort: true},
        {title: "FTD", field: "ftd", downloadTitle: "heat", 
            formatter: function(cell) {
                return (cell.getValue() == "") ? "" : Number(cell.getValue()).toFixed(3);
            }
        },
        {title: "Vehicle", field: "vehicle", downloadTitle: "vehicle"},
    ];

    vehiclesColumns = [
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
                timesTable.options.columns.filter(x => x.field == "vehicle").map(x => x.editorParams.values = vehiclesList.filter(x => x.inUse == true).map(x => x.name));
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

        document.getElementById("practice-date").valueAsDate = new Date();
        conePenalty = $("#cone-penalty")[0].valueAsNumber;

        maxNumberOfRuns = parseInt($("#number-of-runs").val());

        $(".times-pane").css("margin-top", $(".app-header").outerHeight());

        // $(".setup-pane").resizable({
        //     handles: "e",
        //     minWidth: 500,
        //     resizeHeight: false,
        // })

        createInitialTimesArray();
        // createSampleTimesArray();
        timesTable = new Tabulator("#times-table", {
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

    initializeDriverListTable();
    initializeVehicleListTable();
    updateAllData();

    $(".add-laptime").click(function() {
        addLapTime();
    })

    $("#setup-pane-button").click(function() {
    $(this).toggleClass("is-active");
        let setupPane = $(".setup-pane");
        // let splitter  = $(".splitter");
        let timesPane = $(".times-pane");
        let appHeader = $(".app-header");
        let appHeaderHeight = appHeader.outerHeight();

        const SETUP_PANE_WIDTH = 600;
        const SETUP_PANE_PADDING = 20;

        if ($(this).hasClass("is-active")) {
            setupPane.css("width", SETUP_PANE_WIDTH + "px");

            setupPane.css([
                "padding", appHeaderHeight + "px " + SETUP_PANE_PADDING + "px 0 " + SETUP_PANE_PADDING + "px",
                "width", SETUP_PANE_WIDTH + "px",
                ]);
            // splitter.css("margin-left", SETUP_PANE_WIDTH + 2*SETUP_PANE_PADDING + "px");
            timesPane.css("margin-left", SETUP_PANE_WIDTH + 2*SETUP_PANE_PADDING + "px");

            setupPane.toggle("slide", 300, function() {
                if (!driversTable) initializeDriverListTable();
                driversTable.setData(driversList);

                if (!vehiclesTable) initializeVehicleListTable();
                vehiclesTable.setData(vehiclesList);
            })
            
            // vehiclesTable.setFilter("inUse", "=", true);
    }
    else {
      // setupPane.css("width", "0");
      // setupPane.css("padding", "0");
      timesPane.css("margin-left", "0");

      setupPane.toggle("slide", 300);
    }
  })
    $("#import-vehicle-list").change(function(event) {
        let files = event.target.files;
        let f = files[0];
        let reader = new FileReader();

        reader.onload = function(event) {
            let data = new Uint8Array(event.target.result);
            let workbook = XLSX.read(data, {type: "array"});

            vehiclesList = XLSX.utils.sheet_to_json(workbook.Sheets.Vehicles);
            vehiclesList.sort((a, b) => (a.name < b.name) ? -1 : (a.name > b.name) ? 1 : 0); // short in numerical order
            vehiclesList.forEach(x => x.vehicleNumber = Number(x.name.slice(0, 2))); // add vehicle numbers
            vehiclesTable.setData(vehiclesList);

            updateAllData();
        }

        reader.readAsArrayBuffer(f);

        $(this).val("");
    });

    $("#edit-vehicles").click(function() {
        $("#import-vehicle-list").trigger("click");
    });

    $("#import-driver-list").change(function(event) {
        let files = event.target.files;
        let f = files[0];
        let reader = new FileReader();

        reader.onload = function(event) {
            let data = new Uint8Array(event.target.result);
            let workbook = XLSX.read(data, {type: "array"});

            driversList = XLSX.utils.sheet_to_json(workbook.Sheets.Drivers);
            driversList.sort((a, b) => (a.name < b.name) ? -1 : (a.name > b.name) ? 1 : 0);
            driversTable.setData(driversList);

            updateAllData();
        }

        reader.readAsArrayBuffer(f);

        $(this).val("");
    });
    
    $("#edit-drivers").click(function() {
        $("#import-driver-list").trigger("click");
    });

    $("#number-of-runs").change(function() {
        maxNumberOfRuns = parseInt($(this).val());
        updateAllData();
    });

	// $("input:checkbox[id^=vehicle-checkbox]").change(function() {
	// 	let vehicleNumberChecked = Number(this.id.split("vehicle-checkbox-")[1]);
	// 	vehiclesList.find(x => x.vehicleNumber == vehicleNumberChecked).inUse = this.checked;
 //        timesColumns.filter(x => x.field == "vehicle")[0].editorParams.values = vehiclesList.filter(x => x.inUse == true).map(x => x.name)

	// 	populateVehicleDropdowns();
	// })

    $("#cone-penalty").change(function() {
        conePenalty = this.valueAsNumber;
        updateAllData();
    })

    $(".setup-pane-header").click(function(event) {
        if (event.target.type !== "button" && event.target.type !== "file" && event.target.type !== "input") $(this).next(".setup-pane-content").slideToggle(200, function() {
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
    })

	$(".show-all-vehicles").change(function() {
		toggleVehicleDisplay();
		// if ($(this).find("input[type=checkbox]")[0].checked) {

		// }
		// else {

		// }
	})

    // $(".tabulator-cell[tabulator-field=dnf]").click(function() {
    //     if ($(this).attr("aria-checked") == "true") {

    //     }
    //     else {

    //     }
    // });

    // $(document).keydown(function(event) {
    //     let eventObject = window.event ? event : e;
    //     if (eventObject.ctrlKey && eventObject.keyCode == 90) {
    //         timesTable.undo();
    //     }
    //     else if (eventObject.ctrlKey && eventObject.keyCode == 89) {
    //         timesTable.redo();
    //     } 
    // })

	// $(".custom-combobox-input").change(function() {
	// 	this.value = $.trim(this.value);
	// })

	// $(".cones-input").keyup(function() {
	// 	// this.value = this.value.replace(/[^0-9\.]/g,'');
	// })

	// $(".cones-input").change(function() {
 //        let timeRaw = Number($(this).closest("tr").find("td[class^=time-raw]").text());
 //        let coneCount = this.value;

	// 	$(this).closest("tr").find("td[class^=time-adj]").text(calcTimeAdj(timeRaw, coneCount));
	// })

    // $(".na-input").change(function() {
    //     // timeRaw = $(this).closest("tr").find("td[class^=time-raw]").text();
    //     // timeAdj = $(this).closest("tr").find("td[class^=time-adj]").text();
    //     // cones = $(this).closest("tr").find("td[class^=cones]").text()
    //     this.checked ? $(this).closest("tr").find("td[class^=time-adj]").text("N/A") : $(this).closest("tr").find("td[class^=time-adj]").text(Number($(this).closest("tr").find("td[class^=time-raw]").text()) + conePenalty * this.value);
    // })

    $("#download-excel-data").click(function() {
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
    });

    $(".timing-device-status-icon").click(function() {
        if (!$(this).hasClass("disabled")) {
            checkForTimingDevice();
        }
    });

});

function cardinalNumber(n){
    return n += [,'st','nd','rd'][n%100>>3^1&&n%10] || 'th'; 
} 

function createInitialTimesArray() {
    timesArray = [{id: 1}];
}

function confirmDeleteRun(titleInput, cell) {
    let defer = $.Deferred();
    $("#delete-run-modal").dialog({
        // autoOpen: false,
        resizable: false,
        height: "auto",
        width: 500,
        modal: true,
        show: {duration: modalFade},
        hide: {duration: modalFade},
        title: titleInput,
        buttons: {
            "OK": function() {
                defer.resolve({confirmed: true, cell: cell});
                $(this).dialog("close");
            },
            "Cancel": function() {
                defer.resolve({confirmed: false, cell: cell});
                $(this).dialog("close");
            }
        },
        close: function() {
            // $(this).destroy();
        }
    });

    $("#delete-run-modal").html("<p>Are you sure you want to delete " + cell.getData().name + "'s " + cardinalNumber(cell.getData().run) + " run?</p>");

    return defer.promise();
}

function calcTimeAdj(timeRaw, coneCount) {
    return (timeRaw == undefined) ? "" : parseFloat((timeRaw + conePenalty * coneCount).toFixed(3));
}

function updateAllData() {
    processTimesModifiers();
    updateVehicleListTable();
    updateDriverListTable();
    updatePracticeStats();

    let practiceDateFormatted = moment($("#practice-date").val()).format("YYYY-MM-DD");
    let storageArray = {};
    storageArray.times = timesArray;
    storageArray.drivers = driversList;
    storageArray.vehicles = vehiclesList;
    storageArray.lastSaved = moment();

    chrome.storage.local.set({[practiceDateFormatted]: storageArray});
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

    if (timesArray.filter(x => isEmptyOrUndefined(x.timestamp)).length == 0) {
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

        let totalTimeEst = moment.utc(driversList.length * maxNumberOfRuns * averageTime*1000).format("HH:mm:ss");
        $("#total-time-est").html(totalTimeEst);

        let endEst = moment.min(timestampsArray).add(moment.duration(driversList.length * maxNumberOfRuns * averageTime*1000)).format("h:mm A");
        $("#end-est").html(endEst);

        let conesHit = timesArray.map(x => x.cones).filter(x => x > 0).reduce((a, b) => a + b, 0);
        $("#cones-hit").html(conesHit);
    }

    let remainingRuns = driversList.length * maxNumberOfRuns - timesArray.filter(x => x.ignoreRunCount !== true).length;
    $("#remaining-runs").html(remainingRuns);

    let percentComplete = (driversList.length * maxNumberOfRuns - remainingRuns) / (driversList.length * maxNumberOfRuns) * 100;
    $("#complete").html(percentComplete.toFixed(0) + "%");    

}

function initializeDriverListTable() {
    driversTable = new Tabulator("#drivers-table", {
        columns: driversColumns,
        data: driversList,
        layout: "fitDataFill",
        rowFormatter: function(row) {
            let data = row.getData();
            (data.runs >= maxNumberOfRuns) ? row.getElement().classList.add("last-run") : row.getElement().classList.remove("last-run");

        },
    });

    // updateDriverListTable();
}

function updateDriverListTable() {
    if (!driversList) initializeDriverListTable();

    timesArray = timesTable.getData();
    driversList = driversTable.getData();

    driversList.map(x => x.runs = timesArray.filter(y => y.name == x.name).length);


    driversList.map(x => x.ftd = timesArray.filter(y => y.name == x.name && Number(y.timeAdj) && !isEmptyOrUndefined(y.vehicle)).sort((a, b) => a.timeAdj < b.timeAdj ? 1 : -1).reduce((a, b) => a.timeAdj < b.TimeAdj ? a.timeAdj : b.timeAdj, ""));
    driversList.map(x => x.vehicle = timesArray.filter(y => y.name == x.name && Number(y.timeAdj) && !isEmptyOrUndefined(y.vehicle)).sort((a, b) => a.timeAdj < b.timeAdj ? 1 : -1).reduce((a, b) => a.timeAdj < b.TimeAdj ? a.vehicle : b.vehicle, ""));

    driversTable.setData(driversList);

    timesTable.options.columns.filter(x => x.field == "name").map(x => x.editorParams.values = driversList.map(x => x.name));
}

function initializeVehicleListTable() {
    vehiclesTable = new Tabulator("#vehicles-table", {
        columns: vehiclesColumns,
        data: vehiclesList,
        initialFilter: [
            {field: "inUse", type: "=", value: true},
        ],
        layout: "fitDataFill",
        layoutColumnsOnNewData: true,
        index: "vehicleNumber",
    });

    // updateVehicleListTable();
}

function updateVehicleListTable(set) {
    if (!vehiclesList) initializeVehicleListTable();

    timesArray = timesTable.getData();
    vehiclesList = vehiclesTable.getData();

    let numberOfRuns = 0;
    let runsThisVehicle = [];

    vehiclesList.forEach(function(thisVehicle) {
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
        }
    });

    set ? vehiclesTable.setData(vehiclesList) : vehiclesTable.updateData(vehiclesList);

    timesTable.options.columns.filter(x => x.field == "vehicle").map(x => x.editorParams.values = vehiclesList.filter(x => x.inUse == true).map(x => x.name));
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
            let lowestEmptyID = timesArray.filter(x => x.id == timesArray.filter(x => x.timestamp == undefined).reduce((a, b) => (a.id > b.id) ? b : a).id)[0];

            lowestEmptyID.timeRaw = timeReceived;
            lowestEmptyID.timestamp = timestampReceived;

            timesTable.updateData(timesArray);
        }
        else {
            timesTable.addRow({id: nextID, timeRaw: timeReceived, timestamp: timestampReceived}, true);
        }  
        
    }
    updateAllData();
}

// function getWidestElementSize(inputElement) {
//   let widestSize = $(inputElement[0]).width();
//   inputElement.each(function() {
//     console.log(this);
//   })
// }

// function sortDropdownAlphabetically(dropdown) {
// 	dropdown.html(dropdown.find('option').sort(function(x, y) {
// 	// to change to descending order switch "<" for ">"
// 	return $(x).text() > $(y).text() ? 1 : -1;

// 	}));
// }

// function populateVehicleDropdowns() {
// 	let vehicleDropdown = $(".vehicle-selection");

// 	vehicleDropdown.empty();
// 	vehicleDropdown.append("<option value=\"\"></option>");

// 	$(vehiclesList.filter(x => x.inUse == true)).each(function() {
// 		vehicleDropdown.append("<option value=\"" + this.vehicleNumber + "\">" + this.name + "</option>");
// 	})
// }

// function initializeCombobox() {
// 	$.widget( "custom.combobox", {
//       _create: function() {
//         this.wrapper = $( "<span>" )
//           .addClass( "custom-combobox" )
//           .insertAfter( this.element );
 
//         this.element.hide();
//         this._createAutocomplete();
//         // this._createShowAllButton();
//         this._showListWhenInFocus();
//       },
 
//       _createAutocomplete: function() {
//         var selected = this.element.children( ":selected" ),
//           value = selected.val() ? selected.text() : "";
 
//         this.input = $( "<input>" )
//           .appendTo( this.wrapper )
//           .val( value )
//           .attr( "title", "" )
//           .addClass( "custom-combobox-input ui-widget ui-widget-content ui-state-default ui-corner-left" )
//           .autocomplete({
//             delay: 0,
//             minLength: 0,
//             source: $.proxy( this, "_source" )
//           })
//           .tooltip({
//             classes: {
//               "ui-tooltip": "ui-state-highlight"
//             }
//           });
 
//         this._on( this.input, {
//           autocompleteselect: function( event, ui ) {
//             ui.item.option.selected = true;
//             this._trigger( "select", event, {
//               item: ui.item.option
//             });
//           },
 
//           autocompletechange: "_removeIfInvalid"
//         });
//       },

//       _showListWhenInFocus: function() {
//       	let input = this.input;
//       	let wasOpen = false;

//       	input.mousedown(function() {
//       		wasOpen = input.autocomplete( "widget" ).is( ":visible" );
//       	})

//       	input.click(function() {
//             input.trigger( "focus" );
 
//             // Close if already visible
//             if ( wasOpen ) {
//               return;
//             }
 
//             // Pass empty string as value to search for, displaying all results
//             input.autocomplete( "search", "" );
//         });
//       },

//       _createShowAllButton: function() {
//         var input = this.input,
//           wasOpen = false;
 
//         $( "<a>" )
//           .attr( "tabIndex", -1 )
//           .attr( "title", "Show All Items" )
//           // .tooltip()
//           .appendTo( this.wrapper )
//           .button({
//             icons: {
//               primary: "ui-icon-triangle-1-s"
//             },
//             text: false
//           })
//           .removeClass( "ui-corner-all" )
//           .addClass( "custom-combobox-toggle ui-corner-right" )
//           .on( "mousedown", function() {
//             wasOpen = input.autocomplete( "widget" ).is( ":visible" );
//           })
//           .on( "click", function() {
//             input.trigger( "focus" );
 
//             // Close if already visible
//             if ( wasOpen ) {
//               return;
//             }
 
//             // Pass empty string as value to search for, displaying all results
//             input.autocomplete( "search", "" );
//           });
//       },
 
//       _source: function( request, response ) {
//       	var term = $.trim(request.term);
//         var matcher = new RegExp( $.ui.autocomplete.escapeRegex(term), "i" );
//         response( this.element.children( "option" ).map(function() {
//           var text = $( this ).text();
//           if ( this.value && ( !term || matcher.test(text) ) )
//             return {
//               label: text,
//               value: text,
//               option: this
//             };
//         }) );
//       },
 
//       _removeIfInvalid: function( event, ui ) {
 
//         // Selected an item, nothing to do
//         if ( ui.item ) {
//           return;
//         }
 
//         // Search for a match (case-insensitive)
//         var value = this.input.val(),
//           valueLowerCase = value.toLowerCase(),
//           valid = false;
//         this.element.children( "option" ).each(function() {
//           if ( $( this ).text().toLowerCase() === valueLowerCase ) {
//             this.selected = valid = true;
//             return false;
//           }
//         });
 
//         // Found a match, nothing to do
//         if ( valid ) {
//           return;
//         }
 
//         // Remove invalid value
//         this.input
//           .val( "" )
//           .attr( "title", value + " didn't match any item" )
//           .tooltip( "open" );
//         this.element.val( "" );
//         this._delay(function() {
//           this.input.tooltip( "close" ).attr( "title", "" );
//         }, 2500 );
//         this.input.autocomplete( "instance" ).term = "";
//       },
 
//       _destroy: function() {
//         this.wrapper.remove();
//         this.element.show();
//       }
//     });
 
//     $( ".vehicle-selection" ).combobox();
//     $( ".custom-combobox-input" ).attr("placeholder", determineInputPlaceholder($( ".custom-combobox-input" )));
//     $( "#toggle" ).on( "click", function() {
//       $( ".vehicle-selection" ).toggle();
//     });
//     $(".vehicle-column").width($(".vehicle-selection").width());
// }

// function determineInputPlaceholder(combobox) {
// 	if (combobox.parent().parent()[0].id.includes("vehicle")) {
// 		return "Enter a vehicle";
// 	}
// 	else if (combobox.parent().parent()[0].id.includes("name")) {
// 		return "Enter a name";
// 	}
// }

let serialOptions = {bitrate: 1200, dataBits: "eight", parityBit: "no", stopBits: "one"};

function populateCOMPortDropdown() {
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

let onGetDevices = function(ports) {
    let COMPortDropdown = $("#com-port");

	for (let i = 0; i < ports.length; i++) {
        COMPortsArray.push(ports[i]);
        // COMPortDropdown.append($("<option>", {value: ports[i].path, text: ports[i].path}));
        
		console.log(ports[i].path);
	}

    COMPortsArray.sort();
}

let onConnect = function(connectionInfo) {
	console.log(connectionInfo.connectionId);
}

let stringReceived = "";
let timeReceived;
let inCurrentMessage = false;

let onReceiveCallback = function(info) {
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

            // timesArray = timesTable.getData();
            // if (timesArray.filter(x => x.timestamp == undefined).length > 0) {
            //     let lowestEmptyID = timesArray.filter(x => x.id == timesArray.filter(x => x.timestamp == undefined).reduce((a, b) => (a.id > b.id) ? b : a).id)[0];

            //     lowestEmptyID.timeRaw = timeReceived;
            //     lowestEmptyID.timestamp = moment().format(TIMESTAMP_FORMAT);
            // }
            // else {
            //     // addLapTime();
            // }
		}
	}

	if (thisInteger !== 14 && thisInteger !== 15 && inCurrentMessage) {
		stringReceived += String.fromCharCode(thisInteger);
	}
}

let onReceiveErrorCallback = function(info) {
    $("#timing-device-status").html("Not Found<div class='timing-device-status-icon'><i class='fas fa-unlink'></i></div>");
}

let convertSerialToASCII = function(serialData) {
	return new Int8Array(serialData)[0];
}

let writeSerial = function(str) {
  chrome.serial.send(connectionId, convertStringToArrayBuffer(str), onSend);
}

// Convert string to ArrayBuffer
let convertStringToArrayBuffer = function(str) {
  let buf = new ArrayBuffer(str.length);
  let bufView = new Uint8Array(buf);
  for (let i = 0; i < str.length; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

chrome.serial.getDevices(onGetDevices);
// chrome.serial.connect("COM8", {bitrate: 1200, dataBits: "eight", parityBit: "no", stopBits: "one"}, onConnect);
chrome.serial.onReceive.addListener(onReceiveCallback);
chrome.serial.onReceiveError.addListener(onReceiveErrorCallback);


function connectToSerialPort() {
    // let selectedCOMPort = $("#com-port").val() || COMPortsArray[0];
    chrome.serial.connect(selectedCOMPort, {bitrate: 1200, dataBits: "eight", parityBit: "no", stopBits: "one"}, onConnect);
    chrome.serial.onReceive.addListener(onReceiveCallback);
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

	// const showAllVehiclesCheckbox = $("#show-all-vehicles");
	// const vehicleInUseColumns = $(".vehicle-in-use-column");
	// const vehiclesTableRows = $("#vehicles > tbody > tr");

	// if (showAllVehiclesCheckbox.prop("checked")) {


	// 	vehicleInUseColumns.fadeIn(250); 

	// 	vehiclesTableRows.each(function() {
	// 		$(this).fadeIn(250);
	// 	})
	// }
	// else {
		

	// 	vehiclesTableRows.each(function() {
	// 	if ($(this).find("input[type='checkbox']").prop("checked")) {
	// 		$(this).fadeIn(250);
	// 	}
	// 	else {
	// 		$(this).fadeOut(250);
	// 	}

	// 	vehicleInUseColumns.fadeOut(300);
	// });
	// }
}

// function insertNewRun({name, vehicle, timeRaw, timestamp}) {
// 	let timesTable = $("table.times-table");
// 	let newRow = "";

// 	newRow += "<tr>\n";
// // 	newRow += "<td class='name-column' id='name-" + 


// // <td class="mod-column" id="run-1">1</td>
// //  					<td class="name-column" id="name-1">Louis Cohen</td>
// //  					<td class="vehicle-column" id="vehicle-1">94 - White Corvette Z06</td>
// //  					<td class="time-raw-column" id="time-raw-1">54.035</td>
// //  					<td class="time-adj-column" id="time-adj-1">56.035</td>
// //  					<td class="timestamp-column" id="timestamp-1">9:35:46 AM</td>
// //  					<td class="mod-column cones-column">1</td>
// //  					<td class="mod-column dnf-column"><div class="checkbox"><input type="checkbox" id="dnf-checkbox-1"><label for="dnf-checkbox-1"></label></div></td>
// //  					<td class="mod-column ins-column"><div class="checkbox"><input type="checkbox" id="ins-checkbox-1"><label for="ins-checkbox-1"></label></div></td>
// //  					<td class="mod-column na-column"><div class="checkbox"><input type="checkbox" id="na-checkbox-1"><label for="na-checkbox-1"></label></div></td>
// }

function populateDriverList() {
    driversList = [
        {name: "Aaron Linke"},
        {name: "Alexandra Honey"},
        {name: "Amaarah Johnson"},
        {name: "Andrew Schembri"},
        {name: "Anthony Donatelli"},
        {name: "Bob Davies"},
        {name: "Brandon Bishop"},
        {name: "Chase Lowder"},
        {name: "Christopher Biddle"},
        {name: "Christopher Heinzen"},
        {name: "Cody Pae"},
        {name: "Daniel Mozel"},
        {name: "David Hoch"},
        {name: "Demitry Belski"},
        {name: "Devon Hall"},
        {name: "Dylan Studden"},
        {name: "Eddie Franklin Jr"},
        {name: "Edward Pancost"},
        {name: "Ethan Winberg"},
        {name: "Forrest Berg"},
        {name: "Hector Lozada"},
        {name: "Henry Chen"},
        {name: "James Gross"},
        {name: "Jason Blair"},
        {name: "Joel Fernandez"},
        {name: "Jon D Stanley"},
        {name: "Joshua Rios"},
        {name: "Joshua Stroup"},
        {name: "Julie Starr"},
        {name: "Kalvin Parker"},
        {name: "Kamran Ahmed"},
        {name: "Karl Riggs"},
        {name: "Kevin Albert"},
        {name: "Kevin Killian"},
        {name: "Lawson Sumner"},
        {name: "Leslie Urff"},
        {name: "Lindsey Scheer"},
        {name: "Louis Cohen"},
        {name: "Luke Au"},
        {name: "Manuel Sanchez"},
        {name: "Matthew CHEMBOLA"},
        {name: "Michael Nakhla"},
        {name: "Paul Townsend"},
        {name: "Rodrigo Rojas Mondragon"},
        {name: "Ryan Sierzega"},
        {name: "Safadyn Ramahi"},
        {name: "Seth Brown"},
        {name: "Stephen Dissler Jr"},
        {name: "Stephen Hayes"},
        {name: "Stephen Ioas"},
        {name: "Tyler Chantrenne"},
        {name: "Valerie Malaney"},
        {name: "Varun Patel"},
        {name: "Vikram Krishnan"},
        {name: "Wesley Haney"},
        {name: "William Bennett"},
    ];

    driversList.sort((a, b) => (a.name < b.name) ? -1 : (a.name > b.name) ? 1 : 0);
}

function populateVehicleList() {
    vehiclesList = [
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

    vehiclesList.sort((a, b) => (a.name < b.name) ? -1 : (a.name > b.name) ? 1 : 0); // short in numerical order
    vehiclesList.forEach(x => x.vehicleNumber = Number(x.name.slice(0, 2))); // add vehicle numbers
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
