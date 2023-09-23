const fs = require("fs");

const logsDirectory = "./logs/";
if (!fs.existsSync(logsDirectory)) {
  fs.mkdirSync(logsDirectory);
}
if (!fs.existsSync(`${logsDirectory}/all_logs.log`)) {
  fs.writeFileSync(`${logsDirectory}/all_logs.log`, "");
}
if (!fs.existsSync(`${logsDirectory}/registration.log`)) {
  fs.writeFileSync(`${logsDirectory}/registration.log`, "");
}
if (!fs.existsSync(`${logsDirectory}/update.log`)) {
  fs.writeFileSync(`${logsDirectory}/update.log`, "");
}
if (!fs.existsSync(`${logsDirectory}/login.log`)) {
  fs.writeFileSync(`${logsDirectory}/login.log`, "");
}
if (!fs.existsSync(`${logsDirectory}/logout.log`)) {
  fs.writeFileSync(`${logsDirectory}/logout.log`, "");
}
if (!fs.existsSync(`${logsDirectory}/scrape.log`)) {
  fs.writeFileSync(`${logsDirectory}/scrape.log`, "");
}

const logsStream = fs.createWriteStream(`${logsDirectory}/all_logs.log`, {
  flags: "a",
});
const registrationStream = fs.createWriteStream(
  `${logsDirectory}/registration.log`,
  {
    flags: "a",
  }
);
const updateLogs = fs.createWriteStream(`${logsDirectory}/update.log`, {
  flags: "a",
});
const loginLogs = fs.createWriteStream(`${logsDirectory}/login.log`, {
  flags: "a",
});
const logoutLogs = fs.createWriteStream(`${logsDirectory}/logout.log`, {
  flags: "a",
});
const scrapeLogs = fs.createWriteStream(`${logsDirectory}/scrape.log`, {
  flags: "a",
});

module.exports = {
  logsStream,
  registrationStream,
  updateLogs,
  loginLogs,
  logoutLogs,
  scrapeLogs,
};
