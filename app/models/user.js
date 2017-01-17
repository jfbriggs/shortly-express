var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');



var User = db.Model.extend({
  tableName: 'users',

  links: function() {
    return this.hasMany(Link);
  },

  initialize: function() {
    this.on('creating', this.hashPassword, this);
  },

  hashPassword: function(model, attrs, options) {
    return new Promise(function(res, rej) {
      bcrypt.hash(model.attributes.password, null, null, function(err, hash) {
        if (err) {
          rej(err);
        }
        model.set('password', hash);
        res(hash);
        console.log('PASSWORD HASHED. HASH =', hash);
        console.log('NEW PW:', model.get('password'));
      });
    });
  }

});



module.exports = User;