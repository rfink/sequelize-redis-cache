sequelize-redis-cache [![Build Status](https://travis-ci.org/rfink/sequelize-redis-cache.svg?branch=master)](https://travis-ci.org/rfink/sequelize-redis-cache)
=====================

Small fluent interface for caching sequelize database query results in redis more easily.
Simply put, this is a wrapper around sequelize retrieval methods that will automatically
check in the configured redis instance for a value (based on a hash of the query and
model name), then retrieve from the database and persist in redis if not found.  It is
promise based, so it will resemble sequelize for the most part, and be co/koa friendly.

Installation
=====================

```

npm install sequelize-redis-cache

```

Usage
=====================

```javascript

var cacher = require('sequelize-redis-cache');
var redis = require('redis');
var Sequelize = require('sequelize');

var rc = redis.createClient(6379, 'localhost');
var db = new Sequelize('cache_tester', 'root', 'root', { dialect: 'mysql' });
var cacheObj = cacher(db, rc)
  .model('sequelize-model-name')
  .ttl(5);
cacheObj.find({ where: { id: 3 } })
  .then(function(row) {
    console.log(row); // sequelize db object
    console.log(cacheObj.cacheHit); // true or false
  });

```

You can also execute and cache raw queries:

```javascript

var cacheObj = cacher(db, rc)
  .ttl(5);
cacheObj.query('SELECT * FROM widgets LIMIT 10')
  .then(function(row) {
    console.log(row); // Array of raw objects
  });

```

Check the tests out for more info, but it's pretty simple.  The currently supported
methods are:

  query
  find
  findOne
  findAll
  findAndCountAll
  all
  min
  max
  sum

Notes
=====================

This library does not handle automatic invalidation of caches, since it currently does not handle inserts/updates/deletes/etc.  I'd be in favor of someone submitting a patch to accommodate that, although I think that would be a significant undertaking.

Here is a good guideline for caching strategies: [http://docs.aws.amazon.com/AmazonElastiCache/latest/UserGuide/Strategies.html](http://docs.aws.amazon.com/AmazonElastiCache/latest/UserGuide/Strategies.html)

License
====================
MIT - Rekt
