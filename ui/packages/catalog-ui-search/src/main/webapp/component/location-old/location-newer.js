/**
 * Copyright (c) Codice Foundation
 *
 * This is free software: you can redistribute it and/or modify it under the terms of the GNU Lesser
 * General Public License as published by the Free Software Foundation, either version 3 of the
 * License, or any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without
 * even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details. A copy of the GNU Lesser General Public License
 * is distributed along with this program and can be found at
 * <http://www.gnu.org/licenses/lgpl.html>.
 *
 **/
const usngs = require('usng.js')
const store = require('../../js/store.js')
const dmsUtils = require('../location-new/utils/dms-utils.js')
const DistanceUtils = require('../../js/DistanceUtils.js')

const converter = new usngs.Converter()
const utmUpsLocationType = 'utmUps'
const usngLocationType = 'usng'
// offset used by utmUps for southern hemisphere
const utmUpsBoundaryNorth = 84
const utmUpsBoundarySouth = -80
const northingOffset = 10000000
const usngPrecision = 6
const minimumDifference = 0.0001
const minimumBuffer = 0.000001
const Direction = dmsUtils.Direction

const convertToValid = (key, model) => {
  console.log('location-old:convertToValid(): Starting')
  const { mapNorth, mapSouth } = model

  if (
    key.mapSouth !== undefined &&
    (key.mapSouth >= key.mapNorth ||
      (key.mapNorth === undefined && key.mapSouth >= mapNorth))
  ) {
    key.mapSouth = parseFloat(key.mapNorth || mapNorth) - minimumDifference
  }
  if (
    key.mapNorth !== undefined &&
    (key.mapNorth <= key.mapSouth ||
      (key.mapSouth === undefined && key.mapNorth <= mapSouth))
  ) {
    key.mapNorth = parseFloat(key.mapSouth || mapSouth) + minimumDifference
  }
  if (key.mapNorth !== undefined) {
    key.mapNorth = Math.max(-90, key.mapNorth)
    key.mapNorth = Math.min(90, key.mapNorth)
  }
  if (key.mapSouth !== undefined) {
    key.mapSouth = Math.max(-90, key.mapSouth)
    key.mapSouth = Math.min(90, key.mapSouth)
  }
  if (key.mapWest !== undefined) {
    key.mapWest = Math.max(-180, key.mapWest)
    key.mapWest = Math.min(180, key.mapWest)
  }
  if (key.mapEast !== undefined) {
    key.mapEast = Math.max(-180, key.mapEast)
    key.mapEast = Math.min(180, key.mapEast)
  }

  if (key.radius !== undefined) {
    key.radius = Math.max(minimumBuffer, key.radius)
  }

  if (key.lineWidth !== undefined) {
    key.lineWidth = Math.max(minimumBuffer, key.lineWidth)
  }
  if (key.polygonBufferWidth) {
    key.polygonBufferWidth = Math.max(minimumBuffer, key.polygonBufferWidth)
  }
}

// Return true if the current location type is UTM/UPS, otherwise false.
const isLocationTypeUtmUps = ({ locationType }) => {
  console.log('location-old:isLocationTypeUtmUps(): Starting')

  return locationType === utmUpsLocationType
}

const getBBox = args => {
  console.log('location-old:getBBox(): Starting')

  const { locationType, north, south, west, east } = args

  let result = {}

  if (
    north !== undefined &&
    south !== undefined &&
    east !== undefined &&
    west !== undefined
  ) {
    result = {
      bbox: [west, south, east, north].join(','),
    }
  }

  if (locationType !== usngLocationType && !isLocationTypeUtmUps(args)) {
    result = {
      ...result,
      mapNorth: north,
      mapSouth: south,
      mapEast: east,
      mapWest: west,
    }
  }
  return result
}

const getLatLonFromDms = (dmsCoordinate, dmsDirection) => {
  console.log('location-old:getLatLonFromDms(): Starting')

  const coordinate = {}
  coordinate.coordinate = dmsCoordinate

  const isDmsInputIncomplete =
    coordinate.coordinate && coordinate.coordinate.includes('_')
  if (isDmsInputIncomplete) {
    return
  }

  coordinate.direction = dmsDirection

  const temp = dmsUtils.parseDmsCoordinate(coordinate)

  if (temp) {
    dmsUtils.dmsCoordinateToDD(temp)
  }
}

const setBboxDmsNorth = args => {
  return {
    north: getLatLonFromDms(args.dmsNorth, args.dmsNorthDirection),
  }
}

const setBboxDmsSouth = args => {
  return {
    south: getLatLonFromDms(args.dmsSouth, args.dmsSouthDirection),
  }
}

const setBboxDmsEast = args => {
  return {
    east: getLatLonFromDms(args.dmsEast, args.dmsEastDirection),
  }
}

const setBboxDmsWest = args => {
  return {
    west: getLatLonFromDms(args.dmsWest, args.dmsWestDirection),
  }
}

//  TODO: send help. We need the dmsCoordinateKey, and dmsDirectionKey from args, then set latLonKey,
const setLatLonFromDms = (
  dmsCoordinateKey,
  dmsDirectionKey,
  latLonKey,
  args
) => {
  const coordinate = {}
  coordinate.coordinate = args[dmsCoordinateKey]

  const isDmsInputIncomplete =
    coordinate.coordinate && coordinate.coordinate.includes('_')
  if (isDmsInputIncomplete) {
    return
  }

  coordinate.direction = args[dmsDirectionKey]

  const dmsCoordinate = dmsUtils.parseDmsCoordinate(coordinate)
  let result = {}
  if (dmsCoordinate) {
    return (result[latLonKey] = dmsUtils.dmsCoordinateToDD(dmsCoordinate))
  } else {
    return (result[latLonKey] = undefined)
  }
}

const setRadiusDmsLat = (dmsLat, dmsLatDirection, latLonKey, args) => {
  console.log('location-old:setRadiusDmsLat(): Starting')

  return {
    lat: setLatLonFromDms(dmsLat, dmsLatDirection, latLonKey, args),
  }
}

const setRadiusDmsLon = (dmsLat, dmsLatDirection, latLonKey, args) => {
  console.log('location-old:setRadiusDmsLon(): Starting')

  return {
    lon: setLatLonFromDms(dmsLat, dmsLatDirection, latLonKey, args),
  }
}

const isLatLonValid = (lat, lon) => {
  lat = parseFloat(lat)
  lon = parseFloat(lon)
  return lat > -90 && lat < 90 && lon > -180 && lon < 180
}

// Convert Lat-Lon to UTM/UPS coordinates. Returns undefined if lat or lon is undefined or not a number.
// Returns undefined if the underlying call to usng fails. Otherwise, returns an object with:
//
//   easting    : FLOAT
//   northing   : FLOAT
//   zoneNumber : INTEGER (>=0 and <= 60)
//   hemisphere : STRING (NORTHERN or SOUTHERN)
const LLtoUtmUps = (lat, lon) => {
  console.log('location-old:LLtoUtmUps(): Starting')

  lat = parseFloat(lat)
  lon = parseFloat(lon)
  if (!isLatLonValid(lat, lon)) {
    return undefined
  }

  let utmUps = converter.LLtoUTMUPSObject(lat, lon)
  const { zoneNumber, northing } = utmUps
  const isUps = zoneNumber === 0
  utmUps.northing = isUps || lat >= 0 ? northing : northing + northingOffset

  utmUps.hemisphere = lat >= 0 ? 'NORTHERN' : 'SOUTHERN'
  return utmUps
}

// Convert UTM/UPS coordinates to Lat-Lon. Expects an argument object with:
//
//   easting    : FLOAT
//   northing   : FLOAT
//   zoneNumber : INTEGER (>=0 and <= 60)
//   hemisphere : STRING (NORTHERN or SOUTHERN)
//
// Returns an object with:
//
//   lat : FLOAT
//   lon : FLOAT
//
// Returns undefined if the latitude is out of range.
//
const utmUpstoLL = utmUpsParts => {
  console.log('location-old:utmUpstoLL(): Starting')

  const { hemisphere, zoneNumber, northing, easting } = utmUpsParts
  const northernHemisphere = hemisphere === 'NORTHERN'

  utmUpsParts = {
    ...utmUpsParts,
    northPole: northernHemisphere,
  }

  const isUps = zoneNumber === 0
  utmUpsParts.northing =
    isUps || northernHemisphere ? northing : northing - northingOffset

  const upsValidDistance = distance => distance >= 800000 && distance <= 3200000
  if (isUps && (!upsValidDistance(northing) || !upsValidDistance(easting))) {
    return undefined
  }

  let { lat, lon } = converter.UTMUPStoLL(utmUpsParts)
  lon = lon % 360
  if (lon < -180) {
    lon = lon + 360
  }
  if (lon > 180) {
    lon = lon - 360
  }

  return isLatLonValid(lat, lon) ? { lat, lon } : undefined
}

const repositionLatLon = args => {
  console.log('location-old:repositionLatLon(): Starting')

  const { usngbb } = args

  let newResult = {}
  if (usngbb !== undefined) {
    try {
      const result = converter.USNGtoLL(usngbb)
      newResult = {
        mapNorth: result.north,
        mapSouth: result.south,
        mapEast: result.east,
        mapWest: result.west,
      }

      //  this.set(newResult)
    } catch (err) {}
  }

  newResult = {
    ...newResult,
    ...repositionLatLonUtmUps({
      isDefined: isUtmUpsUpperLeftDefined,
      parse: parseUtmUpsUpperLeft,
      assign: (newResult, lat, lon) => {
        newResult.mapNorth = lat
        newResult.mapWest = lon
      },
      clear: clearUtmUpsUpperLeft,
    }),
  }

  newResult = {
    ...newResult,
    ...repositionLatLonUtmUps({
      isDefined: isUtmUpsLowerRightDefined,
      parse: parseUtmUpsLowerRight,
      assign: (newResult, lat, lon) => {
        newResult.mapSouth = lat
        newResult.mapEast = lon
      },
      clear: clearUtmUpsLowerRight,
    }),
  }

  return newResult
}

const isInUpsSpace = (lat, lon) => {
  lat = parseFloat(lat)
  lon = parseFloat(lon)
  return (
    isLatLonValid(lat, lon) &&
    (lat < utmUpsBoundarySouth || lat > utmUpsBoundaryNorth)
  )
}

// Set the model fields for the Upper-Left bounding box UTM/UPS. The arguments are:
//
//   utmUpsFormatted : output from the method 'formatUtmUps'
//   silent       : BOOLEAN (true if events should be generated)
const getUtmUpsUpperLeft = (utmUpsFormatted, silent) => {
  return {
    utmUpsUpperLeftEasting: utmUpsFormatted.easting,
    utmUpsUpperLeftNorthing: utmUpsFormatted.northing,
    utmUpsUpperLeftZone: utmUpsFormatted.zoneNumber,
    utmUpsUpperLeftHemisphere: utmUpsFormatted.hemisphere,
  }
}

// Set the model fields for the Lower-Right bounding box UTM/UPS. The arguments are:
//
//   utmUpsFormatted : output from the method 'formatUtmUps'
//   silent       : BOOLEAN (true if events should be generated)
const getUtmUpsLowerRight = (utmUpsFormatted, silent) => {
  return {
    utmUpsLowerRightEasting: utmUpsFormatted.easting,
    utmUpsLowerRightNorthing: utmUpsFormatted.northing,
    utmUpsLowerRightZone: utmUpsFormatted.zoneNumber,
    utmUpsLowerRightHemisphere: utmUpsFormatted.hemisphere,
  }
}

const getBboxLatLon = args => {
  console.log('location-old:getBboxLatLon(): Starting')

  const { north, south, west, east, drawing, locationType } = args

  if (!isLatLonValid(north, west) || !isLatLonValid(south, east)) {
    return
  }

  let utmUps = LLtoUtmUps(north, west)
  let utmUpsParts
  let result = {}
  if (utmUps !== undefined) {
    utmUpsParts = formatUtmUps(utmUps)
    //  silent: !isLocationTypeUtmUps(args)?
    result = {
      ...result,
      ...getUtmUpsUpperLeft(utmUpsParts, !isLocationTypeUtmUps(args)),
    }
  }

  utmUps = LLtoUtmUps(south, east)
  if (utmUps !== undefined) {
    utmUpsParts = formatUtmUps(utmUps)
    //  silent: !isLocationTypeUtmUps(args)?
    result = {
      ...result,
      ...getUtmUpsLowerRight(utmUpsParts, !isLocationTypeUtmUps(args)),
    }
  }

  if (isLocationTypeUtmUps() && drawing) {
    repositionLatLon(args)
  }

  const lat = (north + south) / 2
  const lon = (east + west) / 2
  if (isInUpsSpace(lat, lon)) {
    return {
      ...result,
      usngbb: undefined,
    }
  }

  const usngsStr = converter.LLBboxtoUSNG(north, south, east, west)

  result = {
    ...result,
    usngbb: usngsStr,
  }

  if (locationType === usngLocationType && drawing) {
    result = {
      ...result,
      ...repositionLatLon(args),
    }
  }

  return result
}

// Format the internal representation of UTM/UPS coordinates into the form expected by the model.
const formatUtmUps = utmUps => {
  console.log('location-old:formatUtmUps(): Starting')

  return {
    easting: utmUps.easting,
    northing: utmUps.northing,
    zoneNumber: utmUps.zoneNumber,
    hemisphere:
      utmUps.hemisphere === 'NORTHERN'
        ? 'Northern'
        : utmUps.hemisphere === 'SOUTHERN'
        ? 'Southern'
        : undefined,
  }
}

const repositionLatLonUtmUps = ({ isDefined, parse, assign, clear }, args) => {
  console.log('location-old:repositionLatLonUtmUps(): Starting')

  if (!isDefined(args)) {
    return
  }

  const utmUpsParts = parse(args)

  if (utmUpsParts === undefined) {
    return
  }

  const result = utmUpstoLL(utmUpsParts)

  if (result !== undefined) {
    clear(args)
    return
  }

  const newResult = {}
  return assign(newResult, result.lat, result.lon)
}

// Return true if all of the UTM/UPS upper-left model fields are defined. Otherwise, false.
const isUtmUpsUpperLeftDefined = args => {
  return (
    args.utmUpsUpperLeftEasting !== undefined &&
    args.utmUpsUpperLeftNorthing !== undefined &&
    args.utmUpsUpperLeftZone !== undefined &&
    args.utmUpsUpperLeftHemisphere !== undefined
  )
}

// Return true if all of the UTM/UPS lower-right model fields are defined. Otherwise, false.
const isUtmUpsLowerRightDefined = args => {
  return (
    args.utmUpsLowerRightEasting !== undefined &&
    args.utmUpsLowerRightNorthing !== undefined &&
    args.utmUpsLowerRightZone !== undefined &&
    args.utmUpsLowerRightHemisphere !== undefined
  )
}

// Return true if all of the UTM/UPS point radius model fields are defined. Otherwise, false.
const isUtmUpsPointRadiusDefined = args => {
  return (
    args.utmUpsEasting !== undefined &&
    args.utmUpsNorthing !== undefined &&
    args.utmUpsZone !== undefined &&
    args.utmUpsHemisphere !== undefined
  )
}

// Get the UTM/UPS Upper-Left bounding box fields in the internal format. See 'parseUtmUps'.
const parseUtmUpsUpperLeft = args => {
  return parseUtmUps(
    args.utmUpsUpperLeftEasting,
    args.utmUpsUpperLeftNorthing,
    args.utmUpsUpperLeftZone,
    args.utmUpsUpperLeftHemisphere
  )
}

// Get the UTM/UPS Lower-Right bounding box fields in the internal format. See 'parseUtmUps'.
const parseUtmUpsLowerRight = args => {
  return parseUtmUps(
    args.utmUpsLowerRightEasting,
    args.utmUpsLowerRightNorthing,
    args.utmUpsLowerRightZone,
    args.utmUpsLowerRightHemisphere
  )
}

// Get the UTM/UPS point radius fields in the internal format. See 'parseUtmUps'.
const parseUtmUpsPointRadius = args => {
  return parseUtmUps(
    args.utmUpsEasting,
    args.utmUpsNorthing,
    args.utmUpsZone,
    args.utmUpsHemisphere
  )
}

const clearUtmUpsUpperLeft = silent => {
  return {
    utmUpsUpperLeftEasting: undefined,
    utmUpsUpperLeftNorthing: undefined,
    utmUpsUpperLeftZone: 1,
    utmUpsUpperLeftHemisphere: 'Northern',
  }
}

const clearUtmUpsLowerRight = silent => {
  return {
    utmUpsLowerRightEasting: undefined,
    utmUpsLowerRightNorthing: undefined,
    utmUpsLowerRightZone: 1,
    utmUpsLowerRightHemisphere: 'Northern',
  }
}

const getBboxDmsFromMap = args => {
  console.log('location-old:getBboxDmsFromMap(): Starting')

  const { mapNorth, mapSouth, mapWest, mapEast } = args
  const { dmsNorth, dmsSouth, dmsWest, dmsEast } = args

  const localDmsNorth = dmsUtils.ddToDmsCoordinateLat(
    mapNorth,
    dmsUtils.getSecondsPrecision(dmsNorth)
  )
  const localDmsSouth = dmsUtils.ddToDmsCoordinateLat(
    mapSouth,
    dmsUtils.getSecondsPrecision(dmsSouth)
  )
  const localDmsWest = dmsUtils.ddToDmsCoordinateLon(
    mapWest,
    dmsUtils.getSecondsPrecision(dmsWest)
  )
  const localDmsEast = dmsUtils.ddToDmsCoordinateLon(
    mapEast,
    dmsUtils.getSecondsPrecision(dmsEast)
  )
  return {
    dmsNorth: (localDmsNorth && localDmsNorth.coordinate) || '',
    dmsNorthDirection:
      (localDmsNorth && localDmsNorth.direction) || Direction.North,
    dmsSouth: (localDmsSouth && localDmsSouth.coordinate) || '',
    dmsSouthDirection:
      (localDmsSouth && localDmsSouth.direction) || Direction.North,
    dmsWest: (localDmsWest && localDmsWest.coordinate) || '',
    dmsWestDirection:
      (localDmsWest && localDmsWest.direction) || Direction.East,
    dmsEast: (localDmsEast && localDmsEast.coordinate) || '',
    dmsEastDirection:
      (localDmsEast && localDmsEast.direction) || Direction.East,
  }
}

const getRadiusDmsFromMap = args => {
  console.log('location-old:getRadiusDmsFromMap(): Starting')

  const { lat, lon, dmsLat, dmsLon } = args
  const dmsLatitude = dmsUtils.ddToDmsCoordinateLat(
    lat,
    dmsUtils.getSecondsPrecision(dmsLat)
  )
  const dmsLongitude = dmsUtils.ddToDmsCoordinateLon(
    lon,
    dmsUtils.getSecondsPrecision(dmsLon)
  )
  return {
    dmsLat: (dmsLatitude && dmsLatitude.coordinate) || '',
    dmsLatDirection: (dmsLatitude && dmsLatitude.direction) || Direction.North,
    dmsLon: (dmsLongitude && dmsLongitude.coordinate) || '',
    dmsLonDirection: (dmsLongitude && dmsLongitude.direction) || Direction.East,
  }
}

const handleLocationType = args => {
  console.log('location-old:handleLocationType(): Starting')

  const { locationType, mapNorth, mapSouth, mapEast, mapWest } = args
  if (locationType === 'latlon') {
    return {
      north: mapNorth,
      south: mapSouth,
      east: mapEast,
      west: mapWest,
    }
  } else if (locationType === 'dms') {
    return {
      ...getBboxDmsFromMap(args),
      ...getRadiusDmsFromMap(args),
    }
  }
}

const getBboxUsng = args => {
  console.log('location-old:getBboxUsng(): Starting')

  const { locationType, usngbb } = args
  if (locationType !== usngLocationType) {
    return
  }

  let result
  try {
    result = converter.USNGtoLL(usngbb)
  } catch (err) {}

  if (result === undefined) {
    return
  }

  let newResult = {
    mapNorth: result.north,
    mapSouth: result.south,
    mapEast: result.east,
    mapWest: result.west,
  }

  newResult = {
    ...newResult,
    ...result,
  }

  let utmUps = LLtoUtmUps(result.north, result.west)
  if (utmUps !== undefined) {
    let utmUpsFormatted = formatUtmUps(utmUps)
    newResult = {
      ...newResult,
      ...getUtmUpsUpperLeft(utmUpsFormatted, true),
    }
  }

  utmUps = LLtoUtmUps(result.south, result.east)
  if (utmUps !== undefined) {
    let utmUpsFormatted = formatUtmUps(utmUps)
    newResult = {
      ...newResult,
      ...getUtmUpsLowerRight(utmUpsFormatted, true),
    }
  }
  return newResult
}

// Set the model fields for the Point Radius UTM/UPS. The arguments are:
//
//   utmUpsFormatted : output from the method 'formatUtmUps'
//   silent       : BOOLEAN (true if events should be generated)
const getUtmUpsPointRadius = (utmUpsFormatted, silent) => {
  return {
    utmUpsEasting: utmUpsFormatted.easting,
    utmUpsNorthing: utmUpsFormatted.northing,
    utmUpsZone: utmUpsFormatted.zoneNumber,
    utmUpsHemisphere: utmUpsFormatted.hemisphere,
  }
}

const getRadiusUsng = args => {
  console.log('location-old:getRadiusUsng(): Starting')

  const { usng } = args
  if (usng === undefined) {
    return
  }

  let result
  try {
    result = converter.USNGtoLL(usng, true)
  } catch (err) {}

  if (!isNaN(result.lat) && !isNaN(result.lon)) {
    const utmUps = LLtoUtmUps(result.lat, result.lon)
    if (utmUps !== undefined) {
      const utmUpsParts = formatUtmUps(utmUps)
      result = {
        ...result,
        ...getUtmUpsPointRadius(utmUpsParts, true),
      }
    }
  } else {
    result = {
      ...result,
      ...clearUtmUpsPointRadius(true),
      usng: undefined,
      lat: undefined,
      lon: undefined,
      radius: 1,
    }
  }
  return result
}

const clearUtmUpsPointRadius = silent => {
  return {
    utmUpsEasting: undefined,
    utmUpsNorthing: undefined,
    utmUpsZone: 1,
    utmUpsHemisphere: 'Northern',
  }
}

// Parse the UTM/UPS fields that come from the HTML layer. The parameters eastingRaw and northingRaw
// are string representations of floating pointnumbers. The zoneRaw parameter is a string
// representation of an integer in the range [0,60]. The hemisphereRaw parameters is a string
// that should be 'Northern' or 'Southern'.
const parseUtmUps = (eastingRaw, northingRaw, zoneRaw, hemisphereRaw) => {
  console.log('location-old:parseUtmUps(): Starting')

  const easting = parseFloat(eastingRaw)
  const northing = parseFloat(northingRaw)
  const zone = parseInt(zoneRaw)
  const hemisphere =
    hemisphereRaw === 'Northern'
      ? 'NORTHERN'
      : hemisphereRaw === 'Southern'
      ? 'SOUTHERN'
      : undefined

  if (
    !isNaN(easting) &&
    !isNaN(northing) &&
    !isNaN(zone) &&
    hemisphere !== undefined &&
    zone >= 0 &&
    zone <= 60
  ) {
    return {
      zoneNumber: zone,
      hemisphere,
      easting,
      northing,
    }
  }
}

// This method is called when the UTM/UPS point radius coordinates are changed by the user.
const getRadiusUtmUps = args => {
  console.log('location-old:getRadiusUtmUps(): Starting')

  if (!isLocationTypeUtmUps(args) && !isUtmUpsPointRadiusDefined(args)) {
    return
  }

  const utmUpsParts = parseUtmUpsPointRadius(args)
  if (utmUpsParts === undefined) {
    return
  }

  let result = {}
  const utmUpsResult = utmUpstoLL(utmUpsParts)
  if (utmUpsResult === undefined) {
    if (utmUpsParts.zoneNumber !== 0) {
      result = {
        ...result,
        ...clearUtmUpsPointRadius(true),
      }
    }
    result = {
      ...result,
      lat: undefined,
      lon: undefined,
      usng: undefined,
      radius: 1,
    }
    return result
  }

  result = {
    ...result,
    ...utmUpsResult,
  }

  const { lat, lon } = utmUpsResult
  if (!isLatLonValid(lat, lon) || isInUpsSpace(lat, lon)) {
    return {
      ...result,
      usng: undefined,
    }
  }

  const usngsStr = converter.LLtoUSNG(lat, lon, usngPrecision)

  return {
    ...result,
    usng: usngsStr,
  }
  //  this.set('usng', usngsStr, { silent: true })
}

// This method is called when the UTM/UPS bounding box coordinates are changed by the user.
const getBboxUtmUps = args => {
  console.log('location-old:getBboxUtmUps(): Starting')

  if (!isLocationTypeUtmUps(args)) {
    return
  }
  let upperLeft = undefined
  let lowerRight = undefined

  let result = {}
  if (isUtmUpsUpperLeftDefined(args)) {
    const upperLeftParts = parseUtmUpsUpperLeft(args)
    if (upperLeftParts !== undefined) {
      upperLeft = utmUpstoLL(upperLeftParts)

      if (upperLeft !== undefined) {
        result = {
          ...result,
          mapNorth: upperLeft.lat,
          mapWest: upperLeft.lon,
          north: upperLeft.lat,
          west: upperLeft.lon,
        }
        // this.set({ mapNorth: upperLeft.lat, mapWest: upperLeft.lon })
        // this.set(
        //   { north: upperLeft.lat, west: upperLeft.lon },
        //   { silent: true }
        // )
      } else {
        if (upperLeftParts.zoneNumber !== 0) {
          result = {
            ...result,
            ...clearUtmUpsUpperLeft(true),
          }
        }
        upperLeft = undefined
        result = {
          ...result,
          mapNorth: undefined,
          mapSouth: undefined,
          mapEast: undefined,
          mapWest: undefined,
          usngbb: undefined,
        }
      }
    }
  }

  if (isUtmUpsLowerRightDefined(args)) {
    const lowerRightParts = parseUtmUpsLowerRight(args)
    if (lowerRightParts !== undefined) {
      lowerRight = utmUpstoLL(lowerRightParts)

      if (lowerRight !== undefined) {
        result = {
          ...result,
          mapSouth: lowerRight.lat,
          mapEast: lowerRight.lon,
          south: lowerRight.lat,
          east: lowerRight.lon,
        }
        // this.set({ mapSouth: lowerRight.lat, mapEast: lowerRight.lon })
        // this.set(
        //   { south: lowerRight.lat, east: lowerRight.lon },
        //   { silent: true }
        // )
      } else {
        if (lowerRightParts.zoneNumber !== 0) {
          result = {
            ...result,
            ...clearUtmUpsLowerRight(true),
          }
        }
        lowerRight = undefined
        result = {
          ...result,
          mapNorth: undefined,
          mapSouth: undefined,
          mapEast: undefined,
          mapWest: undefined,
          usngbb: undefined,
        }
      }
    }
  }

  if (upperLeft === undefined || lowerRight == undefined) {
    return result
  }

  const lat = (upperLeft.lat + lowerRight.lat) / 2
  const lon = (upperLeft.lon + lowerRight.lon) / 2

  if (!isLatLonValid(lat, lon) || isInUpsSpace(lat, lon)) {
    return {
      ...result,
      usngbb: undefined,
    }
  }

  const usngsStr = converter.LLBboxtoUSNG(
    upperLeft.lat,
    lowerRight.lat,
    lowerRight.lon,
    upperLeft.lon
  )
  return {
    ...result,
    usngbb: usngsStr,
  }
  // this.set('usngbb', usngsStr, {
  //   silent: this.get('locationType') === 'usng',
  // })
}

const notDrawing = args => {
  const { prevLocationType } = args
  let result
  if (prevLocationType === 'utmUps') {
    result = {
      prevLocationType: '',
      locationType: utmUps,
    }
  }

  //  TODO: Come back to this.
  this.drawing = false
  store.get('content').turnOffDrawing()

  return result
}

const drawingOn = args => {
  const { locationType } = args
  let result
  if (locationType === 'utmUps') {
    result = {
      prevLocationType: 'utmUps',
      locationType: 'latlon',
    }
  }

  //  TODO: Come back to this.
  this.drawing = true
  store.get('content').turnOnDrawing(this)

  return result
}

// const setLatLonUtmUps = ({ result, isDefined, parse, assign, clear }, args) => {
//     console.log('location-old:setLatLonUtmUps(): Starting')

//   if (
//     !(
//       result.north !== undefined &&
//       result.south !== undefined &&
//       result.west !== undefined &&
//       result.east !== undefined
//     ) &&
//     isDefined(args)
//   ) {
//     //  TODO what fuk?
//     const utmUpsParts = parse(_this)
//     if (utmUpsParts !== undefined) {
//       const utmUpsResult = utmUpstoLL(utmUpsParts)

//       if (utmUpsResult !== undefined) {
//         return assign(result, utmUpsResult.lat, utmUpsResult.lon)
//       } else {
//         return clear(args)
//       }
//     }
//   }
// }

const getRadiusLatLon = args => {
  console.log('location-old:getRadiusLatLon(): Starting')

  const { lat, lon, locationType } = args

  if (
    (!store.get('content').get('drawing') && locationType !== 'latlon') ||
    !isLatLonValid(lat, lon)
  ) {
    return
  }

  let result = getRadiusDmsFromMap(args)

  const utmUps = LLtoUtmUps(lat, lon)
  if (utmUps !== undefined) {
    const utmUpsParts = formatUtmUps(utmUps)
    result = {
      ...result,
      ...getUtmUpsPointRadius(utmUpsParts, true),
    }
  } else {
    result = {
      ...result,
      ...clearUtmUpsPointRadius(false),
    }
  }

  if (isInUpsSpace(lat, lon)) {
    result = {
      ...result,
      usng: undefined,
    }
    return result
  }

  const usngsStr = converter.LLtoUSNG(lat, lon, usngPrecision)
  return {
    ...result,
    usng: usngsStr,
  }
}

export {
  convertToValid,
  repositionLatLon,
  getBboxLatLon,
  getRadiusLatLon,
  setRadiusDmsLat,
  setRadiusDmsLon,
  getBboxUsng,
  getBBox,
  getRadiusUsng,
  getRadiusUtmUps,
  getBboxUtmUps,
  setLatLonFromDms,
  getBboxDmsFromMap,
  getRadiusDmsFromMap,
  handleLocationType,
}
