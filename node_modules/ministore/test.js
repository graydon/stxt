//

var assert = require('assert')
  , Store = require('./ministore')('mdb')

var users = Store('users')
var sessions = Store('sessions')
var array = Store('array')
var func = Store('func')

users.clear()
sessions.clear()
array.clear()
func.clear()

users.set('john', 'doe')
assert.equal(users.get('john'), 'doe')

assert.equal(users.length(), 1)
users.length(function(err, length) {
  assert.equal(err, null)
  assert.equal(length, 1)
})

users.set('mary', 'loo', function(err) {
  assert.equal(err, null)
  users.get('mary', function(err, data) {
    assert.equal(data, 'loo')

    assert.deepEqual(users.all(), { 'john': 'doe', 'mary': 'loo' })
    users.all(function(err, data) {
      assert.equal(err, null)
      assert.deepEqual(data, { 'john': 'doe', 'mary': 'loo' })

      users.remove('john')
      assert.equal(users.get('john'), null)
      users.remove('mary', function(err) {
        assert.equal(err, null)
        users.get('mary', function(err, data) {
          assert.notEqual(err, null)
          assert.equal(data, null)
        })
      })
    })
  })
})

sessions.set('foo', { foo: 'bar' })
sessions.set('bar', { bar: 'foo' })

sessions.forEach(function(key) {
  assert.deepEqual(this, sessions.get(key))
})

assert.equal(sessions.length(), 2)
assert.deepEqual(sessions.list(), [ 'bar', 'foo' ])

array.push('foo', 'bar')
array.unshift('foo', 'baz')
assert.deepEqual(array.get('foo'), [ 'baz', 'bar' ])
assert.equal(array.pop('foo'), 'bar')
assert.equal(array.shift('foo'), 'baz')
assert.deepEqual(array.get('foo'), [])

func.set('add', function(a, b) { return a + b })
func = Store('func')
assert.equal(func.eval('add')(4, 5), 9)

array.push('foo', func.eval('add'))
array = Store('array')
assert.equal(array.evalpop('foo')(4, 5), 9)

