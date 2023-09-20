const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcrypt");

function initialize(passport, getUserByEmail, getUserById) {
  const authenticateUser = async (email, password, done) => {
    try {
      const user = await getUserByEmail(email);
      if (user.length === 0) {
        return done(null, false, { message: "Invalid email or password" });
      }

      const userStatus = await user[0].status; // Renamed 'status' to 'userStatus'
      if (userStatus !== "approved") {
        return done(null, false, {
          message:
            "Tvoj račun še ni bil potrjen. Če se ti zdi napaka, kontaktiraj administratorja!",
        });
      }

      const match = await bcrypt.compare(password, user[0].password);
      if (match) {
        return done(null, user[0]);
      } else {
        return done(null, false, { message: "Invalid email or password" });
      }
    } catch (e) {
      return done(e);
    }
  };

  passport.use(new LocalStrategy({ usernameField: "email" }, authenticateUser));
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await getUserById(id);
      return done(null, user[0]);
    } catch (e) {
      return done(e);
    }
  });
}

module.exports = initialize;
