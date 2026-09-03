// ==================================================
// MONTHLY SALES MATRIX - JAVASCRIPT (AWS CLOUD INTEGRATED)
// ==================================================

const API_BASE_URL = "https://myen97dfp7.execute-api.ap-south-1.amazonaws.com";

const salesMonth = document.getElementById("salesMonth");
const monthlyBranchFilter = document.getElementById("monthlyBranchFilter");
const exportXlsxBtn = document.getElementById("exportXlsxBtn");
const viewMonthBtn = document.getElementById("viewMonthBtn");
const monthlySalesBody = document.getElementById("monthlySalesBody");
const tableTotalsFooter = document.getElementById("tableTotalsFooter");
const monthlyBillCount = document.getElementById("monthlyBillCount");
const monthlyTotal = document.getElementById("monthlyTotal");

// Matrix columns strictly matching billing items
const XLSX_COLUMNS = [
    "SHIRT & PANT", "SHIRT & SKIRT", "BLAZZER", 
    "SHOES & SOCKS", "ONLY SOCKS", "BELT", "PT SHIRT", "PT PANT"
];

// Set default month to current YYYY-MM
const today = new Date();
if (salesMonth && !salesMonth.value) {
    salesMonth.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

// Restore saved branch
if (monthlyBranchFilter) {
    const savedBranch = localStorage.getItem("selectedBranch");
    if (savedBranch) monthlyBranchFilter.value = savedBranch;
}

function formatToExcelDate(dateStr) {
    if (!dateStr) return "";
    const parts = dateStr.trim().split("-");
    if (parts.length !== 3) return dateStr;
    const year = parts[0];
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = parts[2].padStart(2, "0");
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    return `${day}-${months[monthIndex] || parts[1]}-${year}`;
}

// Map bill line items into the flat matrix row
function expandBillItems(bill) {
    const expanded = {};
    XLSX_COLUMNS.forEach(col => expanded[col] = 0);

    (bill.items || []).forEach(item => {
        let name = (item.name || "").trim().toUpperCase();
        const qty = Number(item.quantity) || 0;
        if (qty <= 0) return;

        // Legacy / set mapping
        if (name === "SET" || name === "UNIFORM SET") {
            const isGirl = (bill.gender || "").toUpperCase() === "GIRLS" || (bill.gender || "").toUpperCase() === "GIRL";
            if (isGirl) {
                expanded["SHIRT & SKIRT"] += qty;
            } else {
                expanded["SHIRT & PANT"] += qty;
            }
            expanded["SHOES & SOCKS"] += qty;
        } else if (expanded.hasOwnProperty(name)) {
            expanded[name] += qty;
        }
    });

    return expanded;
}

// In-memory cache to prevent double-fetching on Excel download
let cachedMatrixRows = [];

// Fetch uniform bills from AWS API Gateway
async function getPivotedMatrixData() {
    const selectedMonth = salesMonth ? salesMonth.value : "";
    const selectedBranch = monthlyBranchFilter ? monthlyBranchFilter.value : "All";

    let url = `${API_BASE_URL}/bills?department=Uniform&month=${selectedMonth}`;
    if (selectedBranch !== "All") {
        url += `&branch=${encodeURIComponent(selectedBranch)}`;
    }

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to load bills from server.");
        const bills = await response.json();

        cachedMatrixRows = bills.map(bill => {
            const row = {
                "Bill No.": bill.billNo || "",
                "Branch": bill.branch || "",
                "Transaction ID": bill.transactionId || "",
                "Transaction Req Date": formatToExcelDate(bill.billDate),
                "Settlement Date": formatToExcelDate(bill.billDate),
                "Transaction Amount": Number(bill.total) || 0
            };

            const expanded = expandBillItems(bill);
            XLSX_COLUMNS.forEach(col => {
                row[col] = expanded[col] > 0 ? expanded[col] : "";
            });

            return row;
        });

        return cachedMatrixRows;
    } catch (err) {
        console.error("Fetch matrix error:", err);
        return [];
    }
}

// Render Table and Summary Cards
async function displayMonthlySales() {
    if (!monthlySalesBody) return;

    monthlySalesBody.innerHTML = `<tr><td colspan="14" style="text-align:center; padding: 20px;">Loading records from cloud...</td></tr>`;
    if (tableTotalsFooter) tableTotalsFooter.innerHTML = "";

    const rows = await getPivotedMatrixData();
    monthlySalesBody.innerHTML = "";

    if (rows.length === 0) {
        monthlySalesBody.innerHTML = `
            <tr>
                <td colspan="14" class="empty-message">
                    No uniform bills recorded for ${salesMonth.value || "this month"}.
                </td>
            </tr>
        `;
        if (monthlyBillCount) monthlyBillCount.textContent = "0";
        if (monthlyTotal) monthlyTotal.textContent = "₹0.00";
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

    // Update KPI Card summary
    if (monthlyBillCount) monthlyBillCount.textContent = rows.length;
    if (monthlyTotal) monthlyTotal.textContent = `₹${totals.amount.toFixed(2)}`;

    // Build Table Footer
    if (tableTotalsFooter) {
        let footerCells = `
            <td colspan="5" style="text-align: right;"><strong>Total:</strong></td>
            <td><strong>₹${totals.amount.toFixed(2)}</strong></td>
        `;
        XLSX_COLUMNS.forEach(col => {
            footerCells += `<td><strong>${totals[col]}</strong></td>`;
        });
        tableTotalsFooter.innerHTML = `<tr>${footerCells}</tr>`;
    }
}

// Download Excel (.xlsx) handler
async function handleExcelExport() {
    const rows = cachedMatrixRows.length > 0 ? cachedMatrixRows : await getPivotedMatrixData();

    if (rows.length === 0) {
        alert("No records found to export for the selected period.");
        return;
    }

    if (typeof XLSX === "undefined") {
        alert("Excel export library is not loaded. Please ensure internet access to the SheetJS CDN.");
        return;
    }

    const emptyRow = {};
    const labelRow = { 
        "Bill No.": "", "Branch": "", "Transaction ID": "", 
        "Transaction Req Date": "", "Settlement Date": "", "Transaction Amount": "" 
    };
    const totalRow = { 
        "Bill No.": "Total", "Branch": "", "Transaction ID": "", 
        "Transaction Req Date": "", "Settlement Date": "", 
        "Transaction Amount": rows.reduce((sum, r) => sum + (Number(r["Transaction Amount"]) || 0), 0)
    };

    XLSX_COLUMNS.forEach(col => {
        labelRow[col] = col;
        totalRow[col] = rows.reduce((sum, r) => sum + (Number(r[col]) || 0), 0);
    });

    const exportData = [...rows, emptyRow, labelRow, totalRow];
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Monthly Uniform Sales");
    XLSX.writeFile(workbook, `${salesMonth.value || "Monthly"}-Uniform-Sales-Matrix.xlsx`);
}

// Event Listeners
if (monthlyBranchFilter) {
    monthlyBranchFilter.addEventListener("change", () => {
        if (monthlyBranchFilter.value !== "All") {
            localStorage.setItem("selectedBranch", monthlyBranchFilter.value);
        }
        displayMonthlySales();
    });
}

if (salesMonth) salesMonth.addEventListener("change", displayMonthlySales);
if (viewMonthBtn) viewMonthBtn.addEventListener("click", displayMonthlySales);
if (exportXlsxBtn) exportXlsxBtn.addEventListener("click", handleExcelExport);

// Initial Load
displayMonthlySales();
