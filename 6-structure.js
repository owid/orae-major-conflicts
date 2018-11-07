#!/usr/local/bin/node

const fs = require('fs').promises;
const util = require('util');

const glob = require('fast-glob');
const FuzzySet = require('fuzzyset.js');
const stringify = util.promisify(require('csv-stringify'));

const startLabels = [
	// 'SEQ NUM',
	// 'DESCRIPTOR',
	// 'START DATE',
	// 'END DATE',
	'REGION(S)',
	'NATION(S)',
	'ACTOR(S)',
	'COMMITTER(S)',
	'LOCATION(S)',
	'INTERVENOR(S)',
	'MODE',
	// 'MAGNITUDE',
	// 'COMBATANTS',
	'DEATHS',
	// 'FORCE',
	'ISSUE(S)',
	'OUTCOME(S)',
	'SOURCE(S)'
].map((label) => `${label}-`); // in the scans, they all have dashes

const modeLabels = [
	'MAGNITUDE',
	'COMBATANTS'
].map((label) => `${label}-`);

const deathsLabels = [
	'FORCE',
].map((label) => `${label}-`);

const fuzzyStartLabels = FuzzySet(startLabels, true);
const fuzzyModeLabels = FuzzySet(modeLabels, true);
const fuzzyDeathsLabels = FuzzySet(deathsLabels, true);

function splitOnIndex(string, index) {
	if (string.length <= index) return [string, ''];
	else return [
		string.substring(0, index),
		string.substring(index+1)
	];
}

function sum(array) {
	let result = 0;
	for (const value of array) {
		result += value;
	}
	return result;
}

function count(array, predicate) {
	if (typeof array === 'string') array = array.split('');
	return sum(array.map((value) => predicate(value) ? 1 : 0))
}

function getLabelEndIndex(line) {
	let i = 0;
	while (
		line.length > 2
		&& i < line.length
		&& (i < 3 || !/\s/.test(line[i]))
	) {
		i++;
	}
	return i;
}

function appendLine(content, line) {
	return content ? content + '\n' + line : line;
}

function appendWord(content, word) {
	return content ? content + ' ' + word : word;
}

function removeInvalidCharacters(content) {
	return content
		.replace(/[-–—=~]+/gi, '-')
		.replace(/\s?\/\s?/gi, '/')
}

function extractStartLabels(filePath, content) {
	const entry = { filePath, content };
	let availableLabels = startLabels;
	let lastLabel;
	content
		.split('\n')
		.map((line) => {
			const [labelText, valueText] = splitOnIndex(line, getLabelEndIndex(line));
			const fuzzyMatches = fuzzyStartLabels.get(labelText, null, 0.3);
			const result = { line, labelText, valueText, fuzzyMatches };
			// If the Levenshtein distance is very small, assume the label is correctly
			// identified.
			if (fuzzyMatches && fuzzyMatches[0][0] > 0.75) {
				const label = fuzzyMatches[0][1];
				entry[label] = valueText;
				availableLabels = availableLabels.filter((l) => l !== label);
				result.label = label;
				result.done = true;
			}
			return result;
		})
		.forEach(({ line, valueText, fuzzyMatches, label, done }) => {
			if (done) {
				lastLabel = label;
			} else {
				const potentialLabels = fuzzyMatches && fuzzyMatches.map((x) => x[1]) || [];
				const possibleLabels = potentialLabels.filter((l) => availableLabels.includes(l));
				const likelyLabel = possibleLabels[0];
				if (likelyLabel) {
					entry[likelyLabel] = valueText;
					lastLabel = likelyLabel;
					availableLabels = availableLabels.filter((l) => l !== label);
				}
				else {
					const label = lastLabel || "HEADER";
					entry[label] = appendLine(entry[label], line);
				}
			}
		});
	return entry;
}

function extractInnerLabels(entry) {
	[
		['MODE-', fuzzyModeLabels],
		['DEATHS-', fuzzyDeathsLabels]
	].forEach(([label, fuzzyLabels]) => {
		if (entry[label]) {
			let currentLabel = label;
			const words = entry[currentLabel].split(/\s+/);
			entry[currentLabel] = '';
			for (const word of words) {
				const fuzzyMatches = fuzzyLabels.get(word, null, 0.5);
				// fuzzyMatches[0][1] !== currentLabel because the FORCE- label
				// sometimes has 'Ground Forces' as a value — we don't want to change
				// the label in that case.
				if (fuzzyMatches && fuzzyMatches[0][1] !== currentLabel) {
					currentLabel = fuzzyMatches[0][1];
					entry[currentLabel] = entry[currentLabel] || '';
				} else {
					entry[currentLabel] = appendWord(entry[currentLabel], word);
				}
			}
		}
	});
	return entry;
}

function isDigit(c) {
	return /^\d$/.test(c);
}

function isYear(word) {
	return word.length >= 3 && word.length <= 5 && count(word, isDigit) >= 3;
}

function extractStartEnd(entry) {
	if (entry["HEADER"]) {
		const years = [];
		const words = entry["HEADER"].split(/\s+/).slice(2);
		words.forEach((word) => {
			if (isYear(word)) years.push(word);
		});
		if (years.length >= 2) {
			entry["START"] = years[0];
			entry["END"] = years[1];
		}
	}
	return entry;
}

function trimValues(object) {
	for (const key in object) {
		if (typeof object[key] === 'string') {
			object[key] = object[key].trim();
		}
	}
	return object;
}

function readFileAndTryStructure(filePath) {
	return fs.readFile(filePath, { encoding: 'utf-8' })
		.then(removeInvalidCharacters)
		.then((content) => extractStartLabels(filePath, content))
		.then(extractInnerLabels)
		.then(extractStartEnd)
		.then(trimValues);
}

glob('5-ocr-split/*.txt')
.then((matches) => Promise.all(
	matches.sort().map(readFileAndTryStructure)
))
.then((entries) => stringify(entries, {
	header: true,
	columns: [
		'filePath',
		'HEADER',
		'START',
		'END',
		'REGION(S)-',
		'NATION(S)-',
		'ACTOR(S)-',
		'COMMITTER(S)-',
		'LOCATION(S)-',
		'INTERVENOR(S)-',
		'MODE-',
		'MAGNITUDE-',
		'COMBATANTS-',
		'DEATHS-',
		'FORCE-',
		'ISSUE(S)-',
		'OUTCOME(S)-',
		'SOURCE(S)-'
	]
}))
.then((csv) => {
	fs.writeFile('6-csv/entries.csv', csv);
});
