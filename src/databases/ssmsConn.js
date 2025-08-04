const sql = require("mssql");

// SQL Server configuration
var config = {
 user: "sa", // Database username
  password: "root", // Database password
  server: "DESKTOP-T266BV5\\SQLEXPRESS", // Server IP address
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
