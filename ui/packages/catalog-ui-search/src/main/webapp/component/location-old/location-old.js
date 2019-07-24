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
/* eslint-disable no-var */

const _ = require('underscore')
const Backbone = require('backbone')
const store = require('../../js/store.js')
const Common = require('../../js/Common.js')
const dmsUtils = require('../location-new/utils/dms-utils.js')
const {
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
} = require('./location-newer.js')

const Direction = dmsUtils.Direction

module.exports = Backbone.AssociatedModel.extend({
  defaults: {
    drawing: false,
    north: undefined,
    east: undefined,
    south: undefined,
    west: undefined,
    dmsNorth: '',
    dmsSouth: '',
    dmsEast: '',
    dmsWest: '',
    dmsNorthDirection: Direction.North,
    dmsSouthDirection: Direction.North,
    dmsEastDirection: Direction.East,
    dmsWestDirection: Direction.East,
    mapNorth: undefined,
    mapEast: undefined,
    mapWest: undefined,
    mapSouth: undefined,
    radiusUnits: 'meters',
    radius: 1,
    locationType: 'latlon',
    prevLocationType: 'latlon',
    lat: undefined,
    lon: undefined,
    dmsLat: '',
    dmsLon: '',
    dmsLatDirection: Direction.North,
    dmsLonDirection: Direction.East,
    bbox: undefined,
    usngbb: undefined,
    usng: undefined,
    utmUps: undefined,
    color: undefined,
    line: undefined,
    multiline: undefined,
    lineWidth: 1,
    lineUnits: 'meters',
    polygon: undefined,
    polygonBufferWidth: 0,
    polyType: undefined,
    polygonBufferUnits: 'meters',
    hasKeyword: false,
    keywordValue: undefined,
    utmUpsUpperLeftEasting: undefined,
    utmUpsUpperLeftNorthing: undefined,
    utmUpsUpperLeftHemisphere: 'Northern',
    utmUpsUpperLeftZone: 1,
    utmUpsLowerRightEasting: undefined,
    utmUpsLowerRightNorthing: undefined,
    utmUpsLowerRightHemisphere: 'Northern',
    utmUpsLowerRightZone: 1,
    utmUpsEasting: undefined,
    utmUpsNorthing: undefined,
    utmUpsZone: 1,
    utmUpsHemisphere: 'Northern',
  },
  set(key, value, options) {
    if (!_.isObject(key)) {
      const keyObject = {}
      keyObject[key] = value
      key = keyObject
      value = options
    }
    convertToValid(key, this)
    Backbone.AssociatedModel.prototype.set.call(this, key, value, options)
    Common.queueExecution(() => {
      console.log('change: ' + Object.keys(key))
      this.trigger('change', Object.keys(key))
    })
  },

  initialize() {
    this.listenTo(
      this,
      'change:north change:south change:east change:west',
      this.setBBox
    )
    this.listenTo(
      this,
      'change:dmsNorth change:dmsNorthDirection',
      this.setBboxDmsNorth
    )
    this.listenTo(
      this,
      'change:dmsSouth change:dmsSouthDirection',
      this.setBboxDmsSouth
    )
    this.listenTo(
      this,
      'change:dmsEast change:dmsEastDirection',
      this.setBboxDmsEast
    )
    this.listenTo(
      this,
      'change:dmsWest change:dmsWestDirection',
      this.setBboxDmsWest
    )
    this.listenTo(
      this,
      'change:dmsLat change:dmsLatDirection',
      this.setRadiusDmsLat
    )
    this.listenTo(
      this,
      'change:dmsLon change:dmsLonDirection',
      this.setRadiusDmsLon
    )
    this.listenTo(this, 'change:locationType', this.handleLocationType)
    this.listenTo(this, 'change:bbox', this.setBboxLatLon)
    this.listenTo(this, 'change:lat change:lon', this.setRadiusLatLon)
    this.listenTo(this, 'change:usngbb', this.setBboxUsng)
    this.listenTo(this, 'change:usng', this.setRadiusUsng)
    this.listenTo(
      this,
      'change:utmUpsEasting change:utmUpsNorthing change:utmUpsZone change:utmUpsHemisphere',
      this.setRadiusUtmUps
    )
    this.listenTo(
      this,
      'change:utmUpsUpperLeftEasting change:utmUpsUpperLeftNorthing change:utmUpsUpperLeftZone change:utmUpsUpperLeftHemisphere change:utmUpsLowerRightEasting change:utmUpsLowerRightNorthing change:utmUpsLowerRightZone change:utmUpsLowerRightHemisphere',
      this.setBboxUtmUps
    )
    this.listenTo(this, 'EndExtent', this.notDrawing)
    this.listenTo(this, 'BeginExtent', this.drawingOn)
    if (this.get('color') === undefined && store.get('content').get('query')) {
      this.set(
        'color',
        store
          .get('content')
          .get('query')
          .get('color')
      )
    } else if (this.get('color') === undefined) {
      this.set('color', '#c89600')
    }
  },

  notDrawing() {
    const prevLocationType = this.get('prevLocationType')
    if (prevLocationType === 'utmUps') {
      this.set('prevLocationType', '')
      this.set('locationType', 'utmUps')
    }
    this.drawing = false
    store.get('content').turnOffDrawing()
  },

  drawingOn() {
    const locationType = this.get('locationType')
    if (locationType === 'utmUps') {
      this.set('prevLocationType', 'utmUps')
      this.set('locationType', 'latlon')
    }
    this.drawing = true
    store.get('content').turnOnDrawing(this)
  },

  update(fn, ...args) {
    const value = fn(...args, this.toJSON())
    this.set(value, { silent: true })
  },

  repositionLatLon() {
    this.update(repositionLatLon)
  },

  setBboxLatLon() {
    this.update(getBboxLatLon)
  },

  setRadiusLatLon() {
    this.update(getRadiusLatLon)
  },

  setRadiusDmsLat() {
    this.update(setRadiusDmsLat, 'dmsLat', 'dmsLatDirection', 'lat')
  },

  setRadiusDmsLon() {
    this.update(setRadiusDmsLon, 'dmsLon', 'dmsLonDirection', 'lon')
  },

  setBboxUsng() {
    this.update(getBboxUsng)
  },

  setBBox() {
    this.update(getBBox)
  },

  setRadiusUsng() {
    this.update(getRadiusUsng)
  },

  // This method is called when the UTM/UPS point radius coordinates are changed by the user.
  setRadiusUtmUps() {
    this.update(getRadiusUtmUps)
  },

  // This method is called when the UTM/UPS bounding box coordinates are changed by the user.
  setBboxUtmUps() {
    this.update(getBboxUtmUps)
  },

  setBboxDmsNorth() {
    this.update(setLatLonFromDms, 'dmsNorth', 'dmsNorthDirection', 'north')
  },

  setBboxDmsSouth() {
    this.update(setLatLonFromDms, 'dmsSouth', 'dmsSouthDirection', 'south')
  },

  setBboxDmsEast() {
    this.update(setLatLonFromDms, 'dmsEast', 'dmsEastDirection', 'east')
  },

  setBboxDmsWest() {
    this.update(setLatLonFromDms, 'dmsWest', 'dmsWestDirection', 'west')
  },

  setBboxDmsFromMap() {
    this.update(getBboxDmsFromMap)
  },

  setRadiusDmsFromMap() {
    this.update(getRadiusDmsFromMap)
  },

  handleLocationType() {
    this.update(handleLocationType)
  },

  setLatLon() {
    console.error('setLatLon(): starting')
    this.update(getLatLon)
  },
})
