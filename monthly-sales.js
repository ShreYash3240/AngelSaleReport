// ==================================================
// MONTHLY SALES MATRIX - JAVASCRIPT
// ==================================================

const API_BASE_URL = "https://myen97dfp7.execute-api.ap-south-1.amazonaws.com";

// Standalone Authentication Check
(function checkAuth() {
    const token = sessionStorage.getItem("cognito_id_token");
    if (!token) return window.location.replace("login.html");

    try {
        const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        const json = decodeURIComponent(atob(base64).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""));
        const payload = JSON.parse(json);

        if (!payload || !payload.exp || payload.exp * 1000 <= Date.now()) {
            sessionStorage.removeItem("cognito_id_token");
            return window.location.replace("login.html");
        }

        const emailDisplay = document.getElementById("userEmailDisplay");
        if (emailDisplay) emailDisplay.textContent = payload.name || payload.email || "Accountant";

        const container = document.getElementById("appContainer");
        if (container) container.style.display = "block";

        const authBtn = document.getElementById("authBtn");
        if (authBtn) {
            authBtn.onclick = () => {
                sessionStorage.removeItem("cognito_id_token");
                window.location.replace("login.html");
            };
        }
    } catch {
        window.location.replace("login.html");
    }
})();

// DOM Elements
const salesMonth = document.getElementById("salesMonth");
const monthlyBranchFilter = document.getElementById("monthlyBranchFilter");
const exportXlsxBtn = document.getElementById("exportXlsxBtn");
const viewMonthBtn = document.getElementById("viewMonthBtn");
const monthlySalesBody = document.getElementById("monthlySalesBody");
const tableTotalsFooter = document.getElementById("tableTotalsFooter");
const monthlyBillCount = document.getElementById("monthlyBillCount");
const monthlyTotal = document.getElementById("monthlyTotal");

// Individual item columns
const XLSX_COLUMNS = [
    "SHIRT", "HALF PANTS", "FULL PANTS", "SKIRT", 
    "SHOES", "SOCKS", "BLAZZER", "BELT", "PT SHIRT", "PT PANT"
];

// Default month setup
const today = new Date();
if (salesMonth && !salesMonth.value) {
    salesMonth.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

// Restore branch
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

// Standard check for junior boys wearing Half Pants vs Full Pants
function isJuniorBoyStandard(std) {
    const juniors = ["NURSERY", "JR. KG.", "SR. KG.", "LKG", "UKG", "I", "II", "III", "IV", "V", "VI", "1ST", "2ND", "3RD", "4TH", "5TH", "6TH"];
    return juniors.includes(String(std || "").trim().toUpperCase());
}

// Expand grouped uniform items into separate individual items
function expandBillItems(bill) {
    const expanded = {};
    XLSX_COLUMNS.forEach(col => expanded[col] = 0);

    const isGirl = String(bill.gender || "").trim().toUpperCase().startsWith("G");
    const isJuniorBoy = isJuniorBoyStandard(bill.standard);

    (bill.items || []).forEach(item => {
        let name = (item.name || "").trim().toUpperCase();
        const qty = Number(item.quantity) || 0;
        if (qty <= 0) return;

        // 1. SET / UNIFORM SET
        if (name === "SET" || name === "UNIFORM SET") {
            expanded["SHIRT"] += qty;
            if (isGirl) {
                expanded["SKIRT"] += qty;
            } else if (isJuniorBoy) {
                expanded["HALF PANTS"] += qty;
            } else {
                expanded["FULL PANTS"] += qty;
            }
            expanded["SHOES"] += qty;
            expanded["SOCKS"] += qty;
        } 
        // 2. SHIRT & PANT
        else if (name === "SHIRT & PANT" || name === "SHIRT, PANT") {
            expanded["SHIRT"] += qty;
            if (isJuniorBoy) {
                expanded["HALF PANTS"] += qty;
            } else {
                expanded["FULL PANTS"] += qty;
            }
        } 
        // 3. SHIRT & SKIRT
        else if (name === "SHIRT & SKIRT" || name === "SHIRT, SKIRT") {
            expanded["SHIRT"] += qty;
            expanded["SKIRT"] += qty;
        } 
        // 4. SHOES & SOCKS
        else if (name === "SHOES & SOCKS" || name === "SHOES, SOCKS") {
            expanded["SHOES"] += qty;
            expanded["SOCKS"] += qty;
        } 
        // 5. ONLY SOCKS
        else if (name === "ONLY SOCKS") {
            expanded["SOCKS"] += qty;
        } 
        // 6. Direct Matches (BLAZZER, BELT, PT SHIRT, PT PANT, etc.)
        else {
            let normalized = name.replace(/-/g, " ");
            if (normalized === "BLEZZER") normalized = "BLAZZER";
            if (normalized === "PT SHIRTS") normalized = "PT SHIRT";
            if (normalized === "PT PANTS") normalized = "PT PANT";

            if (expanded.hasOwnProperty(normalized)) {
                expanded[normalized] += qty;
            }
        }
    });

    return expanded;
}

let cachedMatrixRows = [];

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
        let bills = await response.json();

        bills = bills.filter(b => !b.department || b.department === "Uniform");

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

async function displayMonthlySales() {
    if (!monthlySalesBody) return;

    monthlySalesBody.innerHTML = `<tr><td colspan="16" style="text-align:center; padding: 24px; color: #64748b;">Loading records from cloud...</td></tr>`;
    if (tableTotalsFooter) tableTotalsFooter.innerHTML = "";

    const rows = await getPivotedMatrixData();
    monthlySalesBody.innerHTML = "";

    if (rows.length === 0) {
        monthlySalesBody.innerHTML = `
            <tr>
                <td colspan="16" style="text-align:center; padding: 30px; color: #94a3b8;">
                    No uniform bills recorded for ${salesMonth ? salesMonth.value : "this period"}.
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

    if (monthlyBillCount) monthlyBillCount.textContent = rows.length;
    if (monthlyTotal) monthlyTotal.textContent = `₹${totals.amount.toFixed(2)}`;

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

function handleExcelExport() {
    if (!cachedMatrixRows || cachedMatrixRows.length === 0) {
        alert("No records found to export for this period.");
        return;
    }

    if (typeof XLSX === "undefined") {
        alert("Excel export library is not loaded. Please check your network.");
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
        "Transaction Amount": cachedMatrixRows.reduce((sum, r) => sum + (Number(r["Transaction Amount"]) || 0), 0)
    };

    XLSX_COLUMNS.forEach(col => {
        labelRow[col] = col;
        totalRow[col] = cachedMatrixRows.reduce((sum, r) => sum + (Number(r[col]) || 0), 0);
    });

    const exportData = [...cachedMatrixRows, emptyRow, labelRow, totalRow];
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
