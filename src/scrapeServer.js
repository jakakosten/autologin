const express = require("express");
const puppeteer = require("puppeteer");
const multer = require("multer");
const moment = require("moment");
const router = express.Router();
const cron = require("node-cron");
const connection = require("./config/db");
const { logsStream, scrapeLogs } = require("./handlers/logHandler.js");

router.use(express.static(__dirname));
router.use(express.urlencoded({ extended: true }));

router.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Define a Map to track active browsers by username
const activeBrowsers = new Map();

async function scrape(req, res) {
  connection.query(
    "SELECT * FROM users WHERE checkboxState = 1",
    async (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).send({ error: "Database query error!" });
      }

      const days = 7;

      for (const user of results) {
        if (!activeBrowsers.has(user.eAusername)) {
          await runScraping(user, days);
        }
      }
    }
  );
}

async function runScraping(user, days) {
  const MEAL_CODE = user.preferedMenu;
  const username = user.eAusername;
  const password = user.eApassword;

  connection.query(
    "SELECT id, email FROM users WHERE eAusername = ?",
    [username],
    async (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).send({ error: "Database query error!" });
      }

      if (results.length === 0) {
        console.error(`User not found for username: ${username}`);
        return;
      }

      const userId = results[0].id;
      const userEmail = results[0].email;

      // log writing start
      let now = new Date();
      let formattedDate = now.toISOString().slice(0, 10);
      let formattedTime = now.toTimeString().slice(0, 8);

      let logMessage = `[ SCRAPE | ${formattedDate} | ${formattedTime} ] Scrape/Autologin process started for user with id: ${userId} email: ${userEmail} at: ${formattedDate} ${formattedTime}\n`;

      console.log(logMessage);
      logsStream.write(logMessage);
      scrapeLogs.write(logMessage);
      // end of log writing
    }
  );

  const DIJAKI_PREHRANA = "dijaki-prehrana";
  const INSTITUTION_ID = "11239";
  const ACTION = "akcija";

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Navigate to login page
  await page.goto("https://www.easistent.com/");

  await page.setViewport({
    width: 0,
    height: 0,
    deviceScaleFactor: 1,
  });

  await page.evaluate((scrollAmount) => {
    window.scrollBy(0, scrollAmount);
  }, 250);

  await delay(2000);
  await page.waitForSelector("#username");
  await page.type("#username", username);
  await page.type("#password", password);
  await Promise.all([page.click("#submit-login-form")]);

  await delay(2500);

  // Navigate to students meals page
  await page.goto("https://www.easistent.com/prehrana/dijaki");

  const currUrl = await page.url();
  const expectedUrl = "https://www.easistent.com/prehrana/dijaki";
  const errUrl =
    "https://www.easistent.com/?prijava_redirect=%2Fprehrana%2Fdijaki";

  if (currUrl == errUrl) {
    await page.goto("https://www.easistent.com/");

    await page.setViewport({
      width: 0,
      height: 0,
      deviceScaleFactor: 1,
    });

    await delay(2000);

    await page.evaluate((scrollAmount) => {
      window.scrollBy(0, scrollAmount);
    }, 250);

    await page.type("#username", username);
    await delay(1500);
    await page.type("#password", password);
    await delay(1500);
    await Promise.all([page.click("#submit-login-form")]);
    await delay(1500);

    await page.goto("https://www.easistent.com/prehrana/dijaki", {
      timeout: 10000,
      waitUntil: "domcontentloaded",
    });

    await delay(5000);

    await page.evaluate((scrollAmount) => {
      window.scrollBy(0, scrollAmount);
    }, 300);
  }

  if (currUrl != expectedUrl) {
    console.log(`Wrong page! Current URL: ${currUrl}`);
    await delay(1000);
    await browser.close();
  }

  await page.evaluate((scrollAmount) => {
    window.scrollBy(0, scrollAmount);
  }, 250);

  await loginToMeal(page, days);

  async function loginToMeal(page, days) {
    let selectedDay = moment();
    let endDate = moment().startOf("day").add(days, "days");
    const maxTimeout = 2500;

    while (selectedDay.isSameOrBefore(endDate)) {
      let dayOfWeek = selectedDay.day();
      let isBefore11AM = moment(selectedDay).isBefore(
        moment(selectedDay).startOf("day").add(11, "hours")
      );

      try {
        let date = selectedDay.format("YYYY-MM-DD");

        let loginLinkSelector = `#${DIJAKI_PREHRANA}-${date}-${MEAL_CODE}-${INSTITUTION_ID}-${ACTION} > a `;

        await page.waitForSelector(loginLinkSelector, {
          timeout: maxTimeout,
        });
        await page.click(loginLinkSelector);

        try {
          await page.on("dialog", async (dialog) => {
            console.log(dialog.message());
            await dialog.accept();
          });
        } catch (error) {
          console.error(error);
        }

        await page.waitForSelector("#popup-confirm-action");
        await page.click("#popup-confirm-action");

        await delay(2000);
      } catch (error) {
        console.log(
          `Could not click on login link for the date: ${selectedDay.format(
            "YYYY-MM-DD"
          )}`
        );
        if (dayOfWeek === 5 && !isBefore11AM) {
          console.log(`Today is weekday ${dayOfWeek} and we are skipping it.`);
        }

        if (dayOfWeek === 6 || dayOfWeek === 0) {
          console.log(`Today is weekday ${dayOfWeek} and we are skipping it`);
        }
      }

      if (dayOfWeek === 0) {
        const nextPageBtn =
          "#dijaki-prehrana-vsebina > table > tbody > tr > td:nth-child(3) > a > img";

        await page.waitForSelector(nextPageBtn);
        await page.click(nextPageBtn);

        await delay(2500);
      }

      selectedDay = selectedDay.add(1, "day");
    }
  }

  await delay(2000);
  await browser.close();

  connection.query(
    "SELECT id, email FROM users WHERE eAusername = ?",
    [username],
    async (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).send({ error: "Database query error!" });
      }

      if (results.length === 0) {
        console.error(`User not found for username: ${username}`);
        return;
      }

      const userId = results[0].id;
      const userEmail = results[0].email;

      // log writing start
      let now = new Date();
      let formattedDate = now.toISOString().slice(0, 10);
      let formattedTime = now.toTimeString().slice(0, 8);

      let logMessage = `[ SCRAPE | ${formattedDate} | ${formattedTime} ] Scrape/Autologin process ended for user with id: ${userId} email: ${userEmail} at: ${formattedDate} ${formattedTime}\n`;

      console.log(logMessage);
      logsStream.write(logMessage);
      scrapeLogs.write(logMessage);
      // end of log writing
    }
  );

  activeBrowsers.delete(username);
}

cron.schedule("*/35 * * * * * ", scrape);
module.exports = router;
