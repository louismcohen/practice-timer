document.getElementById("generate-new-laptime").addEventListener("click", () => generateNewLaptime())
document.getElementById("save-manual-entry").addEventListener("click", () => generateCustomRun())

let timesArray, laptimes, averageTime, lastTimestamp

function getLatestTimes() {
	timesArray = chrome.app.window.current().timesArray
	laptimes = timesArray.map(x => x.timeRaw)
	averageTime = chrome.app.window.current().averageTime
	lastTimestamp = timesArray.map(x => x.timestamp).reduce((a, b) => a > b ? a : b)
}

function generateRandomLaptime() {
	const avgLaptime = laptimes.reduce((a, b) => a + b) / laptimes.length
	const randomLaptimeOffset = (Math.random() * 20) - 10
	let newLapTime = avgLaptime + randomLaptimeOffset

	return Number(newLapTime.toFixed(3))
}

function generateRandomTimestamp() {
	const lastTimestampCopy = moment(lastTimestamp)
	const randomTimestampOffset = (Math.random() * 20) - 10
	const newOffset = averageTime + randomTimestampOffset
	const newTimestamp = lastTimestampCopy.add(newOffset, "seconds")

	return ({timestamp: newTimestamp, newOffset: newOffset})
}

function generateNewLaptime() {
	getLatestTimes()

	const newLapTime = generateRandomLaptime()
	const randomTimestamp = generateRandomTimestamp()

	chrome.runtime.sendMessage({timeReceived: newLapTime, timestampISO: randomTimestamp.timestamp});

	updateDOM(newLapTime, randomTimestamp)
} 

function generateCustomRun() {
	getLatestTimes()

	const customLaptime = document.getElementById("manual-laptime").value
	const customTimestamp = document.getElementById("manual-timestamp").value

	const laptime = customLaptime ? Number(Number(customLaptime).toFixed(3)) : generateRandomLaptime()
	let newTimestamp

	if (customTimestamp) {
		const lastTimestampCopy = moment(lastTimestamp)

		const splitTimestamp = customTimestamp.split(":")
		const hour = splitTimestamp[0]
		const minute = splitTimestamp[1]
		const second = splitTimestamp[2]

		const timestamp = lastTimestampCopy.hour(hour).minute(minute).second(second)
		const newOffset = timestamp.diff(lastTimestamp, "s")

		newTimestamp = {timestamp: timestamp, newOffset: newOffset}
	} else {
		newTimestamp = generateRandomTimestamp() 
	}
	// const timestamp = customTimestamp ? moment(customTimestamp) : generateRandomTimestamp().timestamp

	chrome.runtime.sendMessage({timeReceived: laptime, timestampISO: newTimestamp.timestamp});

	updateDOM(laptime, newTimestamp)
}

function updateDOM(newLapTime, newTimestamp) {
	document.getElementById("new-laptime").textContent = newLapTime
	document.getElementById("new-timestamp").textContent = newTimestamp.timestamp.format("h:mm:ss A")
	document.getElementById("timestamp-diff").textContent = `${moment("1900-01-01 00:00:00").add(newTimestamp.newOffset, "seconds").format("mm:ss")}`
}