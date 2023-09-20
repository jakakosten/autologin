// models/user.js
const connection = require("../config/db");

// check if the user is authenticated
function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/prijava");
}

// check if the user is not authenticated
function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect("/");
  }
  next();
}

// get user by email
function getUserByEmail(email) {
  return new Promise((resolve, reject) => {
    connection.query(
      "SELECT * FROM users WHERE email = ?",
      [email],
      (err, results) => {
        if (err) {
          return reject(err);
        }
        resolve(results);
      }
    );
  });
}

// get user by id
function getUserById(id) {
  return new Promise((resolve, reject) => {
    connection.query(
      "SELECT * FROM users WHERE id = ?",
      [id],
      (err, results) => {
        if (err) {
          return reject(err);
        }
        resolve(results);
      }
    );
  });
}

// check if email already exists
function checkIfEmailExists(email) {
  return new Promise((resolve, reject) => {
    connection.query(
      "SELECT * FROM users WHERE email = ?",
      [email],
      (err, results) => {
        if (err) {
          return reject(err);
        }
        resolve(results.length > 0);
      }
    );
  });
}

function checkIfPhoneExists(phone) {
  return new Promise((resolve, reject) => {
    connection.query(
      "SELECT * FROM users WHERE phone = ?",
      [phone],
      (err, results) => {
        if (err) {
          return reject(err);
        }
        resolve(results.length > 0);
      }
    );
  });
}

function checkIfeAuserExists(eAusername) {
  return new Promise((resolve, reject) => {
    connection.query(
      "SELECT * FROM users WHERE eAusername = ?",
      [eAusername],
      (err, results) => {
        if (err) {
          return reject(err);
        }
        resolve(results.length > 0);
      }
    );
  });
}

module.exports = {
  checkAuthenticated,
  checkNotAuthenticated,
  getUserByEmail,
  getUserById,
  checkIfEmailExists,
  checkIfPhoneExists,
  checkIfeAuserExists,
};
