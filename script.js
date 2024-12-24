// Get DOM elements
const fileInput = document.getElementById("upload");
const processButton = document.getElementById("processButton");
const statusMessage = document.getElementById("status");
const downloadButton = document.getElementById("downloadButton");
const viewButton = document.getElementById("viewButton")


// Helper function to convert binary string to ArrayBuffer
function s2ab(s) {
    const buf = new ArrayBuffer(s.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < s.length; i++) {
        view[i] = s.charCodeAt(i) & 0xff;
    }
    return buf;
}

// Function to calculate SMS parts
function calculateSMSParts(text) {
    if (typeof text !== "string") return 1; // Default to 1 if invalid data

    const GSM7_BASIC =
        "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ¡¿" +
        "ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿" +
        "abcdefghijklmnopqrstuvwxyzäöñüà" +
        "0123456789" +
        " !\"#¤%&'()*+,-./:;<=>?";
    const GSM7_EXTENDED = "^{}\\[~]|€";

    function isGSM7(char) {
        return GSM7_BASIC.includes(char) || GSM7_EXTENDED.includes(char);
    }

    const isGSM7Encoding = Array.from(text).every(isGSM7);
    const maxLengthSingle = isGSM7Encoding ? 160 : 70;
    const maxLengthConcat = isGSM7Encoding ? 153 : 67;

    return text.length <= maxLengthSingle
        ? 1
        : Math.ceil(text.length / maxLengthConcat);
}

// Function to process the Excel data
function processExcelData(data) {
    const headerRow = data[0]; // First row is the header
    const processedData = [headerRow.slice(0, 3)]; // Keep first 3 columns

    // Add new headers for encoded and SMS parts
    for (let colIndex = 3; colIndex < headerRow.length; colIndex++) {
        processedData[0].push(
            headerRow[colIndex],
            headerRow[colIndex] + " (Encoded)",
            headerRow[colIndex] + " (PDU)"
        );
    }

    // Process each row
    for (let rowIndex = 1; rowIndex < data.length; rowIndex++) {
        const row = data[rowIndex];
        const newRow = row.slice(0, 3); // Keep first 3 columns

        for (let colIndex = 3; colIndex < row.length; colIndex++) {
            const cellData = row[colIndex] || ""; // Default to empty string
            const encodedValue = cellData
                ? encodeURIComponent(cellData)
                      .replace(/'/g, "%27")
                      .replace(/"/g, "%22")
                : "";
            const smsPartsValue = cellData ? calculateSMSParts(cellData) : 1;

            newRow.push(cellData, encodedValue, smsPartsValue);
        }

        processedData.push(newRow); // Add the processed row
    }

    return processedData;
}

// Function to create and download the processed Excel file
function createAndDownloadExcel(data) {
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Processed_Data");

    const excelFile = XLSX.write(workbook, { bookType: "xlsx", type: "binary" });
    const blob = new Blob([s2ab(excelFile)], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);

    // const downloadButton = document.getElementById("downloadButton");
    downloadButton.href = url;
    downloadButton.style.display = "block";

}

// Function to create a styled HTML table and display it in a new tab
function displayProcessedDataInNewTab(data) {
    const newTab = window.open("", "_blank");

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Processed File</title>
       <style>
    body {
        font-family: Arial, sans-serif;
        margin: 0;
        padding: 0;
        background-color: #f9f9f9;
    }
    .container {
        padding: 20px;
    }
    .processed-table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
        background: #ffffff;
        table-layout: auto; /* Ensures consistent cell width */
    }
    .processed-table th, .processed-table td {
        border: 1px solid #ddd;
        padding: 10px;
        text-align: center;
        vertical-align: top;
        word-wrap: break-word;
        word-break: break-word;
    }
    .processed-table th {
        background-color: #f4f4f4;
        font-weight: bold;
    }
    .processed-table td {
        min-width: 200px; /* Adjust minimum width */
    }
    .table-container {
        overflow-x: auto;
        max-height: 90vh;
    }
</style>
    </head>
    <body>
        <div class="container">
            <h1>Processed File</h1>
            <div class="table-container">
                <table class="processed-table">
                    ${data
                        .map(
                            (row, rowIndex) =>
                                `<tr>${row
                                    .map(
                                        cell =>
                                            `<${rowIndex === 0 ? "th" : "td"}>${cell}</${
                                                rowIndex === 0 ? "th" : "td"
                                            }>`
                                    )
                                    .join("")}</tr>`
                        )
                        .join("")}
                </table>
            </div>
        </div>
    </body>
    </html>`;

    newTab.document.open();
    newTab.document.write(html);
    newTab.document.close();
}


// Reset status and download button when a new file is selected
fileInput.addEventListener("click", function () {
    statusMessage.textContent = ""; // Clear status message
    downloadButton.style.display = "none"; // Hide the download button
    viewButton.style.display = "none";
});


// Event listener for "Process and Encode" button
processButton.addEventListener("click", function () {
    // const fileInput = document.getElementById("upload");

    if (!fileInput.files.length) {
        alert("Please upload an Excel file first.");
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (!jsonData || jsonData.length < 2) {
            alert("Invalid sheet structure. Ensure at least two rows and proper columns.");
            return;
        }

        const processedData = processExcelData(jsonData);
        createAndDownloadExcel(processedData);

        // document.getElementById("viewButton").style.display = "flex";
        viewButton.style.display = "Flex";
        statusMessage.innerHTML = `
        <img src="./asset/icons8-success.svg" alt="Success Icon" style="width: 24px; vertical-align: middle;">
        File processed successfully! Click "Download Encoded File" to download.
        `;
    };
    reader.readAsArrayBuffer(fileInput.files[0]);
});

// Event listener for "View Processed File" button
viewButton.addEventListener("click", function () {
    // const fileInput = document.getElementById("upload");

    if (!fileInput.files.length) {
        alert("Please upload an Excel file first.");
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (!jsonData || jsonData.length < 2) {
            alert("Invalid sheet structure. Ensure at least two rows and proper columns.");
            return;
        }

        const processedData = processExcelData(jsonData);
        displayProcessedDataInNewTab(processedData);
    };
    reader.readAsArrayBuffer(fileInput.files[0]);
});
