const express = require("express");
const sqlConnection = require("../databases/ssmsConn.js");
const middlewares = require("../middlewares/middlewares.js");

const router = express.Router();

// Define your routes here
router.patch("/update", (request, response) => {
  // Execute a SELECT  query
  new sqlConnection.sql.Request().query(
    `update Mould_Monitoring set MouldPMStatus = ${request.body.MouldPMStatus} where MachineID = ${request.body.MachineID} and MouldID = ${request.body.MouldID}`,
    (err, result) => {
      if (err) {
        middlewares.standardResponse(
          response,
          null,
          300,
          "Error executing query: " + err
        );
        console.error("Error executing query:", err);
      } else {
        middlewares.standardResponse(
          response,
          result.recordset,
          200,
          "success"
        );
        // response.send(result.recordset); // Send query result as response
        console.dir(result.recordset);
      }
    }
  );
});

module.exports = router;
