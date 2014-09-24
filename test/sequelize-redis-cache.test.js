
var redis = require('redis');
var Sequelize = require('sequelize');
var should = require('should');
var initCache = require('..');

var opts = {};
opts.database = process.env.DB_NAME || 'sequelize_redis_cache_test';
opts.user = process.env.DB_USER || 'root';
opts.password = process.env.DB_PASS;
opts.dialect = process.env.DB_DIALECT || 'sqlite';
opts.logging = process.env.DB_LOG ? console.log : false;

var redisPort = process.env.REDIS_PORT || 6379;
var redisHost = process.env.REDIS_HOST;

/*global describe*/
/*global it*/
/*global before*/
/*global after*/

function onErr(err) {
  throw err;
}

describe('Sequelize-Redis-Cache', function() {
  var rc;
  var db;
  var Entity;
  var Entity2;
  var inst;
  var cacher;

  before(function(done) {
    rc = redis.createClient(redisPort, redisHost);
    rc.on('error', onErr);
    db = new Sequelize(opts.database, opts.user, opts.password, opts);
    cacher = initCache(db, rc);
    Entity = db.define('entity', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: Sequelize.STRING(255)
    }, {
      instanceMethods: {
        toJSON: function toJSON() {
          return this.get();
        }
      }
    });
    Entity2 = db.define('entity2', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      }
    });
    Entity2.belongsTo(Entity, { foreignKey: 'entityId' });
    Entity.hasMany(Entity2, { foreignKey: 'entityId' });
    Entity.sync({ force: true })
      .success(function() {
        Entity2.sync({ force: true }).success(function() {
          Entity.create({ name: 'Test Instance' }).success(function(entity) {
            inst = entity;
            return done();
          })
            .error(onErr);
        })
        .error(onErr);
      })
      .error(onErr);
  });

  it('should fetch stuff from database with and without cache', function(done) {
    var query = { where: { createdAt: inst.createdAt } };
    var obj = cacher('entity')
      .ttl(1);
    return obj.find(query)
      .then(function(res) {
        obj.cacheHit.should.equal(false);
        var obj2 = cacher('entity')
          .ttl(1);
        return obj2.find(query)
          .then(function(res) {
            should.exist(res);
            obj2.cacheHit.should.equal(true);
            obj2.clearCache().then(function() {
              return done();
            }, onErr);
          }, onErr);
      }, onErr);
  });

  it('should not hit cache if no results', function(done) {
    var obj = cacher('entity')
      .ttl(1);
    return obj.find({ where: { id: 2 } })
      .then(function(res) {
        should.not.exist(res);
        obj.cacheHit.should.equal(false);
        return done();
      }, onErr);
  });

  it('should clear the cache correctly', function(done) {
    var query = { where: { createdAt: inst.createdAt } };
    var obj = cacher('entity')
      .ttl(1);
    return obj.find(query)
      .then(function(res) {
        var key = obj.key();
        obj.clearCache(query)
          .then(function() {
            rc.get(key, function(err, res) {
              should.not.exist(err);
              should.not.exist(res);
              return done();
            });
          }, onErr);
      }, onErr);
  });

  it('should not blow up with circular reference queries (includes)', function(done) {
    var query = { where: { createdAt: inst.createdAt }, include: [Entity2] };
    var obj = cacher('entity')
      .ttl(1);
    return obj.find(query)
      .then(function(res) {
        return done();
      }, onErr);
  });
});
