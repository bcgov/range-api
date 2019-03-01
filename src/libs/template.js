//
// SecureImage
//
// Copyright © 2018 Province of British Columbia
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// Created by Jason Leach on 2018-01-18.
//

/* eslint-env es6 */

'use strict';

import fs from 'fs';
import handlebars from 'handlebars';
import moment from 'moment';
import path from 'path';
import wkhtmltopdf from 'wkhtmltopdf';
import { logger } from '@bcgov/nodejs-common-utils';
import { AGREEMENT_HOLDER_ROLE, NOT_PROVIDED, DAYS_ON_THE_AVERAGE, DATE_FORMAT } from '../constants';

if (process.platform === 'linux') {
  // On Linux (OpenShift) we need to run our own copy of the binary with any related
  // libs.
  const lpath = path.join(__dirname, '../', 'wkhtmltopdf-amd64-0.12.4', 'lib');
  const bpath = path.join(__dirname, '../', 'wkhtmltopdf-amd64-0.12.4', 'bin', 'wkhtmltopdf');
  wkhtmltopdf.command = `LD_LIBRARY_PATH=${process.env.LD_LIBRARY_PATH}:${lpath} ${bpath}`;
}

//
// Format Helpers
//

/**
 * Convert a boolean value to its human readable equivolent
 *
 * @param {Boolean} boolValue The value to be operated on
 * @returns A string with the reformated date
 */
// eslint-disable-next-line no-confusing-arrow
const asYesOrNoValue = boolValue => boolValue ? 'YES' : 'NO';

/**
 * Present the date time in a more readable way
 *
 * @param {string | Date} isoFormatDate The stringified date time
 * @param {boolean} isYearIncluded The boolean to specify whether the year is needed
 * @returns {string} a formatted string or 'Not provided'
 */
const formatDateFromServer = (isoFormatDate, isYearIncluded = true, notProvided = NOT_PROVIDED) => {
  if (isoFormatDate) {
    const m = moment(isoFormatDate, DATE_FORMAT.SERVER_SIDE);

    if (isYearIncluded) {
      return m.format(DATE_FORMAT.CLIENT_SIDE);
    }
    return m.format(DATE_FORMAT.CLIENT_SIDE_WITHOUT_YEAR);
  }
  return notProvided;
};

/**
 * Convert the contact type / role to its string equivolent
 *
 * @param {Contact} contact The contact to be operated on
 * @returns The `String` representing the contacts role
 */
const contactRole = (contact) => {
  if (!contact) {
    return NOT_PROVIDED;
  }
  if (contact.clientTypeCode === AGREEMENT_HOLDER_ROLE.PRIMARY) {
    return 'Primary';
  }

  return 'Secondary';
};

const handleNullValue = (value, notProvided) => {
  if (!value) {
    return typeof notProvided === 'string' ? notProvided : NOT_PROVIDED;
  }
  return value;
};

/**
 * Convert the zone code / descriiption to its string equivolent
 *
 * @param {Zone} zone The zone to be operated on
 * @returns The `String` representing the district
 */
const getDistrict = (zone) => {
  if (!zone) {
    return NOT_PROVIDED;
  }
  if (zone.district && zone.district.description) {
    return `${zone.district.code} - ${zone.district.description}`;
  }
  return zone.district.code;
};

/**
 * Convert the agreement type code / descriiption to its string equivolent
 *
 * @param {AgreementType} agreementType The zone to be operated on
 * @returns The `String` representing the agreement type
 */
const getAgreementType = (agreementType) => {
  if (!agreementType) {
    return NOT_PROVIDED;
  }
  if (agreementType.description) {
    return `${agreementType.code} - ${agreementType.description}`;
  }
  return agreementType.code;
};

/**
 * Capitalize the first letter for a string
 *
 * @param {String} string The string to be operated on
 * @returns A string with the first letter capitalized
 */
export const capitalizeFirstLetter = (string) => {
  if (!string) {
    return '';
  }
  return string.charAt(0).toUpperCase() + string.slice(1);
};

/**
 * Reformat the contact name
 *
 * @param {Contact} contact The contact to be operated on
 * @returns A `String` represeting the contact name in the format `First Last`
 */
const contactFullName = (contact) => {
  const [lastName, firstName] = contact.name
    .split(',')
    .map(string => string.toLowerCase())
    .map(string => string.trim());
  return `${capitalizeFirstLetter(firstName)} ${capitalizeFirstLetter(lastName)}`;
};

/**
 * Handlebars helper to build the full name of the primary agreement holder
 *
 * @param {[Contact]} contacts The `Agreement` contacts
 * @returns A string representing the full name of the promary contact
 */
export const primaryContactFullName = (contacts) => {
  const [pcontact] = contacts
    .filter(contact => contact.clientTypeCode === AGREEMENT_HOLDER_ROLE.PRIMARY);

  return contactFullName(pcontact);
};

const getYesOrNo = boolean => (
  boolean ? 'Yes' : 'No'
);


const shift = (number, precision) => {
  const numArray = (`${number}`).split('e');
  return +(`${numArray[0]}e${(numArray[1] ? (+numArray[1] + precision) : precision)}`);
};

const round = (number, precision) => (
  shift(Math.round(shift(number, +precision)), -precision)
);

/**
 * Round the float to 1 decimal
 *
 * @param {float} number
 * @returns the rounded float number
 */
export const roundToSingleDecimalPlace = number => (
  round(number, 1)
);

/**
 *
 * @param {number} numberOfAnimals
 * @param {number} totalDays
 * @param {number} auFactor parameter provided from the livestock type
 * @returns {float} the total AUMs
 */
export const calcTotalAUMs = (numberOfAnimals = 0, totalDays, auFactor = 0) => (
  ((numberOfAnimals * totalDays * auFactor) / DAYS_ON_THE_AVERAGE)
);

/**
 * Present user friendly string when getting null or undefined value
 *
 * @param {string | Date} first the string in the class Date form
 * @param {string | Date} second the string in the class Date form
 * @param {bool} isUserFriendly
 * @returns {number | string} the number of days or 'N/P'
 */
export const calcDateDiff = (first, second, isUserFriendly) => {
  if (first && second) {
    return moment(first).diff(moment(second), 'days');
  }
  return isUserFriendly ? 'N/P' : 0;
};

/**
 * Calculate Private Land Deduction Animal Unit Month
 *
 * @param {number} totalAUMs
 * @param {float} pasturePldPercent
 * @returns {float} the pld AUMs
 */
export const calcPldAUMs = (totalAUMs, pasturePldPercent = 0) => (
  totalAUMs * pasturePldPercent
);

/**
 * Calculate Crown Animal Unit Month
 *
 * @param {number} totalAUMs
 * @param {number} pldAUMs
 * @returns {float} the crown AUMs
 */
export const calcCrownAUMs = (totalAUMs, pldAUMs) => (
  (totalAUMs - pldAUMs)
);

/**
 * Calculate the total Crown Animal Unit Month
 *
 * @param {Array} entries grazing schedule entries
 * @returns {float} the total crown AUMs
 */
export const calcCrownTotalAUMs = (entries = []) => {
  const reducer = (accumulator, currentValue) => accumulator + currentValue;
  if (entries.length === 0) {
    return 0;
  }
  return entries
    .map(entry => entry.crownAUMs)
    .reduce(reducer);
};

export const getPastureNames = (pastureIds = [], pastures = {}) => {
  const pastureNames = pastureIds.map((pId) => {
    const pasture = pastures.find(p => p.id === pId);
    return pasture && pasture.name;
  });
  const { length } = pastureNames;
  switch (length) {
    case 0:
      return NOT_PROVIDED;
    case 1:
    case 2:
      return pastureNames.join(' and ');
    default:
      return `${pastureNames.slice(0, length - 1).join(', ')}, and ${pastureNames[length - 1]}`;
  }
};

//
// Document Rendering
//

/**
 * Compile the handelbars template and run it with the given context
 * to produce html.
 *
 * @param {ReadStream} source A stream asociated to the handelbars markup template
 * @param {JSON} context The object with appropriate data for the template
 * @returns A resolved `Promise` with the HTML data.
 */
export const compile = (source, context) => {
  handlebars.registerHelper('getContactRole', contactRole);
  handlebars.registerHelper('getDistrict', getDistrict);
  handlebars.registerHelper('getContactFullName', contactFullName);
  handlebars.registerHelper('getPrimaryContactName', primaryContactFullName);
  handlebars.registerHelper('getStandardDateFormat', formatDateFromServer);
  handlebars.registerHelper('getBoolAsYesNoValue', asYesOrNoValue);
  handlebars.registerHelper('handleNullValue', handleNullValue);
  handlebars.registerHelper('getAgreementType', getAgreementType);
  handlebars.registerHelper('getYesOrNo', getYesOrNo);

  const html = handlebars.compile(source.toString('utf-8'))(context);
  return Promise.resolve(html);
};

/**
 * Load the html template from the local file system and return it as a Buffer.
 *
 * @param {String} fileName The path and name of the file to be loaded
 * @returns A resolved `Promise` with a stream of the loaded file; rejected otherwise.
 */
export const loadTemplate = (fileName) => {
  const docpath = path.join(__dirname, '../../', 'templates', fileName);

  return new Promise((resolve, reject) => {
    fs.access(docpath, fs.constants.R_OK, (accessErr) => {
      if (accessErr) {
        logger.warn('Unable to find templates');
        reject(accessErr);
      }

      fs.readFile(docpath, (readFileErr, data) => {
        if (readFileErr) {
          logger.warn('Unable to load template');
          reject(readFileErr);
        }

        resolve(data);
      });
    });
  });
};
