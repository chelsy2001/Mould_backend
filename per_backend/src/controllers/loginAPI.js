const express = require("express");
const sqlConnection = require("../databases/ssmsConn.js");
const middlewares = require("../middlewares/middlewares.js");

const router = express.Router();

router.get("/users", (request, response) => {
  new sqlConnection.sql.Request().query(
    "SELECT [UserName] FROM [Config_User]",
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

router.post("", (request, response) => {
  new sqlConnection.sql.Request().query(
    "SELECT Count(1) AS temp FROM [Config_User] WHERE UserName = '" +
      request.body.name +
      "' AND Password = '" +
      request.body.pass +
      "'",
    (err, result) => {
      console.log(result.recordset[0].temp);
      if (err) {
        middlewares.standardResponse(
          response,
          null,
          300,
          "Error executing query: " + err
        );
        console.error("Error executing query:", err);
      } else {
        if (parseInt(result.recordset[0].temp) > 0) {
          middlewares.standardResponse(response, null, 200, "success");
        } else {
          middlewares.standardResponse(
            response,
            null,
            300,
            "failure/ validation failed"
          );
        }
      }
    }
  );
});

module.exports = router;
