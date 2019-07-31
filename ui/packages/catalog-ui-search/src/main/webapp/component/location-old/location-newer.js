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

const convertBboxLLtoMap = (north, south, west, east) => {
  return {
    mapNorth: north,
    mapSouth: south,
    mapWest: west,
    mapEast: east,
  }
}

const setLatLonFromDms = (
  dmsCoordinateKey,
  dmsDirectionKey,
  latLonKey,
  args
) => {
  const coord = {}
  coord.coordinate = args[dmsCoordinateKey]

  const isDmsInputIncomplete =
    coord.coordinate && coord.coordinate.includes('_')
  if (isDmsInputIncomplete) {
    return
  }

  coord.direction = args[dmsDirectionKey]

  const dmsCoordinate = dmsUtils.parseDmsCoordinate(coord)
  let result = {}
  if (dmsCoordinate) {
    result[latLonKey] = dmsUtils.dmsCoordinateToDD(dmsCoordinate)
  } else {
    result[latLonKey] = undefined
  }
  return result
}

// Return true if the current location type is UTM/UPS, otherwise false.
const isLocationTypeUtmUps = ({ locationType }) => {
  console.log('location-old:isLocationTypeUtmUps(): Starting')

  return locationType === utmUpsLocationType
}

const getBBox = args => {
  console.log('location-old:getBBox(): Starting')

  const { locationType, north, south, west, east } = args
  const { mode } = args
  console.log(mode)

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
      ...convertBboxLLtoMap(north, south, west, east),
    }
  }
  return {
    ...result,
    ...getBboxLatLon(args),
  }
}

// const getLatLonFromDms = (dmsCoordinate, dmsDirection) => {
//   console.log('location-old:getLatLonFromDms(): Starting')

//   const coordinate = {}
//   coordinate.coordinate = dmsCoordinate

//   const isDmsInputIncomplete =
//     coordinate.coordinate && coordinate.coordinate.includes('_')
//   if (isDmsInputIncomplete) {
//     return
//   }

//   coordinate.direction = dmsDirection

//   const temp = dmsUtils.parseDmsCoordinate(coordinate)

//   if (temp) {
//     dmsUtils.dmsCoordinateToDD(temp)
//   }
// }
// const setBboxDmsNorth = args => {
//   return {
//     north: getLatLonFromDms(args.dmsNorth, args.dmsNorthDirection),
//   }
// }

// const setBboxDmsSouth = args => {
//   return {
//     south: getLatLonFromDms(args.dmsSouth, args.dmsSouthDirection),
//   }
// }

// const setBboxDmsEast = args => {
//   return {
//     east: getLatLonFromDms(args.dmsEast, args.dmsEastDirection),
//   }
// }

// const setBboxDmsWest = args => {
//   return {
//     west: getLatLonFromDms(args.dmsWest, args.dmsWestDirection),
//   }
// }

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
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
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

const handleLLtoUtmUps = (lat, lon, args, fn) => {
  let utmUps = LLtoUtmUps(lat, lon)
  if (utmUps !== undefined) {
    const utmUpsParts = formatUtmUps(utmUps)
    return fn(utmUpsParts, !isLocationTypeUtmUps(args))
  }
}

//  dmsCoordinateKey: dmsNorth, dmsSouth...
//  dmsDirectionKey: dmsNorthDirection...
//  directionKey: Direction.North, Direction.South,
//  directionVal: number
const convertLLtoDms = (
  dmsCoordinateKey,
  dmsDirectionKey,
  directionKey,
  directionVal
) => {
  let result = {}
  let localDir
  if (directionKey === Direction.North || directionKey === Direction.South) {
    localDir = dmsUtils.ddToDmsCoordinateLat(directionVal)
  } else if (
    directionKey === Direction.East ||
    directionKey === Direction.West
  ) {
    localDir = dmsUtils.ddToDmsCoordinateLon(directionVal)
  } else {
    throw new TypeError(`directionKey '${directionKey}' is not N, S, E, or W`)
  }

  result[dmsCoordinateKey] = (localDir && localDir.coordinate) || ''
  result[dmsDirectionKey] = (localDir && localDir.direction) || directionKey
  return result
}

const convertBboxLLtoUSNG = (north, south, west, east) => {
  const lat = (north + south) / 2
  const lon = (east + west) / 2
  if (isInUpsSpace(lat, lon)) {
    return {
      usngbb: undefined,
    }
  }

  const usngsStr = converter.LLBboxtoUSNG(north, south, east, west)

  return {
    usngbb: usngsStr,
  }
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

  const localDmsNorth = dmsUtils.xc(
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
  console.error('locatioxn-old:getRadiusDmsFromMap(): Starting')

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
  // console.log('location-old:handleLocationType(): Starting')
  // const { locationType, mapNorth, mapSouth, mapEast, mapWest } = args
  // if (locationType === 'latlon') {
  //   return {
  //     north: mapNorth,
  //     south: mapSouth,
  //     east: mapEast,
  //     west: mapWest,
  //   }
  // } else if (locationType === 'dms') {
  //   return {
  //     ...getBboxDmsFromMap(args),
  //     ...getRadiusDmsFromMap(args),
  //   }
  // }
}

const convertLLBboxtoUtmUps = (north, south, west, east) => {
  let result = {}

  let utmUps = LLtoUtmUps(north, west)
  if (utmUps !== undefined) {
    let utmUpsFormatted = formatUtmUps(utmUps)
    result = {
      ...result,
      ...getUtmUpsUpperLeft(utmUpsFormatted, true),
    }
  }

  utmUps = LLtoUtmUps(south, east)
  if (utmUps !== undefined) {
    let utmUpsFormatted = formatUtmUps(utmUps)
    result = {
      ...result,
      ...getUtmUpsLowerRight(utmUpsFormatted, true),
    }
  }

  return result
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

const setLatLonUtmUps = ({ result, isDefined, parse, assign, clear }, args) => {
  console.log('location-old:setLatLonUtmUps(): Starting')

  if (
    !(
      result.north !== undefined &&
      result.south !== undefined &&
      result.west !== undefined &&
      result.east !== undefined
    ) &&
    isDefined(args)
  ) {
    const utmUpsParts = parse(args)

    if (utmUpsParts == undefined) {
      return
    }

    const utmUpsResult = utmUpstoLL(utmUpsParts)

    if (utmUpsResult !== undefined) {
      return assign(result, utmUpsResult.lat, utmUpsResult.lon)
    } else {
      return clear(args)
    }
  }
}

const setBboxDmsFromMap = args => {
  const dmsNorth = dmsUtils.ddToDmsCoordinateLat(
    args.mapNorth,
    dmsUtils.getSecondsPrecision(args.dmsNorth)
  )
  const dmsSouth = dmsUtils.ddToDmsCoordinateLat(
    args.mapSouth,
    dmsUtils.getSecondsPrecision(args.dmsSouth)
  )
  const dmsWest = dmsUtils.ddToDmsCoordinateLon(
    args.mapWest,
    dmsUtils.getSecondsPrecision(args.dmsWest)
  )
  const dmsEast = dmsUtils.ddToDmsCoordinateLon(
    args.mapEast,
    dmsUtils.getSecondsPrecision(args.dmsEast)
  )
  return {
    dmsNorth: (dmsNorth && dmsNorth.coordinate) || '',
    dmsNorthDirection: (dmsNorth && dmsNorth.direction) || Direction.North,
    dmsSouth: (dmsSouth && dmsSouth.coordinate) || '',
    dmsSouthDirection: (dmsSouth && dmsSouth.direction) || Direction.North,
    dmsWest: (dmsWest && dmsWest.coordinate) || '',
    dmsWestDirection: (dmsWest && dmsWest.direction) || Direction.East,
    dmsEast: (dmsEast && dmsEast.coordinate) || '',
    dmsEastDirection: (dmsEast && dmsEast.direction) || Direction.East,
  }
}

const getLatLon = args => {
  const { locationType, mapNorth, mapSouth, mapWest, mapEast, usngbb } = args
  if (locationType === 'latlon') {
    let result = {}
    result.north = mapNorth
    result.south = mapSouth
    result.west = mapWest
    result.east = mapEast
    if (
      !(
        result.north !== undefined &&
        result.south !== undefined &&
        result.west !== undefined &&
        result.east !== undefined
      ) &&
      usngbb
    ) {
      try {
        result = converter.USNGtoLL(usngbb)
      } catch (err) {}
    }

    result = {
      ...result,
      ...setLatLonUtmUps(
        {
          result: result,
          isDefined: isUtmUpsUpperLeftDefined,
          parse: parseUtmUpsUpperLeft,
          assign: (result, lat, lon) => {
            result.north = lat
            result.west = lon
          },
          clear: clearUtmUpsUpperLeft,
        },
        args
      ),
    }

    result = {
      ...result,
      ...setBboxDmsSouth,
      ...setLatLonUtmUps(
        {
          result: result,
          isDefined: isUtmUpsLowerRightDefined,
          parse: parseUtmUpsLowerRight,
          assign: (result, lat, lon) => {
            result.south = lat
            result.east = lon
          },
          clear: clearUtmUpsLowerRight,
        },
        args
      ),
    }

    result.north = DistanceUtils.coordinateRound(result.north)
    result.east = DistanceUtils.coordinateRound(result.east)
    result.south = DistanceUtils.coordinateRound(result.south)
    result.west = DistanceUtils.coordinateRound(result.west)
    return result
  } else if (locationType === 'dms') {
    return setBboxDmsFromMap(args)
  }
}

/* * * * * * * * * * * * * * *
 * Circle
 */
const getRadiusLatLon = args => {
  console.log('location-old:getRadiusLatLon(): Starting')

  const { lat, lon } = args

  if (!isLatLonValid(lat, lon)) {
    return
  }

  let utmUpsObj = {}

  const utmUps = LLtoUtmUps(lat, lon)
  if (utmUps !== undefined) {
    const utmUpsParts = formatUtmUps(utmUps)
    utmUpsObj = getUtmUpsPointRadius(utmUpsParts, true)
  } else {
    utmUpsObj = clearUtmUpsPointRadius(false)
  }

  const usngsStr = isInUpsSpace(lat, lon)
    ? undefined
    : converter.LLtoUSNG(lat, lon, usngPrecision)

  return {
    ...utmUpsObj,
    ...getRadiusDmsFromMap(args),
    usng: usngsStr,
  }
}

const getRadiusDms = args => {
  let latlon = {
    ...setLatLonFromDms('dmsLon', 'dmsLonDirection', 'lon', args),
    ...setLatLonFromDms('dmsLat', 'dmsLatDirection', 'lat', args),
  }

  //  doesn't convert to anything else

  console.log('getRadiusDms(): returning...')
  console.log(latlon)
  return latlon
}

const getRadiusUsng = args => {
  console.log('location-old:getRadiusUsng(): Starting')

  const { usng } = args
  if (usng === undefined) {
    return
  }

  //  doesn't convert to dms

  let latlon
  let result
  try {
    latlon = converter.USNGtoLL(usng, true)
  } catch (err) {}

  if (!isNaN(latlon.lat) && !isNaN(latlon.lon)) {
    const utmUps = LLtoUtmUps(latlon.lat, latlon.lon)
    if (utmUps !== undefined) {
      const utmUpsParts = formatUtmUps(utmUps)
      result = {
        ...latlon,
        ...getUtmUpsPointRadius(utmUpsParts, true),
      }
    }
  } else {
    result = {
      ...clearUtmUpsPointRadius(true),
      usng: undefined,
      lat: undefined,
      lon: undefined,
      radius: 1,
    }
  }
  return result
}

// This method is called when the UTM/UPS point radius coordinates are changed by the user.
const getRadiusUtmUps = args => {
  console.log('location-old:getRadiusUtmUps(): Starting')

  if (!isUtmUpsPointRadiusDefined(args)) {
    return
  }

  const utmUpsParts = parseUtmUpsPointRadius(args)
  if (utmUpsParts === undefined) {
    return
  }

  let result = {}
  const latlon = utmUpstoLL(utmUpsParts)
  if (latlon === undefined) {
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

  const { lat, lon } = latlon
  const usngsStr =
    !isLatLonValid(lat, lon) || isInUpsSpace(lat, lon)
      ? undefined
      : converter.LLtoUSNG(lat, lon, usngPrecision)

  return {
    ...latlon,
    ...result,
    usng: usngsStr,
  }
}

const getRadiusDrawing = args => {
  console.log('getRadiusDrawing(): TODO')
}

/* * * * * * * * * * * * * * *
 * Bbox
 */

const getBboxLatLon = args => {
  const { north, south, west, east, drawing, locationType } = args
  console.log(
    `getBboxLatLon(${north}, ${south}, ${west}, ${east}, ${drawing}, ${locationType}): starting...`
  )

  if (!isLatLonValid(north, west) || !isLatLonValid(south, east)) {
    console.log('getBboxLatLon(): latLon is invalid...')
    return
  }

  let result = {
    ...convertLLtoDms('dmsNorth', 'dmsNorthDirection', Direction.North, north),
    ...convertLLtoDms('dmsSouth', 'dmsSouthDirection', Direction.South, south),
    ...convertLLtoDms('dmsEast', 'dmsEastDirection', Direction.East, east),
    ...convertLLtoDms('dmsWest', 'dmsWestDirection', Direction.West, west),
    ...handleLLtoUtmUps(north, west, args, getUtmUpsUpperLeft),
    ...handleLLtoUtmUps(south, east, args, getUtmUpsLowerRight),
    ...convertBboxLLtoUSNG(north, south, west, east),
    ...convertBboxLLtoMap(north, south, west, east),
  }

  // if (locationType === usngLocationType && drawing) {
  //   result = {
  //     ...result,
  //     ...repositionLatLon(args),
  //   }
  // }

  console.log('getBboxLatLon(): returning:')
  console.log(result)
  return result
}

const getBboxDms = args => {
  //  Convert Dms to LatLon
  const latlon = {
    ...setLatLonFromDms('dmsNorth', 'dmsNorthDirection', 'north', args),
    ...setLatLonFromDms('dmsSouth', 'dmsSouthDirection', 'south', args),
    ...setLatLonFromDms('dmsEast', 'dmsEastDirection', 'east', args),
    ...setLatLonFromDms('dmsWest', 'dmsWestDirection', 'west', args),
  }

  const { north, south, west, east } = latlon

  return {
    ...latlon,
    ...handleLLtoUtmUps(north, west, args, getUtmUpsUpperLeft),
    ...handleLLtoUtmUps(south, east, args, getUtmUpsLowerRight),
    ...convertBboxLLtoUSNG(north, south, west, east),
    ...convertBboxLLtoMap(north, south, west, east),
  }
}

const getBboxUsng = args => {
  console.log('location-old:getBboxUsng(): Starting')

  const { usngbb } = args

  let latlon
  try {
    latlon = converter.USNGtoLL(usngbb)
  } catch (err) {}

  if (latlon === undefined) {
    return
  }

  const { north, south, west, east } = latlon

  return {
    ...latlon,
    ...convertLLBboxtoUtmUps(north, south, west, east),
    ...convertLLtoDms('dmsNorth', 'dmsNorthDirection', Direction.North, north),
    ...convertLLtoDms('dmsSouth', 'dmsSouthDirection', Direction.South, south),
    ...convertLLtoDms('dmsEast', 'dmsEastDirection', Direction.East, east),
    ...convertLLtoDms('dmsWest', 'dmsWestDirection', Direction.West, west),
    ...convertBboxLLtoMap(north, south, west, east),
  }
}

// This method is called when the UTM/UPS bounding box coordinates are changed by the user.
const getBboxUtmUps = args => {
  console.log('location-old:getBboxUtmUps(): Starting')

  let upperLeft = undefined
  let lowerRight = undefined

  let latlon = {}
  let clearedUtmUps = {}

  //  convert to LatLon
  if (isUtmUpsUpperLeftDefined(args)) {
    const upperLeftParts = parseUtmUpsUpperLeft(args)
    if (upperLeftParts !== undefined) {
      upperLeft = utmUpstoLL(upperLeftParts)

      if (upperLeft !== undefined) {
        latlon = {
          north: upperLeft.lat,
          west: upperLeft.lon,
        }
      }
      // else {
      //   if (upperLeftParts.zoneNumber !== 0) {
      //     clearedUtmUps = {
      //       ...clearUtmUpsUpperLeft(true),
      //     }
      //   }
      //   upperLeft = undefined
      //   clearedUtmUps = {
      //     ...clearedUtmUps,
      //     mapNorth: undefined,
      //     mapSouth: undefined,
      //     mapEast: undefined,
      //     mapWest: undefined,
      //     usngbb: undefined,
      //   }
      // }
    }
  }

  if (isUtmUpsLowerRightDefined(args)) {
    const lowerRightParts = parseUtmUpsLowerRight(args)
    if (lowerRightParts !== undefined) {
      lowerRight = utmUpstoLL(lowerRightParts)

      if (lowerRight !== undefined) {
        latlon = {
          ...latlon,
          south: lowerRight.lat,
          east: lowerRight.lon,
        }
      }
      // else {
      //   if (lowerRightParts.zoneNumber !== 0) {
      //     clearedUtmUps = {
      //       ...clearedUtmUps,
      //       ...clearUtmUpsLowerRight(true),
      //     }
      //   }
      //   lowerRight = undefined
      //   clearedUtmUps = {
      //     ...clearedUtmUps,
      //     mapNorth: undefined,
      //     mapSouth: undefined,
      //     mapEast: undefined,
      //     mapWest: undefined,
      //     usngbb: undefined,
      //   }
      // }
    }
  }

  const { north, south, west, east } = latlon

  //  If we couldn't convert to LL then return
  if (upperLeft === undefined || lowerRight == undefined) {
    return {
      ...latlon,
      ...clearedUtmUps,
    }
  }

  const lat = (upperLeft.lat + lowerRight.lat) / 2
  const lon = (upperLeft.lon + lowerRight.lon) / 2

  const usngsStr =
    !isLatLonValid(lat, lon) || isInUpsSpace(lat, lon)
      ? undefined
      : converter.LLBboxtoUSNG(
          upperLeft.lat,
          lowerRight.lat,
          lowerRight.lon,
          upperLeft.lon
        )
  return {
    ...latlon,
    ...convertLLtoDms('dmsNorth', 'dmsNorthDirection', Direction.North, north),
    ...convertLLtoDms('dmsSouth', 'dmsSouthDirection', Direction.South, south),
    ...convertLLtoDms('dmsEast', 'dmsEastDirection', Direction.East, east),
    ...convertLLtoDms('dmsWest', 'dmsWestDirection', Direction.West, west),
    ...convertBboxLLtoMap(north, south, west, east),
    usngbb: usngsStr,
  }
}

/* * * * * * * * * * * * * * *
 * dispatch
 */

const dispatch = {
  line: {},
  poly: {},
  circle: {
    latlon: getRadiusLatLon,
    dms: getRadiusDms,
    usng: getRadiusUsng,
    utmUps: getRadiusUtmUps,
    drawing: getRadiusDrawing,
  },
  bbox: {
    latlon: getBboxLatLon,
    dms: getBboxDms,
    usng: getBboxUsng,
    utmUps: getBboxUtmUps,
    drawing: getBboxLatLon,
  },
  keyword: {},
}

const convert = (args, isDrawing) => {
  const mode = dispatch[args.mode]
  const location = mode[args.locationType]

  //  If we're drawing always return what we're drawing
  if (isDrawing) {
    return mode.drawing(args)
  }

  if (typeof location === 'function') {
    return location(args)
  }
}

export {
  convert,
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
  getLatLon,
}
