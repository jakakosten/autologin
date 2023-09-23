// config/db.js
const mysql = require("mysql2");
const dotenv = require("dotenv");
dotenv.config({ path: "./../../.env" });

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

try {
  connection.connect((err) => {
    if (err) {
      console.error("Database connection failed: ", err.stack);
      return;
    }
    console.log("Connected to the database");
  });
} catch (err) {
  console.log(err);
}

module.exports = connection;
