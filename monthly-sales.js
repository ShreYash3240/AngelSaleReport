// ==================================================
// MONTHLY SALES MATRIX - JAVASCRIPT (AWS CLOUD INTEGRATED)
// ==================================================

// --------------------------------------------------
// CONFIGURATION: SET YOUR API GATEWAY URL HERE
// --------------------------------------------------
const API_BASE_URL = "https://myen97dfp7.execute-api.ap-south-1.amazonaws.com";

const salesMonth = document.getElementById("salesMonth");
const monthlyBranchFilter = document.getElementById("monthlyBranchFilter");
const exportXlsxBtn = document.getElementById("exportXlsxBtn");
const monthlySalesBody = document.getElementById("monthlySalesBody");
const tableTotalsFooter = document.getElementById("tableTotalsFooter");
const clearMonthBtn = document.getElementById("clearMonthBtn");
const clearAllDataBtn = document.getElementById("clearAllDataBtn");

const XLSX_COLUMNS = [
    "SHIRT", "HALF PANTS", "FULL PANTS", "SKIRT", 
    "SHOES", "SOCKS", "BLEZZER", "PT SHIRT", "PT PANTS"
];

const today = new Date();
if (salesMonth) {
    salesMonth.value = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0");
}

if (monthlyBranchFilter) {
    const savedBranch = localStorage.getItem("selectedBranch");
    if (savedBranch) {
        monthlyBranchFilter.value = savedBranch;
    }
    monthlyBranchFilter.addEventListener("change", () => {
        if (monthlyBranchFilter.value !== "All") {
            localStorage.setItem("selectedBranch", monthlyBranchFilter.value);
        }
        displayMonthlySales();
    });
}

function isJuniorBoyStandard(std) {
    const juniors = ["Nursery", "LKG", "UKG", "1st", "2nd", "3rd", "4th", "5th", "6th"];
    return juniors.includes(std);
}

function formatToExcelDate(dateStr) {
    if (!dateStr) return "";
    const parts = dateStr.trim().split("-");
    if (parts.length !== 3) return dateStr;
    const year = parts[0];
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = parts[2].padStart(2, "0");

    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const month = months[monthIndex] || parts[1];
    return `${day}-${month}-${year}`;
}

function expandBillItems(bill) {
    const expanded = {};

    (bill.items || []).forEach(item => {
        const name = (item.name || "").trim().toUpperCase();
        const qty = Number(item.quantity) || 0;
        if (qty <= 0) return;

        if (name === "UNIFORM SET") {
            if (bill.gender === "Girl") {
                expanded["SHIRT"] = (expanded["SHIRT"] || 0) + qty;
                expanded["SKIRT"] = (expanded["SKIRT"] || 0) + qty;
                expanded["SHOES"] = (expanded["SHOES"] || 0) + qty;
                expanded["SOCKS"] = (expanded["SOCKS"] || 0) + qty;
            } else if (bill.gender === "Boy" && isJuniorBoyStandard(bill.standard)) {
                expanded["SHIRT"] = (expanded["SHIRT"] || 0) + qty;
                expanded["HALF PANTS"] = (expanded["HALF PANTS"] || 0) + qty;
                expanded["SHOES"] = (expanded["SHOES"] || 0) + qty;
                expanded["SOCKS"] = (expanded["SOCKS"] || 0) + qty;
            } else {
                expanded["SHIRT"] = (expanded["SHIRT"] || 0) + qty;
                expanded["FULL PANTS"] = (expanded["FULL PANTS"] || 0) + qty;
                expanded["SHOES"] = (expanded["SHOES"] || 0) + qty;
                expanded["SOCKS"] = (expanded["SOCKS"] || 0) + qty;
            }
        } else {
            let norm = name.replace(/-/g, " ");
            if (norm === "PT SHIRTS") norm = "PT SHIRT";
            if (norm === "BLAZZER") norm = "BLEZZER";
            expanded[norm] = (expanded[norm] || 0) + qty;
        }
    });

    const shoes = expanded["SHOES"] || 0;
    if (shoes > 0) {
        if (!expanded["SOCKS"] || expanded["SOCKS"] < shoes) {
            expanded["SOCKS"] = shoes;
        }
    }

    return expanded;
}

// Fetch bills from AWS API Gateway
async function getPivotedMatrixData() {
    const selectedMonth = salesMonth ? salesMonth.value : "";
    const selectedBranch = monthlyBranchFilter ? monthlyBranchFilter.value : "All";

    let url = `${API_BASE_URL}/bills?month=${selectedMonth}`;
    if (selectedBranch !== "All") {
        url += `&branch=${encodeURIComponent(selectedBranch)}`;
    }

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to load bills from server.");
        const bills = await response.json();

        return bills.map(bill => {
            const row = {
                "Bill No.": bill.billNo || "",
                "Branch": bill.branch || "",
                "Transaction ID": bill.transactionId || "",
                "Transaction Req Date": formatToExcelDate(bill.billDate),
                "Settlement Date": "",
                "Transaction Amount": Number(bill.total) || 0
            };

            XLSX_COLUMNS.forEach(col => row[col] = "");

            const expanded = expandBillItems(bill);
            XLSX_COLUMNS.forEach(col => {
                if (expanded[col]) {
                    row[col] = expanded[col];
                }
            });

            return row;
        });
    } catch (err) {
        console.error(err);
        return [];
    }
}

async function displayMonthlySales() {
    if (!monthlySalesBody) return;
    monthlySalesBody.innerHTML = `<tr><td colspan="15" style="text-align:center; padding: 20px;">Loading records from cloud...</td></tr>`;
    if (tableTotalsFooter) tableTotalsFooter.innerHTML = "";

    const rows = await getPivotedMatrixData();
    monthlySalesBody.innerHTML = "";

    if (rows.length === 0) {
        monthlySalesBody.innerHTML = `
            <tr>
                <td colspan="15" style="text-align:center; padding: 20px;">
                    No daily bills recorded for the selected month/branch in DynamoDB.
                </td>
            </tr>
        `;
        return;
    }

    const totals = { amount: 0 };
    XLSX_COLUMNS.forEach(col => totals[col] = 0);

    rows.forEach(r => {
        totals.amount += Number(r["Transaction Amount"]) || 0;
        let itemCells = "";

        XLSX_COLUMNS.forEach(col => {
            const val = r[col];
            if (val !== "") totals[col] += Number(val);
            itemCells += `<td>${val !== "" ? val : "-"}</td>`;
        });

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${r["Bill No."] || "-"}</td>
            <td>${r["Branch"] || "-"}</td>
            <td>${r["Transaction ID"] || "-"}</td>
            <td>${r["Transaction Req Date"]}</td>
            <td>${r["Settlement Date"] || "-"}</td>
            <td>₹${Number(r["Transaction Amount"]).toFixed(2)}</td>
            ${itemCells}
        `;
        monthlySalesBody.appendChild(tr);
    });

    if (tableTotalsFooter) {
        let footerCells = `
            <td colspan="3"><strong>Total</strong></td>
            <td></td>
            <td></td>
            <td><strong>₹${totals.amount.toFixed(2)}</strong></td>
        `;
        XLSX_COLUMNS.forEach(col => {
            footerCells += `<td><strong>${totals[col]}</strong></td>`;
        });
        tableTotalsFooter.innerHTML = `<tr>${footerCells}</tr>`;
    }
}

if (exportXlsxBtn) {
    exportXlsxBtn.addEventListener("click", async () => {
        const rows = await getPivotedMatrixData();

        if (rows.length === 0) {
            alert("No records to export for this month.");
            return;
        }

        const emptyRow = {};
        const labelRow = { 
            "Bill No.": "",
            "Branch": "",
            "Transaction ID": "",
            "Transaction Req Date": "", 
            "Settlement Date": "", 
            "Transaction Amount": "" 
        };
        const totalRow = { 
            "Bill No.": "Total",
            "Branch": "",
            "Transaction ID": "",
            "Transaction Req Date": "", 
            "Settlement Date": "", 
            "Transaction Amount": rows.reduce((sum, r) => sum + (Number(r["Transaction Amount"]) || 0), 0)
        };

        XLSX_COLUMNS.forEach(col => {
            labelRow[col] = col;
            totalRow[col] = rows.reduce((sum, r) => sum + (Number(r[col]) || 0), 0);
        });

        const exportData = [...rows, emptyRow, labelRow, totalRow];
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
        XLSX.writeFile(workbook, `${salesMonth.value}-Sales-Matrix.xlsx`);
    });
}

if (salesMonth) salesMonth.addEventListener("change", displayMonthlySales);
if (monthlyBranchFilter) monthlyBranchFilter.addEventListener("change", displayMonthlySales);

// Initial Load
displayMonthlySales();
