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

    try {
        const res = await fetch(url);
        const bills = await res.json();

        monthlySalesBody.innerHTML = "";
        tableTotalsFooter.innerHTML = "";

        if (bills.length === 0) {
            monthlySalesBody.innerHTML = `<tr><td colspan="8" class="empty-message">No book records found for this month.</td></tr>`;
            monthlyBillCount.textContent = "0";
            monthlyTotal.textContent = "₹0.00";
            return;
        }

        let totalRev = 0;
        let sumTextbooks = 0;
        let sumNotebooks = 0;
        let sumComplete = 0;

        bills.forEach(bill => {
            totalRev += Number(bill.total) || 0;

            let textQty = 0;
            let noteQty = 0;
            let compQty = 0;

            (bill.items || []).forEach(i => {
                if (i.name === "TEXTBOOKS SET") textQty += i.quantity || 0;
                else if (i.name === "NOTEBOOK SET") noteQty += i.quantity || 0;
                else if (i.name === "TOTAL AMOUNT") compQty += i.quantity || 0;
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

        monthlyBillCount.textContent = bills.length;
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
    }
}

filterReportBtn.addEventListener("click", loadMonthlyReport);
salesMonth.addEventListener("change", loadMonthlyReport);
monthlyBranchFilter.addEventListener("change", loadMonthlyReport);

// Initial trigger
loadMonthlyReport();
