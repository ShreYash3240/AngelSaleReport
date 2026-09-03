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
const emptyMessage = document.getElementById("emptyMessage");

let bookBillsCache = [];

// ==================================================
// AUTH CHECK
// ==================================================
const COGNITO_AUTH_DOMAIN = "https://school-sales-app-auth.auth.ap-south-1.amazoncognito.com";
const COGNITO_CLIENT_ID = "2p6l3k2tpv751025t3qmmee1to";
const REDIRECT_URI = "https://main.d2gnewcvmz76ap.amplifyapp.com/index.html";

function handleLogout() {
    sessionStorage.clear();
    localStorage.removeItem("cognito_id_token");
    const logoutUrl = `${COGNITO_AUTH_DOMAIN}/logout?client_id=${COGNITO_CLIENT_ID}&logout_uri=${encodeURIComponent(REDIRECT_URI)}`;
    window.location.replace(logoutUrl);
}

function getAuthHeaders() {
    const token = sessionStorage.getItem("cognito_id_token");
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };
}

const token = sessionStorage.getItem("cognito_id_token");
if (!token) {
    window.location.replace("login.html");
} else {
    try {
        const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        const json = decodeURIComponent(atob(base64).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""));
        const payload = JSON.parse(json);
        
        if (!payload || !payload.exp || payload.exp * 1000 <= Date.now()) {
            sessionStorage.removeItem("cognito_id_token");
            window.location.replace("login.html");
        } else {
            const emailDisplay = document.getElementById("userEmailDisplay");
            if (emailDisplay) emailDisplay.textContent = payload.name || payload.email || "Accountant";
            document.getElementById("appContainer").style.display = "block";
            
            const authBtn = document.getElementById("authBtn");
            if (authBtn) authBtn.onclick = (e) => { e.preventDefault(); handleLogout(); };
        }
    } catch {
        window.location.replace("login.html");
    }
}

// Current month default
const now = new Date();
salesMonth.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

// Utilities
function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
}

function formatDate(ds) {
    if (!ds) return "";
    const p = ds.split("-");
    return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : ds;
}

// ==================================================
// LOAD MONTHLY DATA
// ==================================================
async function loadMonthlyReport() {
    const month = salesMonth.value;
    const branch = monthlyBranchFilter.value;
    if (!month) return;

    let url = `${API_BASE_URL}/bills?department=Books&month=${month}`;
    if (branch !== "All") url += `&branch=${encodeURIComponent(branch)}`;

    monthlySalesBody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding: 24px;">Loading records...</td></tr>`;
    if (emptyMessage) emptyMessage.style.display = "none";

    try {
        const res = await fetch(url, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error("Could not retrieve bills from API.");
        bookBillsCache = await res.json();

        monthlySalesBody.innerHTML = "";
        tableTotalsFooter.innerHTML = "";

        if (bookBillsCache.length === 0) {
            if (emptyMessage) emptyMessage.style.display = "block";
            monthlyBillCount.textContent = "0";
            monthlyTotal.textContent = "₹0.00";
            return;
        }

        if (emptyMessage) emptyMessage.style.display = "none";

        let totalRev = 0;
        let sumTextbooks = 0;
        let sumNotebooks = 0;
        let sumComplete = 0;

        bookBillsCache.forEach(bill => {
            totalRev += Number(bill.total) || 0;

            let textQty = 0;
            let noteQty = 0;
            let compQty = 0;
            const extraItems = [];

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
                    extraItems.push(`${name} (×${qty})`);
                }
            });

            sumTextbooks += textQty;
            sumNotebooks += noteQty;
            sumComplete += compQty;

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${escapeHTML(bill.billNo)}</td>
                <td>${escapeHTML(bill.branch || "-")}</td>
                <td>${escapeHTML(bill.standard || "-")}</td>
                <td>${escapeHTML(bill.paymentMode || "-")}</td>
                <td>${escapeHTML(bill.transactionId || "-")}</td>
                <td>${formatDate(bill.billDate)}</td>
                <td>₹${(Number(bill.total) || 0).toFixed(2)}</td>
                <td>${textQty || "-"}</td>
                <td>${noteQty || "-"}</td>
                <td>${compQty || "-"}</td>
                <td style="font-size: 0.85rem; color: var(--text-muted, #94a3b8);">${extraItems.length > 0 ? extraItems.map(escapeHTML).join(", ") : "-"}</td>
            `;
            monthlySalesBody.appendChild(tr);
        });

        monthlyBillCount.textContent = bookBillsCache.length;
        monthlyTotal.textContent = `₹${totalRev.toFixed(2)}`;

        tableTotalsFooter.innerHTML = `
            <tr>
                <th colspan="6" style="text-align: right;">Total:</th>
                <th>₹${totalRev.toFixed(2)}</th>
                <th>${sumTextbooks}</th>
                <th>${sumNotebooks}</th>
                <th>${sumComplete}</th>
                <th></th>
            </tr>
        `;
    } catch (err) {
        console.error("Monthly report fetch error:", err);
        monthlySalesBody.innerHTML = `<tr><td colspan="11" style="color:red; text-align:center; padding: 20px;">Error loading bills: ${err.message}</td></tr>`;
    }
}

// ==================================================
// EXCEL EXPORT (.XLSX) WITH GRANULAR BOOK COLUMNS
// ==================================================
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

    // 2. Build normalized rows for each bill
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
            }
        });

        const row = {
            "Bill No.": bill.billNo,
            "Branch": bill.branch || "",
            "Standard": bill.standard || "",
            "Payment Mode": bill.paymentMode || "",
            "Transaction ID": bill.transactionId || "",
            "Req Date": bill.billDate,
            "Total Amount": Number(bill.total) || 0,
            "TEXTBOOKS SET": textQty || "",
            "NOTEBOOK SET": noteQty || "",
            "COMPLETE SET": compQty || ""
        };

        // Add dynamically discovered individual book quantities as explicit columns
        individualBookList.forEach(bookTitle => {
            row[bookTitle] = extraItemQuantities[bookTitle] || "";
        });

        return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Books Sales Matrix");
    XLSX.writeFile(workbook, `${month}-Books-Sales-Matrix.xlsx`);
}

filterReportBtn.addEventListener("click", loadMonthlyReport);
salesMonth.addEventListener("change", loadMonthlyReport);
monthlyBranchFilter.addEventListener("change", loadMonthlyReport);
exportXlsxBtn.addEventListener("click", exportBooksXlsx);

// Initial load
loadMonthlyReport();
