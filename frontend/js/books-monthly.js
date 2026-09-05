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
let currentBookChart = null;

// Friendly Custom Popup Function
function showPopup(message, type = "info") {
    const modal = document.getElementById("customAlertModal");
    const msgEl = document.getElementById("customAlertMessage");
    const titleEl = document.getElementById("customAlertTitle");
    const iconEl = document.getElementById("customAlertIcon");
    const okBtn = document.getElementById("customAlertOkBtn");

    if (!modal) {
        // Fallback if modal isn't present on page yet
        alert(message);
        return;
    }

    msgEl.textContent = message;

    // Customize styling based on message type
    if (type === "success") {
        titleEl.textContent = "Success!";
        iconEl.textContent = "✅";
        okBtn.style.background = "#16a34a"; // Friendly Green
    } else if (type === "error") {
        titleEl.textContent = "Action Needed";
        iconEl.textContent = "⚠️";
        okBtn.style.background = "#dc2626"; // Clear Red
    } else {
        titleEl.textContent = "Information";
        iconEl.textContent = "ℹ️";
        okBtn.style.background = "#0284c7"; // Friendly Blue
    }

    modal.style.display = "flex";

    // Close action
    okBtn.onclick = () => {
        modal.style.display = "none";
    };
}

// ==================================================
// AUTHENTICATION & HEADERS
// ==================================================
function handleLogout() {
    sessionStorage.clear();
    localStorage.removeItem("cognito_id_token");
    localStorage.removeItem("selectedBranch");
    window.location.replace("/login.html");
}

function getStoredToken() {
    return sessionStorage.getItem("cognito_id_token") || localStorage.getItem("cognito_id_token");
}

(function enforceAuth() {
    const token = getStoredToken();
    if (!token) return window.location.replace("/login.html");

    try {
        const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        const json = decodeURIComponent(atob(base64).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""));
        const payload = JSON.parse(json);

        if (!payload || !payload.exp || payload.exp * 1000 <= Date.now()) {
            handleLogout();
            return;
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
        handleLogout();
    }
})();

function getAuthHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getStoredToken()}`
    };
}

// ==================================================
// DATE UTILITIES & SANITIZATION
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
// S3 VAULT PRE-SIGNED URL VIEWER
// ==================================================
async function viewReceiptImage(s3Key) {
    if (!s3Key) return alert("No original receipt image on file for this bill.");

    const modal = document.getElementById("receiptModal");
    const modalImg = document.getElementById("modalReceiptImg");

    try {
        const res = await fetch(`${API_BASE_URL}/receipt-url?action=view&s3Key=${encodeURIComponent(s3Key)}`, {
            headers: getAuthHeaders()
        });
        const data = await res.json();
        if (!res.ok || !data.viewUrl) throw new Error(data.message || "Could not retrieve image");

        // Display directly in on-screen popup modal
        if (modal && modalImg) {
            modalImg.src = data.viewUrl;
            modal.style.display = "flex";
        } else {
            // Fallback
            window.open(data.viewUrl, "_blank");
        }
    } catch (err) {
        alert("Failed to load receipt: " + err.message);
    }
}
window.viewReceiptImage = viewReceiptImage;

// Modal Close Listeners
document.getElementById("closeReceiptModalBtn")?.addEventListener("click", () => {
    const modal = document.getElementById("receiptModal");
    if (modal) modal.style.display = "none";
});
document.getElementById("closeReceiptModalFooterBtn")?.addEventListener("click", () => {
    const modal = document.getElementById("receiptModal");
    if (modal) modal.style.display = "none";
});
document.getElementById("receiptModal")?.addEventListener("click", (e) => {
    if (e.target.id === "receiptModal") e.target.style.display = "none";
});

// ==================================================
// DATA FETCHING & REPORT RENDER (CONCURRENT)
// ==================================================
async function loadReport() {
    const from = reportFromDate.value;
    const to = reportToDate.value;
    const branch = reportBranch.value;

    if (!from || !to) return alert("Please select both From and To dates.");
    if (from > to) return alert("From Date cannot be later than To Date.");

    reportBody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding: 24px;">Generating book report...</td></tr>`;
    if (reportEmptyMessage) reportEmptyMessage.style.display = "none";

    const monthsToFetch = getMonthsInRange(from, to);

    try {
        // Parallel requests using Promise.all
        const fetchPromises = monthsToFetch.map(month => {
            let url = `${API_BASE_URL}/bills?department=Books&month=${month}`;
            if (branch !== "All") url += `&branch=${encodeURIComponent(branch)}`;
            return fetch(url, { headers: getAuthHeaders() }).then(res => res.ok ? res.json() : []);
        });

        const results = await Promise.all(fetchPromises);
        const allBills = results.flat();

        const seen = new Set();
        bookBillsCache = allBills.filter(b => {
            if (b.department && b.department !== "Books") return false;
            if (b.billDate < from || b.billDate > to) return false;
            
            const key = b._id || b.id || `${b.branch || ""}_${b.billDate}_${b.billNo}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        bookBillsCache.sort((a, b) => 
            (b.billDate || "").localeCompare(a.billDate || "") || 
            String(b.billNo).localeCompare(String(a.billNo))
        );

        renderReportTable(bookBillsCache);
    } catch (err) {
        console.error("Report fetch error:", err);
        reportBody.innerHTML = `<tr><td colspan="11" style="color:red; text-align:center; padding: 20px;">Failed to load report: ${escapeHTML(err.message)}</td></tr>`;
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
        renderBooksChart();
        return;
    }

    if (reportEmptyMessage) reportEmptyMessage.style.display = "none";

    const fragment = document.createDocumentFragment();

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

        // S3 Receipt Vault view action
        const receiptAction = bill.receiptS3Key 
            ? `<button type="button" class="clear-btn" style="padding: 2px 8px; font-size: 0.85rem;" onclick="viewReceiptImage('${escapeHTML(bill.receiptS3Key)}')" title="View Original Paper Receipt">📷 View</button>` 
            : `<span style="color: #94a3b8;">-</span>`;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${formatDate(bill.billDate)}</td>
            <td>${escapeHTML(bill.branch || "-")}</td>
            <td><strong>${escapeHTML(bill.billNo)}</strong></td>
            <td><strong>${escapeHTML(bill.studentName || "-")}</strong></td>
            <td>${escapeHTML(bill.standard || "-")}</td>
            <td>${escapeHTML(bill.paymentMode || "")}</td>
            <td>${escapeHTML(bill.transactionId || "-")}</td>
            <td class="item-list">${itemBreakdown}</td>
            <td>${totalQty}</td>
            <td><strong>₹${amt.toFixed(2)}</strong></td>
            <td style="text-align: center;">${receiptAction}</td>
        `;
        fragment.appendChild(tr);
    });

    reportBody.appendChild(fragment);

    summaryTotal.textContent = `₹${totalRevenue.toFixed(2)}`;
    summaryCount.textContent = bills.length;
    summaryCash.textContent = `₹${cashRevenue.toFixed(2)}`;
    summaryOnline.textContent = `₹${onlineRevenue.toFixed(2)}`;
    tableRecordCount.textContent = bills.length;

    renderBooksChart();
}

// ==================================================
// CHART.JS CLIENT-SIDE ANALYTICS (BOOKS)
// ==================================================
function renderBooksChart() {
    const canvas = document.getElementById("salesChartCanvas");
    const chartTypeSelect = document.getElementById("chartTypeSelect");
    if (!canvas || !window.Chart) return;

    if (currentBookChart) {
        currentBookChart.destroy();
        currentBookChart = null;
    }

    if (!bookBillsCache || bookBillsCache.length === 0) return;

    const ctx = canvas.getContext("2d");
    const type = chartTypeSelect?.value || "bar";

    if (type === "bar") {
        const stdTotals = {};
        bookBillsCache.forEach(b => {
            const std = b.standard || "Other";
            stdTotals[std] = (stdTotals[std] || 0) + (Number(b.total) || 0);
        });

        currentBookChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: Object.keys(stdTotals),
                datasets: [{
                    label: "Revenue (₹)",
                    data: Object.values(stdTotals),
                    backgroundColor: "#1d4ed8",
                    hoverBackgroundColor: "#1e40af",
                    borderRadius: 6,
                    maxBarThickness: 45
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (c) => ` Revenue: ₹${Number(c.raw).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { callback: v => "₹" + Number(v).toLocaleString("en-IN") },
                        grid: { color: "#f1f5f9" }
                    },
                    x: { grid: { display: false } }
                }
            }
        });

    } else if (type === "bundlePie") {
        const bundleCounts = {
            "Complete Sets": 0,
            "Textbook Sets": 0,
            "Notebook Sets": 0,
            "Loose / Individual": 0
        };

        bookBillsCache.forEach(b => {
            (b.items || []).forEach(i => {
                const name = (i.name || "").trim().toUpperCase();
                const qty = Number(i.quantity) || 0;
                if (qty <= 0) return;

                if (name === "TOTAL AMOUNT" || name === "COMPLETE SET" || name === "FULL SET") {
                    bundleCounts["Complete Sets"] += qty;
                } else if (name === "TEXTBOOKS SET" || name === "TEXTBOOK SET") {
                    bundleCounts["Textbook Sets"] += qty;
                } else if (name === "NOTEBOOK SET" || name === "NOTEBOOKS SET") {
                    bundleCounts["Notebook Sets"] += qty;
                } else {
                    bundleCounts["Loose / Individual"] += qty;
                }
            });
        });

        const activeLabels = [];
        const activeData = [];
        const palette = ["#2563eb", "#059669", "#d97706", "#7c3aed"];

        Object.keys(bundleCounts).forEach(key => {
            if (bundleCounts[key] > 0) {
                activeLabels.push(key);
                activeData.push(bundleCounts[key]);
            }
        });

        currentBookChart = new Chart(ctx, {
            type: "pie",
            data: {
                labels: activeLabels,
                datasets: [{
                    data: activeData,
                    backgroundColor: palette.slice(0, activeLabels.length),
                    borderWidth: 2,
                    borderColor: "#ffffff"
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: { boxWidth: 14, padding: 12, font: { size: 11, weight: "bold" } }
                    },
                    tooltip: {
                        callbacks: {
                            label: (c) => ` ${c.label}: ${c.raw} units`
                        }
                    }
                }
            }
        });

    } else if (type === "topBooks") {
        const itemCounts = {};

        bookBillsCache.forEach(b => {
            (b.items || []).forEach(i => {
                const name = (i.name || "").trim();
                const upper = name.toUpperCase();
                const qty = Number(i.quantity) || 0;

                if (
                    upper === "TOTAL AMOUNT" || 
                    upper.includes("TEXTBOOK SET") || 
                    upper.includes("TEXTBOOKS SET") || 
                    upper.includes("NOTEBOOK SET") ||
                    upper.includes("COMPLETE SET")
                ) {
                    return;
                }

                if (name && qty > 0) {
                    itemCounts[name] = (itemCounts[name] || 0) + qty;
                }
            });
        });

        const sortedItems = Object.entries(itemCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8);

        const labels = sortedItems.map(item => item[0]);
        const counts = sortedItems.map(item => item[1]);

        currentBookChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: labels.length > 0 ? labels : ["No Loose Books Sold"],
                datasets: [{
                    label: "Quantity Sold",
                    data: counts.length > 0 ? counts : [0],
                    backgroundColor: "#059669",
                    hoverBackgroundColor: "#047857",
                    borderRadius: 6,
                    maxBarThickness: 45
                }]
            },
            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (c) => ` Quantity: ${c.raw} sold`
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 },
                        grid: { color: "#f1f5f9" }
                    },
                    y: { grid: { display: false } }
                }
            }
        });

    } else if (type === "paymentPie") {
        const payTotals = { Cash: 0, "Online / UPI": 0 };
        bookBillsCache.forEach(b => {
            if (b.paymentMode === "Online") payTotals["Online / UPI"] += (Number(b.total) || 0);
            else payTotals["Cash"] += (Number(b.total) || 0);
        });

        currentBookChart = new Chart(ctx, {
            type: "pie",
            data: {
                labels: Object.keys(payTotals),
                datasets: [{
                    data: Object.values(payTotals),
                    backgroundColor: ["#f59e0b", "#1d4ed8"],
                    borderWidth: 2,
                    borderColor: "#ffffff"
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: "bottom" },
                    tooltip: {
                        callbacks: {
                            label: (c) => ` ₹${Number(c.raw).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                        }
                    }
                }
            }
        });

    } else if (type === "line") {
        const dailyTotals = {};
        bookBillsCache.forEach(b => {
            const dt = b.billDate || "";
            if (dt) dailyTotals[dt] = (dailyTotals[dt] || 0) + (Number(b.total) || 0);
        });

        const sortedDates = Object.keys(dailyTotals).sort();
        const sortedValues = sortedDates.map(d => dailyTotals[d]);

        currentBookChart = new Chart(ctx, {
            type: "line",
            data: {
                labels: sortedDates.map(d => {
                    const p = d.split("-");
                    return p.length === 3 ? `${p[2]}/${p[1]}` : d;
                }),
                datasets: [{
                    label: "Daily Collection (₹)",
                    data: sortedValues,
                    borderColor: "#ef4444",
                    backgroundColor: "rgba(239, 68, 68, 0.08)",
                    borderWidth: 2.5,
                    pointBackgroundColor: "#ef4444",
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.35
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (c) => ` Total: ₹${Number(c.raw).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { callback: v => "₹" + Number(v).toLocaleString("en-IN") },
                        grid: { color: "#f1f5f9" }
                    },
                    x: { grid: { display: false } }
                }
            }
        });
    }
}

document.getElementById("chartTypeSelect")?.addEventListener("change", renderBooksChart);

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

        individualBookList.forEach(bookTitle => {
            row[bookTitle] = extraItemQuantities[bookTitle] || "";
        });

        return row;
    });

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
// EVENT LISTENERS & INITIALIZATION
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

const now = new Date();
setMonthRange(now.getFullYear(), now.getMonth());

const savedBranch = localStorage.getItem("selectedBranch");
if (savedBranch && reportBranch) {
    reportBranch.value = savedBranch;
}

loadReport();
