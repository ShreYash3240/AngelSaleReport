// ==================================================
// BOOKS DEPARTMENT - MONTHLY & RANGE REPORT (books-monthly.js)
// ==================================================
const API_BASE_URL = "https://myen97dfp7.execute-api.ap-south-1.amazonaws.com";

const reportFromDate = document.getElementById("reportFromDate");
const reportToDate = document.getElementById("reportToDate");
const reportBranch = document.getElementById("reportBranch");
const loadReportBtn = document.getElementById("loadReportBtn");
const thisMonthBtn = document.getElementById("thisMonthBtn");
const lastMonthBtn = document.getElementById("lastMonthBtn");
const exportExcelBtn = document.getElementById("exportExcelBtn");

const summaryTotal = document.getElementById("summaryTotal");
const summaryCount = document.getElementById("summaryCount");
const summaryCash = document.getElementById("summaryCash");
const summaryOnline = document.getElementById("summaryOnline");
const tableRecordCount = document.getElementById("tableRecordCount");

const reportBody = document.getElementById("reportBody");
const reportEmptyMessage = document.getElementById("reportEmptyMessage");

let bookBillsCache = [];

// ==================================================
// AUTHENTICATION & HEADERS
// ==================================================
// ==================================================
// AUTHENTICATION & HEADERS
// ==================================================
function handleLogout() {
    sessionStorage.clear();
    localStorage.removeItem("cognito_id_token");
    localStorage.removeItem("selectedBranch");
    window.location.replace("/login.html"); // Added leading slash
}

(function enforceAuth() {
    const token = sessionStorage.getItem("cognito_id_token");
    if (!token) return window.location.replace("/login.html"); // Added leading slash

    try {
        const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        const json = decodeURIComponent(atob(base64).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""));
        const payload = JSON.parse(json);

        if (!payload || !payload.exp || payload.exp * 1000 <= Date.now()) {
            sessionStorage.removeItem("cognito_id_token");
            return window.location.replace("/login.html"); // Added leading slash
        }

        const emailDisplay = document.getElementById("userEmailDisplay");
        if (emailDisplay) emailDisplay.textContent = payload.name || payload.email || "Accountant";

        const appContainer = document.getElementById("appContainer");
        if (appContainer) appContainer.style.display = "block";

        const authBtn = document.getElementById("authBtn");
        if (authBtn) {
            authBtn.onclick = (e) => {
                e.preventDefault();
                handleLogout();
            };
        }
    } catch {
        window.location.replace("/login.html"); // Added leading slash
    }
})();

function getAuthHeaders() {
    const token = sessionStorage.getItem("cognito_id_token");
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };
}

// ==================================================
// DATE UTILITIES
// ==================================================
function formatDate(ds) {
    if (!ds) return "";
    const p = ds.split("-");
    return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : ds;
}

function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
}

function setMonthRange(year, monthIndex) {
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0);

    reportFromDate.value = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;
    reportToDate.value = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
}

// Generates an array of all "YYYY-MM" months between two dates
function getMonthsInRange(fromStr, toStr) {
    const months = [];
    const [fromY, fromM] = fromStr.split("-").map(Number);
    const [toY, toM] = toStr.split("-").map(Number);

    let curY = fromY;
    let curM = fromM;

    while (curY < toY || (curY === toY && curM <= toM)) {
        months.push(`${curY}-${String(curM).padStart(2, "0")}`);
        curM++;
        if (curM > 12) {
            curM = 1;
            curY++;
        }
    }
    return months;
}

// ==================================================
// DATA FETCHING & REPORT RENDER
// ==================================================
async function loadReport() {
    const from = reportFromDate.value;
    const to = reportToDate.value;
    const branch = reportBranch.value;

    if (!from || !to) return alert("Please select both From and To dates.");
    if (from > to) return alert("From Date cannot be later than To Date.");

    reportBody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 24px;">Generating report...</td></tr>`;
    if (reportEmptyMessage) reportEmptyMessage.style.display = "none";

    const monthsToFetch = getMonthsInRange(from, to);

    try {
        let allBills = [];

        // Fetch each required monthly partition
        for (const month of monthsToFetch) {
            let url = `${API_BASE_URL}/bills?department=Books&month=${month}`;
            if (branch !== "All") url += `&branch=${encodeURIComponent(branch)}`;
            
            const res = await fetch(url, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                allBills = allBills.concat(data);
            }
        }

        // Filter exact inclusive date range and prevent duplicate keys
        const seen = new Set();
        bookBillsCache = allBills.filter(b => {
            if (b.billDate < from || b.billDate > to) return false;
            const key = `${b.branch || ""}_${b.billDate}_${b.billNo}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // Sort by date descending, then bill number descending
        bookBillsCache.sort((a, b) => 
            (b.billDate || "").localeCompare(a.billDate || "") || 
            String(b.billNo).localeCompare(String(a.billNo))
        );

        renderReportTable(bookBillsCache);
    } catch (err) {
        console.error("Report fetch error:", err);
        reportBody.innerHTML = `<tr><td colspan="10" style="color:red; text-align:center; padding: 20px;">Failed to load report: ${err.message}</td></tr>`;
    }
}

function renderReportTable(bills) {
    reportBody.innerHTML = "";

    let totalRevenue = 0;
    let cashRevenue = 0;
    let onlineRevenue = 0;

    if (bills.length === 0) {
        if (reportEmptyMessage) reportEmptyMessage.style.display = "block";
        summaryTotal.textContent = "₹0.00";
        summaryCount.textContent = "0";
        summaryCash.textContent = "₹0.00";
        summaryOnline.textContent = "₹0.00";
        tableRecordCount.textContent = "0";
        return;
    }

    if (reportEmptyMessage) reportEmptyMessage.style.display = "none";

    bills.forEach(bill => {
        const amt = Number(bill.total) || 0;
        totalRevenue += amt;
        if (bill.paymentMode === "Online") onlineRevenue += amt;
        else cashRevenue += amt;

        let totalQty = 0;
        const itemBreakdown = (bill.items || []).map(i => {
            const q = Number(i.quantity) || 0;
            totalQty += q;
            return `<div>${escapeHTML(i.name)} × ${q} (₹${(Number(i.amount) || 0).toFixed(2)})</div>`;
        }).join("");

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${formatDate(bill.billDate)}</td>
            <td>${escapeHTML(bill.branch || "-")}</td>
            <td><strong>${escapeHTML(bill.billNo)}</strong></td>
            <td><strong>${escapeHTML(bill.studentName || "-")}</strong></td>
            <td>${escapeHTML(bill.standard)}</td>
            <td>${escapeHTML(bill.paymentMode || "")}</td>
            <td>${escapeHTML(bill.transactionId || "-")}</td>
            <td class="item-list">${itemBreakdown}</td>
            <td>${totalQty}</td>
            <td><strong>₹${amt.toFixed(2)}</strong></td>
        `;
        reportBody.appendChild(tr);
    });

    summaryTotal.textContent = `₹${totalRevenue.toFixed(2)}`;
    summaryCount.textContent = bills.length;
    summaryCash.textContent = `₹${cashRevenue.toFixed(2)}`;
    summaryOnline.textContent = `₹${onlineRevenue.toFixed(2)}`;
    tableRecordCount.textContent = bills.length;
}

// ==================================================
// EXCEL EXPORT (.XLSX) WITH GRANULAR MATRIX & TOTALS
// ==================================================
function exportBooksXlsx() {
    if (!bookBillsCache || bookBillsCache.length === 0) {
        alert("No book bills to export for this range.");
        return;
    }

    if (typeof XLSX === "undefined") {
        alert("Excel export library failed to load. Check your network connection.");
        return;
    }

    // 1. Discover all unique individual book titles sold in this period
    const individualBookNames = new Set();
    bookBillsCache.forEach(bill => {
        (bill.items || []).forEach(i => {
            const name = (i.name || "").trim();
            if (name && name !== "TEXTBOOKS SET" && name !== "NOTEBOOK SET" && name !== "TOTAL AMOUNT") {
                individualBookNames.add(name);
            }
        });
    });

    const individualBookList = Array.from(individualBookNames).sort();

    // 2. Build rows for each bill with Student Name
    let sumTotalAmount = 0;
    let sumTextQty = 0;
    let sumNoteQty = 0;
    let sumCompQty = 0;
    const sumIndividualBooks = {};
    individualBookList.forEach(b => sumIndividualBooks[b] = 0);

    const rows = bookBillsCache.map(bill => {
        let textQty = 0;
        let noteQty = 0;
        let compQty = 0;
        const extraItemQuantities = {};

        (bill.items || []).forEach(i => {
            const name = (i.name || "").trim();
            const qty = Number(i.quantity) || 0;

            if (name === "TEXTBOOKS SET") {
                textQty += qty;
            } else if (name === "NOTEBOOK SET") {
                noteQty += qty;
            } else if (name === "TOTAL AMOUNT") {
                compQty += qty;
            } else {
                extraItemQuantities[name] = (extraItemQuantities[name] || 0) + qty;
                sumIndividualBooks[name] = (sumIndividualBooks[name] || 0) + qty;
            }
        });

        const billAmount = Number(bill.total) || 0;
        sumTotalAmount += billAmount;
        sumTextQty += textQty;
        sumNoteQty += noteQty;
        sumCompQty += compQty;

        const row = {
            "Bill Date": formatDate(bill.billDate),
            "Branch": bill.branch || "",
            "Bill No.": bill.billNo,
            "Student Name": bill.studentName || "",
            "Standard": bill.standard || "",
            "Payment Mode": bill.paymentMode || "",
            "Transaction ID": bill.transactionId || "",
            "Total Amount": billAmount,
            "TEXTBOOKS SET": textQty || "",
            "NOTEBOOK SET": noteQty || "",
            "COMPLETE SET": compQty || ""
        };

        // Add dynamically discovered individual book titles
        individualBookList.forEach(bookTitle => {
            row[bookTitle] = extraItemQuantities[bookTitle] || "";
        });

        return row;
    });

    // 3. Append Blank Separation Row and Summary Row
    const emptyRow = {};
    const totalRow = {
        "Bill Date": "TOTALS",
        "Branch": "",
        "Bill No.": "",
        "Student Name": "",
        "Standard": "",
        "Payment Mode": "",
        "Transaction ID": "",
        "Total Amount": sumTotalAmount,
        "TEXTBOOKS SET": sumTextQty || "",
        "NOTEBOOK SET": sumNoteQty || "",
        "COMPLETE SET": sumCompQty || ""
    };

    individualBookList.forEach(bookTitle => {
        totalRow[bookTitle] = sumIndividualBooks[bookTitle] || "";
    });

    const exportData = [...rows, emptyRow, totalRow];
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Books Sales Matrix");

    const fileName = `Books_Sales_${reportFromDate.value}_to_${reportToDate.value}.xlsx`;
    XLSX.writeFile(workbook, fileName);
}

// ==================================================
// EVENT LISTENERS & INIT
// ==================================================
loadReportBtn?.addEventListener("click", loadReport);
exportExcelBtn?.addEventListener("click", exportBooksXlsx);

thisMonthBtn?.addEventListener("click", () => {
    const d = new Date();
    setMonthRange(d.getFullYear(), d.getMonth());
    loadReport();
});

lastMonthBtn?.addEventListener("click", () => {
    const d = new Date();
    setMonthRange(d.getFullYear(), d.getMonth() - 1);
    loadReport();
});

reportBranch?.addEventListener("change", loadReport);

// Init with current month range
const d = new Date();
setMonthRange(d.getFullYear(), d.getMonth());

const savedBranch = localStorage.getItem("selectedBranch");
if (savedBranch && reportBranch) {
    reportBranch.value = savedBranch;
}

loadReport();
