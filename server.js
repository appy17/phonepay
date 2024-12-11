const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();
const xlsx = require("xlsx");
const fs = require("fs");
const app = express();

app.use(express.json());
app.use(cors());

// const MERCHANT_KEY = "96434309-7796-489d-8924-ab56988a6076";
// const MERCHANT_ID = "PGTESTPAYUAT86";
const MERCHANT_KEY=   process.env.MERCHANT_KEY 
const MERCHANT_ID=  process.env.MERCHANT_ID


const MERCHANT_BASE_URL = process.env.MERCHANT_BASE_URL 
const MERCHANT_STATUS_URL = process.env.MERCHANT_STATUS_URL

// const MERCHANT_BASE_URL =
//   "https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay";
// const MERCHANT_STATUS_URL =
//   "https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/status";

const redirectUrl = "https://zerotoheroacademy.co.in/pg/v1/status";

// const successUrl = "https://zerotoheroacademy.co.in/payment-success";
const successUrl = "https://zerotoheroacademy.co.in/payment-success";

const failureUrl = "https://zerotoheroacademy.co.in/payment-failure";






function saveToExcel(data) {
  const filePath = "./payment_data.xlsx";
  let workbook;

  // Check if the file exists
  if (fs.existsSync(filePath)) {
    // Read the existing workbook
    workbook = xlsx.readFile(filePath);
  } else {
    // Create a new workbook
    workbook = xlsx.utils.book_new();
  }

  // Get or create a worksheet
  let worksheet = workbook.Sheets["Payments"];
  if (!worksheet) {
    worksheet = xlsx.utils.json_to_sheet([]);
    xlsx.utils.book_append_sheet(workbook, worksheet, "Payments");
  }

  // Convert existing worksheet to JSON and add new data
  const existingData = xlsx.utils.sheet_to_json(worksheet);
  existingData.push(data);

  // Convert JSON back to worksheet
  const updatedWorksheet = xlsx.utils.json_to_sheet(existingData);

  // Append updated worksheet to workbook
  workbook.Sheets["Payments"] = updatedWorksheet;

  // Save the workbook
  xlsx.writeFile(workbook, filePath);
  console.log("Data saved to Excel file");
}

// app.get("/", (req,res)=> {
//   res.send("Welcome to PhonePe Payment Gateway up");
// })





app.post("/create-order", async (req, res) => {
  const { name, mobileNumber, amount } = req.body;
  const orderId = uuidv4();


  const paymentPayload = {
    merchantId: MERCHANT_ID,
    merchantUserId: name,
    mobileNumber: mobileNumber,
    amount: amount * 100,
    merchantTransactionId: orderId,
    redirectUrl: `${redirectUrl}/?id=${orderId}`,
    redirectMode: "POST",
    paymentInstrument: {
      type: "PAY_PAGE",
    },
  };

  const payload = Buffer.from(JSON.stringify(paymentPayload)).toString("base64");
  const keyIndex = 1;
  const string = payload + "/pg/v1/pay" + MERCHANT_KEY;
  const sha256 = crypto.createHash("sha256").update(string).digest("hex");
  const checksum = sha256 + "###" + keyIndex;

  const option = {
    method: "POST",
    url: MERCHANT_BASE_URL,
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      "X-VERIFY": checksum,
    },
    data: {
      request: payload,
    },
  };
  try {
    const response = await axios.request(option);

    // Save to Excel
    saveToExcel({
      name,
      mobileNumber,
      amount,
      transactionId: orderId,
      status: "Initiated",
    });

    res.status(200).json({
      msg: "OK",
      url: response.data.data.instrumentResponse.redirectInfo.url,
    });
  } catch (error) {
    console.log("Error in payment", error);
    res.status(500).json({ error: "Failed to initiate payment" });
  }
});

app.post("/status", async (req, res) => {
  const merchantTransactionId = req.query.id;

  const keyIndex = 1;
  const string =
    `/pg/v1/status/${MERCHANT_ID}/${merchantTransactionId}` + MERCHANT_KEY;
  const sha256 = crypto.createHash("sha256").update(string).digest("hex");
  const checksum = sha256 + "###" + keyIndex;

//   const option = {
//     method: "GET",    //GET
//     url: `${MERCHANT_STATUS_URL}/${MERCHANT_ID}/${merchantTransactionId}`,
//     headers: {
//       accept: "application/json",
//       "Content-Type": "application/json",
//       "X-VERIFY": checksum,
//       "X-MERCHANT-ID": MERCHANT_ID,
//     },
//     data:{
//       request: payload
//     }
//   };


//   axios.request(option).then((response) => {
//     console.log(response.data)
//     if (response.data.success === true) {
//       return res.redirect(successUrl);
//     } else {
//       return res.redirect(failureUrl);
//     }
//   });
// });




const option = {
  method: "GET",
  url: `${MERCHANT_STATUS_URL}/${MERCHANT_ID}/${merchantTransactionId}`,
  headers: {
    accept: "application/json",
    "Content-Type": "application/json",
    "X-VERIFY": checksum,
    "X-MERCHANT-ID": MERCHANT_ID,
  },
};

try {
  const response = await axios.request(option);

  // Update status in Excel
  saveToExcel({
    transactionId: merchantTransactionId,
    status: response.data.success ? "Success" : "Failure",
  });

  if (response.data.success === true) {
    return res.redirect(`${successUrl}?paymentStatus=success`);
  } else {
    return res.redirect(`${failureUrl}?paymentStatus=failure`);
  }
} catch (error) {
  console.error("Error checking payment status:", error);
  return res.redirect(`${failureUrl}?paymentStatus=failure`);
}
});
const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
