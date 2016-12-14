'use strict';

var redis = require('redis');
var Sequelize = require('sequelize');
var should = require('should');
var cacher = require('..');

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

  before(function(done) {
    rc = redis.createClient(redisPort, redisHost);
    rc.on('error', onErr);
    db = new Sequelize(opts.database, opts.user, opts.password, opts);
    Entity = db.define('entity', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: Sequelize.STRING(255)
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
      .then(function() {
        Entity2.sync({ force: true }).then(function() {
          Entity.create({ name: 'Test Instance' }).then(function(entity) {
            inst = entity;
            Entity2.create({ entityId: inst.id }).then(function() {
              return done();
            })
            .catch(onErr);
          })
          .catch(onErr);
        })
        .catch(onErr);
      })
      .catch(onErr);
  });

  it('should fetch stuff from database with and without cache', function(done) {
    var query = { where: { createdAt: inst.createdAt } };
    var obj = cacher(db, rc)
      .model('entity')
      .ttl(1);
    return obj.find(query)
      .then(function(res) {
        obj.cacheHit.should.equal(false);
        var obj2 = cacher(db, rc)
          .model('entity')
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


  it('should fetch stuff from database with and without cache', function(done) {
    var query = { where: { createdAt: inst.createdAt } };
    var obj = cacher(db, rc)
      .model('entity')
      .ttl(1);
    return obj.findOne(query)
      .then(function(res) {
        obj.cacheHit.should.equal(false);
        var obj2 = cacher(db, rc)
          .model('entity')
          .ttl(1);
        return obj2.findOne(query)
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
    var obj = cacher(db, rc)
      .model('entity')
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
    var obj = cacher(db, rc)
      .model('entity')
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
    var obj = cacher(db, rc)
      .model('entity')
      .ttl(1);
    return obj.find(query)
      .then(function(res) {
        return done();
      }, onErr);
  });

  it('should return a POJO when retrieving from cache and when not', function(done) {
    var obj;
    var query = { where: { createdAt: inst.createdAt } };
    query.include = [Entity2];
    obj = cacher(db, rc)
      .model('entity')
      .ttl(1);
    return obj.find(query)
      .then(function(res) {
        res.toString().should.not.equal('[object SequelizeInstance]');
        res.should.have.property('entity2s');
        res.entity2s.should.have.length(1);
        res.entity2s[0].toString().should.not.equal('[object SequelizeInstance]');
        return done();
      }, onErr);
  });

  it('should run a raw query correctly', function(done) {
    var obj = cacher(db, rc)
      .ttl(1);
    return obj.query('SELECT * FROM entities')
      .then(function(res) {
        should.exist(res);
        res.should.be.an.Array;
        res.should.have.length(1);
        res[0].should.have.property('id', 1);
        res[0].should.have.property('name', 'Test Instance');
        res[0].should.have.property('createdAt');
        res[0].should.have.property('updatedAt');
        return done();
      });
  });

  it('should findAll correctly', function(done) {
    var query = { where: { createdAt: inst.createdAt } };
    var obj = cacher(db, rc)
      .model('entity')
      .ttl(1);
    return obj.findAll(query)
      .then(function(res) {
        should.exist(res);
        res.should.be.an.Array;
        res.should.have.length(1);
        res[0].should.have.property('id');
        return done();
      }, onErr);
  });

  it('should findAndCount correctly', function(done) {
    var query = { where: { createdAt: inst.createdAt } };
    var obj = cacher(db, rc)
      .model('entity')
      .ttl(1);
    return obj.findAndCount(query)
      .then(function(res) {
        should.exist(res);
        res.should.have.property('count', 1);
        return done();
      });
  });

  it('should findAndCountAll correctly', function(done) {
    var query = { where: { createdAt: inst.createdAt } };
    var obj = cacher(db, rc)
      .model('entity')
      .ttl(1);
    return obj.findAndCountAll(query)
      .then(function(res) {
        should.exist(res);
        res.should.have.property('count', 1);
        return done();
      });
  });

  it('should count correctly', function(done) {
    var obj = cacher(db, rc)
      .model('entity')
      .ttl(1);
    return obj.count()
      .then(function(res) {
        should.exist(res);
        res.should.equal(1);
        return done();
      }, onErr);
  });

  it('should sum correctly', function(done) {
    var obj = cacher(db, rc)
      .model('entity')
      .ttl(1);
    return obj.sum('id')
      .then(function(res) {
        should.exist(res);
        res.should.equal(1);
        return done();
      }, onErr);
  });

  it('should max correctly', function(done) {
    var obj = cacher(db, rc)
      .model('entity')
      .ttl(1);
    return obj.max('id')
      .then(function(res) {
        should.exist(res);
        res.should.equal(1);
        return done();
      }, onErr);
  });

  it('should min correctly', function(done) {
    var obj = cacher(db, rc)
      .model('entity')
      .ttl(1);
    return obj.min('id')
      .then(function(res) {
        should.exist(res);
        res.should.equal(1);
        return done();
      }, onErr);
  });
});
