const express = require("express");
const sqlConnection = require("../databases/ssmsConn");
const middlewares = require("../middlewares/middlewares.js");

const router = express.Router();

// Define your routes here
router.get("/users", (request, response) => {
  // Execute a SELECT query
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
        // response.send(result.recordset); // Send query result as response
        console.dir(result.recordset);
      }
    }
  );
});

// Define route for fetching data from SQL Server
router.get("/:name/:pass", (request, response) => {
  // Execute a SELECT query
  new sqlConnection.sql.Request().query(
    "SELECT Count(1) as temp FROM [Config_User] where UserName = '" +
      request.params.name +
      "' and Password = '" +
      request.params.pass +
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
