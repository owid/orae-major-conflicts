#!/usr/local/bin/node

const fs = require("fs");
const path = require("path");

if (process.argv.length < 4) {
	console.log("Needs 2 parameters: [input path] [output path]");
	process.exit(1);
}

function sum(array) {
	let result = 0;
	for (const value of array) {
		result += value;
	}
	return result;
}

function count(array, predicate) {
	return sum(array.map((value) => predicate(value) ? 1 : 0))
}

function getPath(relativePath) {
	return path.join(__dirname, relativePath);
}

// A very hacky way to find the event separators.
// Specific to tessaract 4.0 with the default ENG training data.
function isSeparator(line) {
	// 0063 separators
	if (line.indexOf("ISOS IO IO") !== -1) return true;
	if (line.indexOf("SUNECREERE EE") !== -1) return true;
	// 0067
	if (line.indexOf("REECE EERE") !== -1) return true;
	// 0084
	if (line.startsWith("THAKUR")) return true;
	// 0116
	if (line.indexOf("TIKI HARRIE") !== -1) return true;
	// 0117
	if (line.startsWith("HREM")) return true;
	// 0137
	if (line.indexOf("HERRERA KR") !== -1) return true;
	// 0138
	if (line.startsWith("KEARAUKKIUK")) return true;
	// 0156
	if (line.indexOf("REIRAIIAA") !== -1) return true;
	// 0157
	if (line.indexOf("HARKER") !== -1) return true;
	// 0160
	if (line === "RAKES") return true;
	// 0168
	if (line.indexOf("KEKE KHER") !== -1) return true;
	// 0175
	if (line === "RUKIA") return true;
	// 0180
	if (line.indexOf("MRE MERE") !== -1) return true;
	// 0183
	if (line.indexOf("AISIAR ATI") !== -1) return true;
	if (line.indexOf("KAKA RIKER") !== -1) return true;
	// otherwise count K, E, R occurrences
	const occurrences = count(
		line.split(""),
		(l) => l === "K" || l === "E" || l === "R"
	);
	return occurrences > 15
		|| ((occurrences / line.length) > 0.6 && line.length > 8);
}

function splitOn(array, isSeparator) {
	const collections = [[]];
	let currentCollection = collections[0];
	for (const value of array) {
		if (isSeparator(value)) {
			currentCollection = [];
			collections.push(currentCollection);
		} else {
			currentCollection.push(value);
		}
	}
	return collections;
}

function appendName(filePath, name) {
	let index = filePath.lastIndexOf(".");
	if (index === -1) index = filePath.length;
	return filePath.slice(0, index) + name + filePath.slice(index);
}

const [inputPath, outputPath] = process.argv.slice(2);

const content = fs.readFileSync(getPath(inputPath), { encoding: "utf8" });
const lines = content.split("\n");

lines.forEach((line, index) => {
	if (isSeparator(line)) {
		console.log(`${inputPath}:${index} ${line}`);
	}
});

splitOn(lines, isSeparator).forEach((lines, index) => {
	const fileContent = lines
		.filter((line) => !/^\s*$/.test(line))
		.join("\n");
	const newPath = appendName(getPath(outputPath), `-${index+1}`);
	fs.writeFileSync(newPath, fileContent);
});