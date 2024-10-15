const sql = require("mssql");

// SQL Server configuration
var config = {
  user: "Shubh", // Database username
  password: "123456", // Database password
  server: "DESKTOP-USIN59D\\SQLEXPRESS", // Server IP address
  database: "PPMS", // Database name
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
