'use strict';

require('module-alias/register');
const logger = require('@alias/logger')('growi:migrate:init-serverurl');

const mongoose = require('mongoose');
const config = require('@root/config/migrate');

/**
 * check all values of the array are equal
 * @see https://stackoverflow.com/a/35568895
 */
function isAllValuesSame(array) {
  return !!array.reduce((a, b) => {
    return (a === b) ? a : NaN;
  });
}

module.exports = {

  async up(db) {
    logger.info('Apply migration');
    mongoose.connect(config.mongoUri, config.mongodb.options);

    const Config = require('@server/models/config')();

    // find 'app:siteUrl'
    const siteUrlConfig = await Config.findOne({
      ns: 'crowi',
      key: 'app:siteUrl',
    });
    // exit if exists
    if (siteUrlConfig != null) {
      logger.info('\'app:siteUrl\' is already exists. This migration terminates without any changes.');
      return;
    }

    // find all callbackUrls
    const configs = await Config.find({
      ns: 'crowi',
      $or: [
        { key: 'security:passport-github:callbackUrl' },
        { key: 'security:passport-google:callbackUrl' },
        { key: 'security:passport-twitter:callbackUrl' },
        { key: 'security:passport-saml:callbackUrl' },
      ]
    });

    // determine serverUrl
    let siteUrl;
    if (configs.length > 0) {
      logger.info(`${configs.length} configs which has callbackUrl found: `);
      logger.info(configs);

      // extract domain
      const siteUrls = configs.map(config => {
        // see https://regex101.com/r/Q0Isjo/2
        const match = config.value.match(/^"(https?:\/\/[^/]+).*"$/);
        return (match != null) ? match[1] : null;
      }).filter(value => value != null);

      // determine serverUrl if all values are same
      if (siteUrls.length > 0 && isAllValuesSame(siteUrls)) {
        siteUrl = siteUrls[0];
      }
    }

    if (siteUrl != null) {
      await Config.findOneAndUpdateByNsAndKey('crowi', 'app:siteUrl', siteUrl);
      logger.info('Migration has successfully applied');
    }
  },

  async down(db) {
    logger.info('Undo migration');
    mongoose.connect(config.mongoUri, config.mongodb.options);

    const Config = require('@server/models/config')();

    // remote 'app:siteUrl'
    await Config.findOneAndDelete({
      ns: 'crowi',
      key: 'app:siteUrl',
    });

    logger.info('Migration has successfully undoed');
  }

};
