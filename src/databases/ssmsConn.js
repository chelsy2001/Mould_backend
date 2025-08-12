const sql = require("mssql");

// SQL Server configuration
var config = {
 user: "Bajaj", // Database username
  password: "Bajaj@123", // Database password
  server: "DESKTOP-URBGBGQ", // Server IP address
  database: "PPMS_LILBawal",
  options: {
    encrypt: false, // Disable encryption
  },
};

// Connect to SQL Server
sql.connect(config, (err) => {
  if (err) {
    throw err;
  }
  console.log("Connection Successful!");
});
module.exports = { sql };
