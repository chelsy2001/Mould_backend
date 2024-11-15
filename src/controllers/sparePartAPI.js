const express = require("express");
const sqlConnection = require("../databases/ssmsConn.js");
const middlewares = require("../middlewares/middlewares.js");

const router = express.Router();

router.get("/:mouldid", (request, response) => {
  new sqlConnection.sql.Request().query(
    `SELECT 
    SP.SparePartID,
    SP.SparePartName,
    SP.SparePartSize,
    SP.MinQuantity,
    SP.MaxQuantity,
    SP.ReorderLevel,
    SPM.SparePartLoc,
    SPM.CurrentQuantity,
    SPM.SparePartStatus,
    SPM.SparePartStatus
FROM 
    Config_SparePart AS SP
JOIN 
    Mould_SparePartMonitoring AS SPM ON SP.SparePartID = SPM.SparePartID
WHERE 
    SP.MouldID = \'${request.params.mouldid}\';`,
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

router.post("/movement", (request, response) => {
  new sqlConnection.sql.Request().query(
    `UPDATE Mould_SparePartMonitoring SET CurrentQuantity = CurrentQuantity -  ${request.body.Quantity}, LastUpdatedTime = GETDATE() WHERE SparePartID  = ${request.body.SparePartID}
    Insert Into [PPMS].[dbo].[SparePartGenealogy] ([MouldID],[SparePartID],[CurrentQuantity],[Remark],[Timestamp]) Values (\'${request.body.MouldID}\',${request.body.SparePartID},(SELECT TOP(1) CurrentQuantity FROM Mould_SparePartMonitoring WHERE SparePartID  = ${request.body.SparePartID}),'',GETDATE())
    `,
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
