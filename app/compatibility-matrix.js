const fs = require('fs')
const path = require('path')

const CSV_PATH = path.join(__dirname, 'data', 'compatibility-matrix.csv')

let cachedIndex

function parseCsvLine(line) {
  var cells = []
  var current = ''
  var inQuotes = false

  for (var i = 0; i < line.length; i++) {
    var character = line[i]
    var nextCharacter = line[i + 1]

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (character === ',' && !inQuotes) {
      cells.push(current)
      current = ''
      continue
    }

    current += character
  }

  cells.push(current)
  return cells
}

function normaliseActionCode(code) {
  if (typeof code !== 'string') {
    return ''
  }

  return code.trim().toUpperCase()
}

function createYearBuckets() {
  return {
    allow: new Map(),
    deny: new Map()
  }
}

function addPair(map, leftCode, rightCode) {
  if (!map.has(leftCode)) {
    map.set(leftCode, new Set())
  }

  map.get(leftCode).add(rightCode)
}

function getOrCreateYear(indexByYear, year) {
  if (!indexByYear.has(year)) {
    indexByYear.set(year, createYearBuckets())
  }

  return indexByYear.get(year)
}

function buildMatrixIndex() {
  if (cachedIndex) {
    return cachedIndex
  }

  var rawCsv = fs.readFileSync(CSV_PATH, 'utf8')
  var lines = rawCsv.split(/\r?\n/).filter(Boolean)
  var indexByYear = new Map()

  for (var lineNumber = 1; lineNumber < lines.length; lineNumber++) {
    var line = lines[lineNumber]
    var columns = parseCsvLine(line)
    if (columns.length < 5) {
      continue
    }

    var optionCode = normaliseActionCode(columns[0])
    var optionCodeCompat = normaliseActionCode(columns[1])
    var description = (columns[3] || '').trim()
    var year = Number(columns[4])

    if (!optionCode || !optionCodeCompat || Number.isNaN(year)) {
      continue
    }

    var yearBucket = getOrCreateYear(indexByYear, year)
    var isNotCompatible = /not compatible/i.test(description)
    var targetMap = isNotCompatible ? yearBucket.deny : yearBucket.allow
    addPair(targetMap, optionCode, optionCodeCompat)
  }

  var availableYears = Array.from(indexByYear.keys()).sort(function (a, b) {
    return a - b
  })

  cachedIndex = {
    indexByYear: indexByYear,
    availableYears: availableYears
  }

  return cachedIndex
}

function resolveYear(year) {
  var matrix = buildMatrixIndex()
  if (!matrix.availableYears.length) {
    return undefined
  }

  if (Number.isInteger(year) && matrix.indexByYear.has(year)) {
    return year
  }

  return matrix.availableYears[matrix.availableYears.length - 1]
}

function hasPair(yearBucket, mapName, leftCode, rightCode) {
  var map = yearBucket[mapName]
  var pairs = map.get(leftCode)
  return Boolean(pairs && pairs.has(rightCode))
}

function areActionsCompatible(actionCodeA, actionCodeB, year) {
  var leftCode = normaliseActionCode(actionCodeA)
  var rightCode = normaliseActionCode(actionCodeB)

  if (!leftCode || !rightCode) {
    return true
  }

  if (leftCode === rightCode) {
    return true
  }

  var matrix = buildMatrixIndex()
  var resolvedYear = resolveYear(year)
  if (!resolvedYear) {
    return true
  }

  var yearBucket = matrix.indexByYear.get(resolvedYear)
  if (!yearBucket) {
    return true
  }

  if (hasPair(yearBucket, 'deny', leftCode, rightCode) || hasPair(yearBucket, 'deny', rightCode, leftCode)) {
    return false
  }

  if (hasPair(yearBucket, 'allow', leftCode, rightCode) || hasPair(yearBucket, 'allow', rightCode, leftCode)) {
    return true
  }

  return false
}

function findIncompatibilities(actionCodes, year) {
  var uniqueCodes = Array.from(new Set((actionCodes || []).map(normaliseActionCode).filter(Boolean)))
  var conflicts = []

  for (var i = 0; i < uniqueCodes.length; i++) {
    for (var j = i + 1; j < uniqueCodes.length; j++) {
      var leftCode = uniqueCodes[i]
      var rightCode = uniqueCodes[j]

      if (!areActionsCompatible(leftCode, rightCode, year)) {
        conflicts.push({
          actionCodeA: leftCode,
          actionCodeB: rightCode
        })
      }
    }
  }

  return conflicts
}

module.exports = {
  areActionsCompatible,
  findIncompatibilities,
  normaliseActionCode,
  resolveYear
}