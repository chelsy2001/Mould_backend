const sql = require("mssql");

const config = {
  user: "Admin",
  password: "IAC@123",
  server: "DESKTOP-URBGBGQ",
  database: "PPMS_Solution",
  options: {
    encrypt: false,
    trustServerCertificate: true, // Important for local connections
  },
  port: 1433, // Ensure this is correct
};

sql.connect(config, (err) => {
  if (err) {
    console.error("SQL Connection Error:", err);
  } else {
    console.log("Connected to SQL Server!");
  }
});

module.exports = { sql };
