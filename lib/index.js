'use strict';

var Promise = require('bluebird');
var CircularJSON = require('circular-json');
var crypto = require('crypto');

module.exports = Cacher;

/**
 * Constructor for cacher
 */
function Cacher(seq, red) {
  if (!(this instanceof Cacher)) {
    return new Cacher(seq, red);
  }
  this.method = 'find';
  this.options = {};
  this.seconds = 0;
  this.cacheHit = false;
  this.cachePrefix = 'cacher';
  this.sequelize = seq;
  this.redis = red;
}

/**
 * Set model
 */
Cacher.prototype.model = function model(md) {
  this.md = this.sequelize.model(md);
  this.modelName = md;
  return this;
};

/**
 * Set cache prefix
 */
Cacher.prototype.prefix = function prefix(cachePrefix) {
  this.cachePrefix = cachePrefix;
  return this;
};

/**
 * Execute the query and return a promise
 */
Cacher.prototype.run = function run(options) {
  this.options = options || this.options;
  return this.fetchFromCache();
};

/**
 * Run given manual query
 */
Cacher.prototype.query = function query(q) {
  this.q = q;
  return this.rawFromCache();
};

/**
 * Fetch data from cache for raw type query
 */
Cacher.prototype.rawFromCache = function rawFromCache() {
  var self = this;
  return new Promise(function promiser(resolve, reject) {
    var key = self.key();
    return self.redis.get(key, function(err, res) {
      if (err) {
        return reject(err);
      }
      if (!res) {
        return self.rawFromDatabase(key).then(resolve, reject);
      }
      self.cacheHit = true;
      try {
        return resolve(JSON.parse(res));
      } catch (e) {
        return reject(e);
      }
    });
  });
};

/**
 * Fetch raw query from the database
 */
Cacher.prototype.rawFromDatabase = function rawFromDatabase(key) {
  var self = this;
  return new Promise(function promiser(resolve, reject) {
    return self.sequelize.query(self.q, { type: self.sequelize.QueryTypes.SELECT })
      .then(function then(results) {
          var res;
          if (!results) {
            res = results;
          } else if (Array.isArray(results)) {
            res = results;
          } else if (results.toString() === '[object SequelizeInstance]') {
            res = results.get({ plain: true });
          } else {
            res = results;
          }
          return self.setCache(key, res, self.seconds)
            .then(
              function good() {
                return resolve(res);
              },
              function bad(err) {
                return reject(err);
              }
            );
        },
        function(err) {
          reject(err);
        });
  });
};

/**
 * Set redis TTL (in seconds)
 */
Cacher.prototype.ttl = function ttl(seconds) {
  this.seconds = seconds;
  return this;
};

/**
 * Fetch from the database
 */
Cacher.prototype.fetchFromDatabase = function fetchFromDatabase(key) {
  var method = this.md[this.method];
  var self = this;
  this.cacheHit = false;
  return new Promise(function promiser(resolve, reject) {
    if (!method) {
      return reject(new Error('Invalid method - ' + self.method));
    }
    return method.call(self.md, self.options)
      .then(function then(results) {
        var res;
        if (!results) {
          res = results;
        } else if (Array.isArray(results)) {
          res = results;
        } else if (results.toString() === '[object SequelizeInstance]') {
          res = results.get({ plain: true });
        } else {
          res = results;
        }
        return self.setCache(key, res, self.seconds)
          .then(
            function good() {
              return resolve(res);
            },
            function bad(err) {
              return reject(err);
            }
          );
      },
      function(err) {
        reject(err);
      });
  });
};

/**
 * Set data in cache
 */
Cacher.prototype.setCache = function setCache(key, results, ttl) {
  var self = this;
  return new Promise(function promiser(resolve, reject) {
    var args = [];
    var res;
    try {
      res = JSON.stringify(results);
    } catch (e) {
      return reject(e);
    }

    args.push(key, res);
    if (ttl) {
      args.push('EX', ttl);
    }

    return self.redis.set(args, function(err, res) {
      if (err) {
        return reject(err);
      }
      return resolve(res);
    });
  });
};

/**
 * Clear cache with given query
 */
Cacher.prototype.clearCache = function clearCache(opts) {
  var self = this;
  this.options = opts || this.options;
  return new Promise(function promiser(resolve, reject) {
    var key = self.key();
    return self.redis.del(key, function onDel(err) {
      if (err) {
        return reject(err);
      }
      return resolve();
    });
  });
};

/**
 * Fetch data from cache
 */
Cacher.prototype.fetchFromCache = function fetchFromCache() {
  var self = this;
  return new Promise(function promiser(resolve, reject) {
    var key = self.key();
    return self.redis.get(key, function(err, res) {
      if (err) {
        return reject(err);
      }
      if (!res) {
        return self.fetchFromDatabase(key).then(resolve, reject);
      }
      self.cacheHit = true;
      try {
        return resolve(JSON.parse(res));
      } catch (e) {
        return reject(e);
      }
    });
  });
};

/**
 * Create redis key
 */
Cacher.prototype.key = function key() {
  var hash = null;
  if (this.q) {
    hash = crypto.createHash('sha1')
      .update(this.q)
      .digest('hex');
    return [this.cachePrefix, '__raw__', 'query', hash].join(':');
  }
  hash = crypto.createHash('sha1')
    .update(CircularJSON.stringify(this.options, jsonReplacer))
    .digest('hex');
  return [this.cachePrefix, this.modelName, this.method, hash].join(':');
};

/**
 * Duct tape to check if this is a sequelize DAOFactory
 */
function jsonReplacer(key, value) {
  if (value && (value.DAO || value.sequelize)) {
    return value.name || '';
  }
  return value;
}

/**
 * Add a retrieval method
 */
function addMethod(key) {
  Cacher.prototype[key] = function() {
    if (!this.md) {
      return Promise.reject(new Error('Model not set'));
    }
    this.method = key;
    return this.run.apply(this, arguments);
  };
}

var methods = [
  'find',
  'findOne',
  'findAll',
  'findAndCount',
  'findAndCountAll',
  'all',
  'min',
  'max',
  'sum',
  'count'
];

methods.forEach(addMethod);
