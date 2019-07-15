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
const React = require('react')

const { Radio, RadioItem } = require('../radio')
const TextField = require('../text-field')

const { Units, Zone, Hemisphere } = require('./common')

const {
  DmsLatitude,
  DmsLongitude,
} = require('../../component/location-new/geo-components/coordinates.js')
const DirectionInput = require('../../component/location-new/geo-components/direction.js')
const { Direction } = require('../../component/location-new/utils/dms-utils.js')

const NumberInput = ({ value, label, onChange, addon, callback }) => {
  return (
    <TextField
      type="number"
      label={label}
      value={value}
      onChange={value => {
        const number = parseFloat(value)
        onChange(isNaN(number) ? 0 : number)
      }}
      onBlur={callback}
      addon={addon}
    />
  )
}

const PointRadiusLatLon = props => {
  const { lat, lon, radius, radiusUnits, cursor } = props
  return (
    <div>
      <NumberInput
        label="Latitude"
        value={lat}
        onChange={cursor('lat')}
        onBlur={props.callback}
        addon="°"
      />
      <NumberInput
        label="Longitude"
        value={lon}
        onChange={cursor('lon')}
        addon="°"
      />
      <Units value={radiusUnits} onChange={cursor('radiusUnits')}>
        <NumberInput
          min="0"
          label="Radius"
          value={radius}
          onChange={cursor('radius')}
        />
      </Units>
    </div>
  )
}

const PointRadiusUsngMgrs = props => {
  const { usng, radius, radiusUnits, cursor } = props
  return (
    <div>
      <TextField label="USNG / MGRS" value={usng} onChange={cursor('usng')} />
      <Units value={radiusUnits} onChange={cursor('radiusUnits')}>
        <NumberInput
          label="Radius"
          value={radius}
          onChange={cursor('radius')}
        />
      </Units>
    </div>
  )
}

const PointRadiusUtmUps = props => {
  const {
    utmUpsEasting,
    utmUpsNorthing,
    utmUpsZone,
    utmUpsHemisphere,
    radius,
    radiusUnits,
    cursor,
  } = props
  return (
    <div>
      <NumberInput
        label="Easting"
        value={utmUpsEasting}
        onChange={cursor('utmUpsEasting')}
        addon="m"
      />
      <NumberInput
        label="Northing"
        value={utmUpsNorthing}
        onChange={cursor('utmUpsNorthing')}
        addon="m"
      />
      <Zone value={utmUpsZone} onChange={cursor('utmUpsZone')} />
      <Hemisphere
        value={utmUpsHemisphere}
        onChange={cursor('utmUpsHemisphere')}
      />
      <Units value={radiusUnits} onChange={cursor('radiusUnits')}>
        <NumberInput
          label="Radius"
          value={radius}
          onChange={cursor('radius')}
        />
      </Units>
    </div>
  )
}

const PointRadiusDms = props => {
  const {
    dmsLat,
    dmsLon,
    dmsLatDirection,
    dmsLonDirection,
    radius,
    radiusUnits,
    cursor,
  } = props
  const latitudeDirections = [Direction.North, Direction.South]
  const longitudeDirections = [Direction.East, Direction.West]

  return (
    <div>
      <DmsLatitude label="Latitude" value={dmsLat} onChange={cursor('dmsLat')}>
        <DirectionInput
          options={latitudeDirections}
          value={dmsLatDirection}
          onChange={cursor('dmsLatDirection')}
        />
      </DmsLatitude>
      <DmsLongitude
        label="Longitude"
        value={dmsLon}
        onChange={cursor('dmsLon')}
      >
        <DirectionInput
          options={longitudeDirections}
          value={dmsLonDirection}
          onChange={cursor('dmsLonDirection')}
        />
      </DmsLongitude>
      <Units value={radiusUnits} onChange={cursor('radiusUnits')}>
        <NumberInput
          label="Radius"
          value={radius}
          onChange={cursor('radius')}
        />
      </Units>
    </div>
  )
}

const PointRadius = props => {
  const { cursor, locationType } = props

  const inputs = {
    latlon: PointRadiusLatLon,
    dms: PointRadiusDms,
    usng: PointRadiusUsngMgrs,
    utmUps: PointRadiusUtmUps,
  }

  const Component = inputs[locationType] || null

  return (
    <div>
      <Radio value={locationType} onChange={cursor('locationType')}>
        <RadioItem value="latlon">Lat / Lon (DD)</RadioItem>
        <RadioItem value="dms">Lat / Lon (DMS)</RadioItem>
        <RadioItem value="usng">USNG / MGRS</RadioItem>
        <RadioItem value="utmUps">UTM / UPS</RadioItem>
      </Radio>
      <div className="input-location">
        {Component !== null ? <Component {...props} /> : null}
      </div>
    </div>
  )
}

module.exports = PointRadius
