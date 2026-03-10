// module.exports = router;

const express = require("express");
const sqlConnection = require("../databases/ssmsConn.js");
const middlewares = require("../middlewares/middlewares.js");

const router = express.Router();

// 1️⃣ Get Spare Part Categories by MouldID
router.get("/categories/:mouldid", (req, res) => {
  const { mouldid } = req.params;

  const request = new sqlConnection.sql.Request();
  request.input("mouldid", sqlConnection.sql.VarChar, mouldid);

  request.query(
    `SELECT DISTINCT SparePartCategory
     FROM Config_SparePartCategory
     WHERE MouldID = @mouldid
        OR SparePartCategory = 'Consumable'`,
    (err, result) => {
      if (err) {
        middlewares.standardResponse(res, null, 300, "Query Error: " + err);
      } else {
        middlewares.standardResponse(res, result.recordset, 200, "Success");
      }
    }
  );
});


router.get("/parts/by-category/:mouldid/:category", (req, res) => {
  const { mouldid, category } = req.params;

  const request = new sqlConnection.sql.Request();
  request.input("mouldid", sqlConnection.sql.Int, mouldid);
  request.input("category", sqlConnection.sql.VarChar, category);

  const query = `
    SELECT ms.SparePartID, ms.SparePartName
    FROM Config_Mould_SparePart ms
    LEFT JOIN Config_SparePartCategory spc
        ON ms.SparePartID = spc.SparePartID
    WHERE 
        (@category = 'Consumable' AND spc.SparePartCategory = 'Consumable')
        OR
        (@category <> 'Consumable' 
            AND spc.MouldID = @mouldid 
            AND spc.SparePartCategory = @category)
  `;

  request.query(query, (err, result) => {
    if (err) {
      middlewares.standardResponse(res, null, 300, "Query Error: " + err);
    } else {
      middlewares.standardResponse(res, result.recordset, 200, "Success");
    }
  });
});


// 3️⃣ Get Spare Part Details by SparePartName
router.get("/details/by-name/:sparename", (req, res) => {
  const { sparename } = req.params;
  new sqlConnection.sql.Request().query(
    `SELECT  s.SparePartName,s.SparePartSize,s.MinQuantity,s.MaxQuantity,s.ReorderLevel,s.SparePartMake,s.LastUpdatedTime,ms.CurrentQuantity
     FROM Config_Mould_SparePart s
	 join Mould_SparePartMonitoring ms ON  ms.SparePartID = s.SparePartID
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

// 3️⃣ Get Spare Part Details by SparePartName
router.get("/location/by-name/:sparename", (req, res) => {
  const { sparename } = req.params;
  new sqlConnection.sql.Request().query(
    `SELECT  s.SparePartName,sl.SparePartID,sl.LocationID,sl.Timestamp,sl.Quantity
     FROM Config_Mould_SparePart s
	 join Config_SparePartLocation sl ON  sl.SparePartID = s.SparePartID
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

router.post("/movement", async (req, res) => {
  const { MouldID, SparePartID, locations } = req.body;

  try {
    const totalConsumed = locations.reduce(
      (sum, item) => sum + Number(item.Quantity),
      0
    );

    let request = new sqlConnection.sql.Request();

    // Build dynamic SQL for multiple location updates
    let locationUpdates = "";
    locations.forEach((item) => {
      locationUpdates += `
        UPDATE Config_SparePartLocation
        SET Quantity = Quantity - ${item.Quantity}
        WHERE SparePartID = ${SparePartID}
          AND LocationID = '${item.LocationID}';
      `;
    });

    const finalQuery = `
      BEGIN TRAN;

      -- Main spare part monitoring update
      UPDATE Mould_SparePartMonitoring 
      SET CurrentQuantity = CurrentQuantity - ${totalConsumed}, 
          LastUpdatedTime = GETDATE()
      WHERE SparePartID = ${SparePartID};

      -- Genealogy entry
      INSERT INTO Mould_SparePartGenealogy 
        (MouldID, SparePartID, ConsumedQuantity, Remark, Timestamp)
      VALUES 
        ('${MouldID}', ${SparePartID}, ${totalConsumed}, '', GETDATE());

      -- Multiple locations update
      ${locationUpdates}

      COMMIT TRAN;
    `;

    await request.query(finalQuery);

    return middlewares.standardResponse(res, null, 200, "success");

  } catch (err) {
    console.error("Movement Error:", err);

    // ROLLBACK safely
    try {
      await new sqlConnection.sql.Request().query("ROLLBACK TRAN;");
    } catch {}

    return middlewares.standardResponse(
      res,
      null,
      300,
      "Error executing query: " + err
    );
  }
});


module.exports = router;
