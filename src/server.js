// server.js
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const express = require("express");
const app = express();
const bcrypt = require("bcrypt");
const passport = require("passport");
const initializePassport = require("./config/passport-config");
const flash = require("express-flash");
const session = require("express-session");
const methodOverride = require("method-override");
const connection = require("./config/db");
const user = require("./models/user");
const rateLimit = require("express-rate-limit");
const bodyParser = require("body-parser");
const { parsePhoneNumberFromString } = require("libphonenumber-js");
const scrapeServer = require("./scrapeServer.js");
const multer = require("multer");
const upload = multer();
const MySQLStore = require("express-mysql-session")(session);

const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  expiration: 24 * 60 * 60 * 1000, // Session expiration time (in milliseconds)
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  message:
    "Too many accounts created or too many refreshes of the page! Try again in one hour!",
});

const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: "Too many requests for login in 5 minutes! Try again later!",
});

initializePassport(passport, user.getUserByEmail, user.getUserById);

app.set("view engine", "ejs");
app.set("views", __dirname + "/views");

app.use(express.urlencoded({ extended: false }));
app.use(flash());
app.use(
  session({
    secret: process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: false,
    store: sessionStore, // Use the session store
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    },
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use("/", scrapeServer);
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride("_method"));

// register code
app.post(
  "/registracija",
  registerLimiter,
  user.checkNotAuthenticated,
  async (req, res) => {
    try {
      const {
        name,
        gender,
        phoneNumber,
        email,
        password,
        passwordConfirm,
        eAusername,
        eApassword,
        eApasswordConfirm,
        birthYear,
        className,
      } = req.body;

      const parsedPhoneNumber = parsePhoneNumberFromString(phoneNumber, "SI");
      if (!parsedPhoneNumber || !parsedPhoneNumber.isValid()) {
        req.flash("error", "Neveljavna telefonska številka!");
        return res.redirect("/registracija");
      }

      const phone = parsedPhoneNumber.format("E.164");

      const emailExists = await user.checkIfEmailExists(email);
      const phoneExists = await user.checkIfPhoneExists(phone);
      const eAuserExists = await user.checkIfeAuserExists(eAusername);

      if (emailExists) {
        req.flash(
          "error",
          "Izbrani email je že registriran! Izberite drugega!"
        );
        return res.redirect("/registracija");
      }

      if (phoneExists) {
        req.flash("error", "Izbrana telefonska številka je že registrirana!");
        return res.redirect("/registracija");
      }

      if (eAuserExists) {
        req.flash(
          "error",
          "Vneseno eAsistent uporabniško ime je že registrirano!"
        );
        return res.redirect("/registracija");
      }

      if (eApassword !== eApasswordConfirm || password !== passwordConfirm) {
        req.flash("error", "Gesli se ne ujemata!");
        return res.redirect("/registracija");
      }

      const hashMainPass = await bcrypt.hash(password, 15);

      connection.query(
        "INSERT INTO users (name, email, password, phone, gender, eAusername, eApassword, birthYear, className, status, checkboxState) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          name,
          email,
          hashMainPass,
          phone,
          gender,
          eAusername,
          eApassword,
          birthYear,
          className,
          "pending",
          0,
        ],
        (err, results) => {
          if (err) {
            console.log(err);
            req.flash("error", "An error occurred during registration.");
            return res.redirect("/registracija");
          }
          console.log(results);
          req.flash(
            "success",
            "Registracija uspešna! Sedaj počakaj, da ti odobrimo račun."
          );
          res.redirect("/prijava");
        }
      );
    } catch (e) {
      console.log(e);
      req.flash("error", "Zgodila se je nepričakovana napaka!");
      res.redirect("/registracija");
    }
  }
);

// auto login checkbox check
app.post("/update", upload.none(), (req, res) => {
  console.log("UPDATE");
  const checkboxValue = req.body.checkboxField;
  const username = req.body.username;
  const selectedMenu = req.body["meal-select"];

  connection.query(
    "SELECT * FROM users WHERE eAusername = ?",
    [username],
    (err, results) => {
      if (err) {
        console.error(err);
        return res.sendStatus(500);
      }

      if (results.length === 0) {
        res.sendStatus(404);
        return;
      }

      const dbCheckboxState = results[0].checkboxState;
      const preferedMenu = results[0].preferedMenu;

      if (checkboxValue == dbCheckboxState) {
      } else {
        if (dbCheckboxState == 1) {
          connection.query(
            "UPDATE users SET checkboxState = ? WHERE eAusername = ?",
            ["0", username],
            (err, results) => {
              if (err) {
                console.log(err);
                return res.sendStatus(500);
              }
            }
          );
        } else {
          connection.query(
            "UPDATE users SET checkboxState = ? WHERE eAusername = ?",
            ["1", username],
            (err, results) => {
              if (err) {
                console.log(err);
                return res.sendStatus(500);
              }
            }
          );
        }
      }

      if (selectedMenu != preferedMenu) {
        connection.query(
          "UPDATE users SET preferedMenu = ? WHERE eAusername = ?",
          [selectedMenu, username],
          (err, results) => {
            if (err) {
              console.log(err);
              return res.sendStatus(500);
            }
          }
        );
      }

      res.sendStatus(200);
    }
  );
});

// login code
app.post(
  "/prijava",
  loginLimiter,
  user.checkNotAuthenticated,
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/prijava",
    failureFlash: true,
  })
);

// check if the user is authenticated
function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/prijava");
}

app.get("/", user.checkAuthenticated, (req, res) => {
  user
    .getUserById(req.user.id)
    .then((user) => {
      res.render("index.ejs", {
        name: user[0].name,
        eAusername: user[0].eAusername,
        eApassword: user[0].eApassword,
        checkboxState: user[0].checkboxState,
        preferedMenu: user[0].preferedMenu,
      });
    })
    .catch((e) => {
      console.log(e);
      res.redirect("/prijava");
    });
});

// logout
app.delete("/odjava", (req, res) => {
  req.logout(() => {
    res.redirect("/prijava");
  });
});

// logout
app.get("/odjava", (req, res) => {
  req.logout(() => {
    res.redirect("/prijava");
  });
});

// register page
app.get("/registracija", user.checkNotAuthenticated, (req, res) => {
  res.render("register.ejs");
});

// login page
app.get("/prijava", user.checkNotAuthenticated, (req, res) => {
  res.render("login.ejs");
});

// initialize the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));