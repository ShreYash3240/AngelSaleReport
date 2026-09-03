// ==================================================
// BOOKS DEPARTMENT - MONTHLY REPORT (books-monthly.js)
// ==================================================
const API_BASE_URL = "https://myen97dfp7.execute-api.ap-south-1.amazonaws.com";

const salesMonth = document.getElementById("salesMonth");
const monthlyBranchFilter = document.getElementById("monthlyBranchFilter");
const filterReportBtn = document.getElementById("filterReportBtn");
const exportXlsxBtn = document.getElementById("exportXlsxBtn");

const monthlyBillCount = document.getElementById("monthlyBillCount");
const monthlyTotal = document.getElementById("monthlyTotal");
const monthlySalesBody = document.getElementById("monthlySalesBody");
const tableTotalsFooter = document.getElementById("tableTotalsFooter");

let bookBillsCache = [];

// Auth check
const token = sessionStorage.getItem("cognito_id_token");
if (!token) {
    window.location.replace("login.html");
} else {
    document.getElementById("appContainer").style.display = "block";
    document.getElementById("authBtn").onclick = () => {
        sessionStorage.removeItem("cognito_id_token");
        window.location.replace("login.html");
    };
}

// Current month default
const now = new Date();
salesMonth.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

async function loadMonthlyReport() {
    const month = salesMonth.value;
    const branch = monthlyBranchFilter.value;
    if (!month) return;

    let url = `${API_BASE_URL}/bills?department=Books&month=${month}`;
    if (branch !== "All") url += `&branch=${encodeURIComponent(branch)}`;

    monthlySalesBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 20px;">Loading records...</td></tr>`;

    try {
        const res = await fetch(url);
        bookBillsCache = await res.json();

        monthlySalesBody.innerHTML = "";
        tableTotalsFooter.innerHTML = "";

        if (bookBillsCache.length === 0) {
            monthlySalesBody.innerHTML = `<tr><td colspan="8" class="empty-message">No book records found for this month.</td></tr>`;
            monthlyBillCount.textContent = "0";
            monthlyTotal.textContent = "₹0.00";
            return;
        }

        let totalRev = 0;
        let sumTextbooks = 0;
        let sumNotebooks = 0;
        let sumComplete = 0;

        bookBillsCache.forEach(bill => {
            totalRev += Number(bill.total) || 0;

            let textQty = 0;
            let noteQty = 0;
            let compQty = 0;

            (bill.items || []).forEach(i => {
                if (i.name === "TEXTBOOKS SET") textQty += Number(i.quantity) || 0;
                else if (i.name === "NOTEBOOK SET") noteQty += Number(i.quantity) || 0;
                else if (i.name === "TOTAL AMOUNT") compQty += Number(i.quantity) || 0;
            });

            sumTextbooks += textQty;
            sumNotebooks += noteQty;
            sumComplete += compQty;

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${bill.billNo}</td>
                <td>${bill.branch || "-"}</td>
                <td>${bill.transactionId || "-"}</td>
                <td>${bill.billDate}</td>
                <td>₹${(Number(bill.total) || 0).toFixed(2)}</td>
                <td>${textQty || "-"}</td>
                <td>${noteQty || "-"}</td>
                <td>${compQty || "-"}</td>
            `;
            monthlySalesBody.appendChild(tr);
        });

        monthlyBillCount.textContent = bookBillsCache.length;
        monthlyTotal.textContent = `₹${totalRev.toFixed(2)}`;

        tableTotalsFooter.innerHTML = `
            <tr>
                <th colspan="4" style="text-align: right;">Total:</th>
                <th>₹${totalRev.toFixed(2)}</th>
                <th>${sumTextbooks}</th>
                <th>${sumNotebooks}</th>
                <th>${sumComplete}</th>
            </tr>
        `;
    } catch (err) {
        console.error("Monthly report fetch error:", err);
        monthlySalesBody.innerHTML = `<tr><td colspan="8" style="color:red; text-align:center; padding: 20px;">Error loading bills: ${err.message}</td></tr>`;
    }
}

function exportBooksXlsx() {
    if (!bookBillsCache || bookBillsCache.length === 0) {
        alert("No book bills to export for this month.");
        return;
    }

    if (typeof XLSX === "undefined") {
        alert("Excel export library failed to load. Check your internet connection.");
        return;
    }

    const month = salesMonth.value || "Monthly";

    const rows = bookBillsCache.map(bill => {
        let textQty = 0, noteQty = 0, compQty = 0;
        (bill.items || []).forEach(i => {
            if (i.name === "TEXTBOOKS SET") textQty += Number(i.quantity) || 0;
            else if (i.name === "NOTEBOOK SET") noteQty += Number(i.quantity) || 0;
            else if (i.name === "TOTAL AMOUNT") compQty += Number(i.quantity) || 0;
        });

        return {
            "Bill No.": bill.billNo,
            "Branch": bill.branch || "",
            "Transaction ID": bill.transactionId || "",
            "Req Date": bill.billDate,
            "Amount": Number(bill.total) || 0,
            "TEXTBOOKS SET": textQty || "",
            "NOTEBOOK SET": noteQty || "",
            "COMPLETE SET": compQty || ""
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Books Sales");
    XLSX.writeFile(workbook, `${month}-Books-Sales-Matrix.xlsx`);
}

filterReportBtn.addEventListener("click", loadMonthlyReport);
salesMonth.addEventListener("change", loadMonthlyReport);
monthlyBranchFilter.addEventListener("change", loadMonthlyReport);
exportXlsxBtn.addEventListener("click", exportBooksXlsx);

// Initial load
loadMonthlyReport();
