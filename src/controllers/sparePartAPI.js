// module.exports = router;

const express = require("express");
const sqlConnection = require("../databases/ssmsConn.js");
const middlewares = require("../middlewares/middlewares.js");

const router = express.Router();

// 1️⃣ Get Spare Part Categories by MouldID
router.get("/categories/:mouldid", (req, res) => {
  const { mouldid } = req.params;
  new sqlConnection.sql.Request().query(
    `SELECT DISTINCT spc.SparePartCategoryID, spc.SparePartCategoryName
     FROM Config_SparePartCategory spc
     JOIN Config_Mould_SparePart sp ON sp.SparePartCategoryID = spc.SparePartCategoryID
     JOIN Config_Mould m ON m.MouldGroupID = sp.MouldGroupID
     WHERE m.MouldID = '${mouldid}'`,
    (err, result) => {
      if (err) {
        middlewares.standardResponse(res, null, 300, "Query Error: " + err);
      } else {
        middlewares.standardResponse(res, result.recordset, 200, "Success");
      }
    }
  );
});

// 2️⃣ Get Spare Part Names by SparePartCategoryID
router.get("/parts/by-category/:categoryid", (req, res) => {
  const { categoryid } = req.params;
  new sqlConnection.sql.Request().query(
    `SELECT SparePartID, SparePartName 
     FROM Config_Mould_SparePart
     WHERE SparePartCategoryID = ${categoryid}`,
    (err, result) => {
      if (err) {
        middlewares.standardResponse(res, null, 300, "Query Error: " + err);
      } else {
        middlewares.standardResponse(res, result.recordset, 200, "Success");
      }
    }
  );
});

// 2️⃣ Get Spare Part Names by SparePartCategoryID
router.get("/parts/by-category-prefferd/:categoryid", (req, res) => {
  const { categoryid } = req.params;
  new sqlConnection.sql.Request().query(
    `SELECT  SparePartName 
     FROM Config_Mould_SparePart
     WHERE SparePartCategoryID = ${categoryid} AND PreferredSparePart = 1`,
    (err, result) => {
      if (err) {
        middlewares.standardResponse(res, null, 300, "Query Error: " + err);
      } else {
        middlewares.standardResponse(res, result.recordset, 200, "Success");
      }
    }
  );
});

// 3️⃣ Get Spare Part Details by SparePartName
router.get("/details/by-name/:sparename", (req, res) => {
  const { sparename } = req.params;
  new sqlConnection.sql.Request().query(
    `SELECT *
     FROM Config_Mould_SparePart
     WHERE SparePartName = '${sparename}'`,
    (err, result) => {
      if (err) {
        middlewares.standardResponse(res, null, 300, "Query Error: " + err);
      } else {
        middlewares.standardResponse(res, result.recordset, 200, "Success");
      }
    }
  );
});

// 4️⃣ Get Mould Group Name by MouldID
router.get("/mouldgroup/:mouldid", (req, res) => {
  const { mouldid } = req.params;
  new sqlConnection.sql.Request().query(
    `SELECT mg.MouldGroupName
     FROM Config_MouldGroup mg
     JOIN Config_Mould m ON m.MouldGroupID = mg.MouldGroupID
     WHERE m.MouldID = ${mouldid}`,
    (err, result) => {
      if (err) {
        middlewares.standardResponse(res, null, 300, "Query Error: " + err);
      } else {
        middlewares.standardResponse(res, result.recordset[0], 200, "Success");
      }
    }
  );
});

router.post("/movement", (request, response) => {
  new sqlConnection.sql.Request().query(
    `UPDATE Mould_SparePartMonitoring SET CurrentQuantity = CurrentQuantity -  ${request.body.Quantity}, LastUpdatedTime = GETDATE() WHERE SparePartID  = ${request.body.SparePartID}
    Insert Into Mould_SparePartGenealogy ([MouldID],[SparePartID],[CurrentQuantity],[Remark],[Timestamp]) Values (\'${request.body.MouldID}\',${request.body.SparePartID},(SELECT TOP(1) CurrentQuantity FROM Mould_SparePartMonitoring WHERE SparePartID  = ${request.body.SparePartID}),'',GETDATE())
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

// 5️⃣ Get Current Quantity and Location by SparePartID
router.get("/monitoring/:sparePartId", (req, res) => {
  const { sparePartId } = req.params;
  new sqlConnection.sql.Request().query(
    `SELECT CurrentQuantity, SparePartLoc 
     FROM Mould_SparePartMonitoring 
     WHERE SparePartID = ${sparePartId}`,
    (err, result) => {
      if (err) {
        middlewares.standardResponse(res, null, 300, "Query Error: " + err);
      } else {
        middlewares.standardResponse(res, result.recordset[0], 200, "Success");
      }
    }
  );
});



module.exports = router;
