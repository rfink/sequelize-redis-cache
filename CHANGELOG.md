# v2.0.0 #
- New API
  - Allow raw queries to be cached
  - Non-singleton design pattern - required moving model name from constructor
    to model method

# v1.4.0 #
- Swap redis.setex for redis.set(['EX']) (H/T https://github.com/thujikun)

# v1.3.0 #
- Added findAndCount method

# v1.2.1 #
- Fixed bug where cacheHit was true even when going to the database, when reusing the cache obj

# v1.2.0 #
- Fixed issue with associations generating new cache (H/T https://github.com/NotJustClarkKent)
- Updated dev dependencies for sqlite3, redis (should work test correctly with node 4.x, 5.x, 6.x)

# v1.1.1 #
- Added error handler for database issues (H/T https://github.com/thujikun)

# v1.1.0 #
- Added findOne method (H/T https://github.com/jonathanleang)

# v1.0.0 #
- Add sequelize 3.0 support, drop queryOptions
- Added travis ci build status and entry

# v0.0.7 #
- Fix findAll from P.R. #3 (H/T to https://github.com/thujikun)

# v0.0.6 #
- Fix v0.0.5, findAll and aggregates

# v0.0.5 #
- This is also a broken release, do NOT use, findAll and aggregates become broken
- Fix v0.0.4, use .get and upgrade sequelize to 2.0.0rc1 (does recursive POJO conversion)
- Add CHANGELOG.md

# v0.0.4 #
- This is a bad release, do NOT use, uses toJSON method that may not exist

# v0.0.3 #
- Update test with toJSON method

# v0.0.2 #
- Fix for hashing of circular references (nested entities)

# v0.0.1 #
- Initial release
