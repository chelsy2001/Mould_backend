const express = require("express");
const sqlConnection = require("../databases/ssmsConn.js");
const middlewares = require("../middlewares/middlewares.js");

const router = express.Router();

router.patch("/update", (request, response) => {
  const { MouldID } = request.body;
  const sqlRequest = new sqlConnection.sql.Request();
  sqlRequest.input('MouldID', sqlConnection.sql.NVarChar, MouldID);
  sqlRequest.execute('SP_OnPMConfirmationButton', (err, result) => {
      if (err) {
        if (err.originalError && err.originalError.info && err.originalError.info.number === 50001) {
            middlewares.standardResponse(
                response,
                null,
                409, // Conflict
                err.originalError.info.message
            );
        } else {
            middlewares.standardResponse(
              response,
              null,
              500, // Internal Server Error
              "Error executing query: " + err
            );
            console.error("Error executing query:", err);
        }
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
