const express = require("express");
const sqlConnection = require("../databases/ssmsConn.js");
const middlewares = require("../middlewares/middlewares.js");

const router = express.Router();

router.patch("/update", (request, response) => {
  new sqlConnection.sql.Request().query(
    `UPDATE Mould_Monitoring SET MouldPMStatus = ${request.body.MouldPMStatus} WHERE MouldID = ${request.body.MouldID}`,
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
        console.dir(result.recordset);
      }
    }
  );
});

module.exports = router;
