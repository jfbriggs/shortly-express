var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var bcrypt = require('bcrypt-nodejs');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

app.use(cookieParser('S3CR3tCHEESEFACT0rY'));  // INSTALLED -- random string used to give each cookie a unique random id
app.use(session());  // NECESSARY FOR SESSIONS, WE ADDED

var restrict = function(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.session.error = 'You are not logged in';
    res.redirect('/login');
    // console.log('not authorized', req);
  }
};

app.get('/', restrict, 
function(req, res) {
  // res.redirect('/login');
  res.render('index');
});

app.get('/create', restrict,
function(req, res) {
  res.render('index');
});

app.get('/links', restrict,
function(req, res) {
  Links.reset().query('where', 'userID', '=', req.session.user).fetch().then(function(links) {
    res.status(200).send(links.models);
    // console.log(links);
  });
});

app.post('/links', 
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.sendStatus(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.status(200).send(found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.sendStatus(404);
        }

        Links.create({
          url: uri,
          title: title,
          baseUrl: req.headers.origin,
          userID: req.session.user
        })
        .then(function(newLink) {
          res.status(200).send(newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

app.get('/login', function(req, res) {
  res.render('login');
});

app.post('/login', function(req, res) {
  var userObj = req.body;

  // ping DB, check if user exists
  User.where('username', userObj.username).fetch().then(function(user) {
    if (user) {
      bcrypt.compare(userObj.password, user.attributes.password, function(err, results) {
        if (results) {
          req.session.regenerate(function() {
            req.session.user = userObj.username;
            res.redirect('/');
          });
        } else {
          res.redirect('/login');
        }
      });
    } else {
      res.redirect('/login');
    }
  });

});

app.get('/signup', function(req, res) {
  res.render('signup');
});

app.post('/signup', function(req, res) {
  User.where('username', req.body.username).fetch().then(function(user) {
    if (user) {
      console.log('Username already exists - choose another!');
      res.redirect('/signup');
    } else {
      new User({'username': req.body.username, 'password': req.body.password}).save().then(function() {
        req.session.regenerate(function() {
          req.session.user = req.body.username;
          res.redirect('/');
        });
      });
    }
  });
});

app.get('/logout', function(req, res) {
  req.session.destroy();
  res.redirect('/');
});

/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        linkId: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits') + 1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

module.exports = app;
