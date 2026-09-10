const STORAGE_KEY = "budgetAppBudgets";
const STORAGE_ACTIVE_KEY = "budgetAppActiveBudgetId";
const STORAGE_THEME_KEY = "budgetAppTheme";
const MONTHS = [
  "Januari",
  "Februari",
  "Mars",
  "April",
  "Maj",
  "Juni",
  "Juli",
  "Augusti",
  "September",
  "Oktober",
  "November",
  "December"
];

const CATEGORY_COLORS = {
  fixed: "#FF9F43",
  variable: "#FFD93D",
  savings: "#4D96FF"
};

const DEFAULT_EXPENSES = [
  { name: "Hyra", category: "fixed" },
  { name: "Hemförsäkring", category: "fixed" },
  { name: "Bilförsäkring", category: "fixed" },
  { name: "Internet", category: "fixed" },
  { name: "Mat", category: "variable" },
  { name: "Bränsle", category: "variable" },
  { name: "Nöje", category: "variable" },
  { name: "Sparkonto", category: "savings" }
];

const appState = {
  budgets: loadBudgets(),
  activeBudgetId: localStorage.getItem(STORAGE_ACTIVE_KEY) || null
};

let updaterInstance = null;
let updaterRelaunch = null;
let updaterReady = false;
let updaterDownloading = false;
let updaterCheckInProgress = false;

const page = document.body.dataset.page || "start";

function applyTheme(theme = localStorage.getItem(STORAGE_THEME_KEY) || "light") {
  const selectedTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = selectedTheme;
  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    button.classList.toggle("active", button.dataset.themeChoice === selectedTheme);
  });
}

function ensureUpdateModal() {
  let modal = document.getElementById("updateModalBackdrop");
  if (modal) {
    return modal;
  }

  modal = document.createElement("div");
  modal.id = "updateModalBackdrop";
  modal.className = "modal-backdrop hidden";
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="updateModalTitle">
      <div class="modal-header">
        <h3 id="updateModalTitle">Uppdatering</h3>
      </div>
      <p>En ny version av Budgetplaneraren finns tillgänglig.</p>
      <p class="update-status" data-update-status>Förbereder uppdateringen...</p>
      <div class="modal-actions">
        <button class="secondary-btn" type="button" data-update-action="later">Dölj</button>
        <button class="primary-btn" type="button" data-update-action="install" disabled>Uppdaterar automatiskt...</button>
      </div>
    </div>
  `;

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
    }
  });

  modal.querySelector('[data-update-action="later"]').addEventListener("click", () => {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  });

  modal.querySelector('[data-update-action="install"]').addEventListener("click", async () => {
    const installButton = modal.querySelector('[data-update-action="install"]');
    if (!updaterInstance || !updaterReady) {
      return;
    }

    installButton.disabled = true;
    await installPreparedUpdate(modal);
  });

  document.body.appendChild(modal);
  return modal;
}

function showUpdatePrompt(update, relaunch) {
  updaterInstance = update;
  updaterRelaunch = relaunch;
  updaterReady = false;
  updaterDownloading = false;

  const modal = ensureUpdateModal();
  const installButton = modal.querySelector('[data-update-action="install"]');
  const status = modal.querySelector("[data-update-status]");
  if (installButton) {
    installButton.disabled = true;
    installButton.textContent = "Laddar ner...";
  }
  if (status) {
    status.textContent = `Version ${update.version} laddas ner i bakgrunden...`;
  }

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");

  prepareUpdateDownload(update, modal).catch((error) => {
    console.error("Kunde inte ladda ner uppdateringen:", error);
    updaterDownloading = false;
    if (status) {
      status.textContent = "Nedladdningen misslyckades. Försök igen senare.";
    }
  });
}

async function prepareUpdateDownload(update, modal) {
  if (updaterDownloading || updaterReady) {
    return;
  }

  updaterDownloading = true;
  const status = modal.querySelector("[data-update-status]");
  await update.download((event) => {
    if (event.event !== "Progress" || !status) {
      return;
    }

    status.textContent = "Laddar ner uppdateringen...";
  });

  updaterDownloading = false;
  updaterReady = true;
  const installButton = modal.querySelector('[data-update-action="install"]');
  if (installButton) {
    installButton.disabled = false;
    installButton.textContent = "Startar om snart...";
  }
  if (status) {
    status.textContent = `Version ${update.version} är redo. Appen uppdateras automatiskt.`;
  }

  await installPreparedUpdate(modal);
}

async function installPreparedUpdate(modal) {
  if (!updaterInstance || !updaterReady) {
    return;
  }

  updaterReady = false;
  const installButton = modal.querySelector('[data-update-action="install"]');
  const status = modal.querySelector("[data-update-status]");
  if (installButton) {
    installButton.disabled = true;
    installButton.textContent = "Installerar...";
  }
  if (status) {
    status.textContent = "Installerar uppdateringen och startar om appen...";
  }

  try {
    await updaterInstance.install({ restartAfterInstall: true });
    if (updaterRelaunch) {
      await updaterRelaunch();
    }
  } catch (error) {
    console.error("Kunde inte installera uppdateringen:", error);
    if (installButton) {
      installButton.disabled = false;
      installButton.textContent = "Försök igen";
    }
    if (status) {
      status.textContent = "Installationen misslyckades. Försök igen senare.";
    }
  }
}

async function checkForUpdates() {
  try {
    const [{ check }, { relaunch }] = await Promise.all([
      import("@tauri-apps/plugin-updater"),
      import("@tauri-apps/plugin-process")
    ]);

    if (updaterCheckInProgress || updaterInstance) {
      return;
    }

    updaterCheckInProgress = true;
    const update = await check({ timeout: 30000 });
    if (update) {
      showUpdatePrompt(update, relaunch);
    }
  } catch (error) {
    console.info("Ingen uppdatering hittades eller appen körs inte i Tauri:", error);
  } finally {
    updaterCheckInProgress = false;
  }
}

function setTheme(theme) {
  localStorage.setItem(STORAGE_THEME_KEY, theme);
  applyTheme(theme);
}

applyTheme();

const elements = {
  startBudgetForm: document.getElementById("startBudgetForm"),
  landingBudgetName: document.getElementById("landingBudgetName"),
  landingBudgetMonth: document.getElementById("landingBudgetMonth"),
  landingBudgetYear: document.getElementById("landingBudgetYear"),

  budgetTitle: document.getElementById("budgetTitle"),
  budgetMeta: document.getElementById("budgetMeta"),
  salaryDisplay: document.getElementById("salaryDisplay"),
  salaryInput: document.getElementById("salaryInput"),
  saveSalaryBtn: document.getElementById("saveSalaryBtn"),
  totalExpensesDisplay: document.getElementById("totalExpensesDisplay"),
  remainingDisplay: document.getElementById("remainingDisplay"),
  remainingCard: document.getElementById("remainingCard"),
  budgetWarning: document.getElementById("budgetWarning"),
  chartTotalValue: document.getElementById("chartTotalValue"),
  fixedSummary: document.getElementById("fixedSummary"),
  variableSummary: document.getElementById("variableSummary"),
  savingsSummary: document.getElementById("savingsSummary"),
  budgetSummary: document.getElementById("budgetSummary"),
  remainingSummary: document.getElementById("remainingSummary"),
  chartLegend: document.getElementById("chartLegend"),

  saveBudgetBtn: document.getElementById("saveBudgetBtn"),
  saveStatus: document.getElementById("saveStatus"),
  backToHomeBtn: document.getElementById("backToHomeBtn"),

  costModalBackdrop: document.getElementById("costModalBackdrop"),
  costForm: document.getElementById("costForm"),
  modalTitle: document.getElementById("modalTitle"),
  costId: document.getElementById("costId"),
  costName: document.getElementById("costName"),
  costBudget: document.getElementById("costBudget"),
  costAmount: document.getElementById("costAmount"),
  costCategory: document.getElementById("costCategory"),
  closeModalBtn: document.getElementById("closeModalBtn"),
  cancelCostBtn: document.getElementById("cancelCostBtn"),

  fixedTableBody: document.getElementById("fixedTableBody"),
  variableTableBody: document.getElementById("variableTableBody"),
  savingsTableBody: document.getElementById("savingsTableBody"),
  fixedBudgetTotal: document.getElementById("fixedBudgetTotal"),
  fixedCostTotal: document.getElementById("fixedCostTotal"),
  fixedDiffTotal: document.getElementById("fixedDiffTotal"),
  variableBudgetTotal: document.getElementById("variableBudgetTotal"),
  variableCostTotal: document.getElementById("variableCostTotal"),
  variableDiffTotal: document.getElementById("variableDiffTotal"),
  savingsBudgetTotal: document.getElementById("savingsBudgetTotal"),
  savingsCostTotal: document.getElementById("savingsCostTotal"),
  savingsDiffTotal: document.getElementById("savingsDiffTotal")
};

elements.deleteBudgetModal = document.getElementById("deleteBudgetModal");
elements.confirmDeleteBudgetBtn = document.getElementById("confirmDeleteBudgetBtn");
elements.cancelDeleteBudgetBtn = document.getElementById("cancelDeleteBudgetBtn");
elements.dismissDeleteBudgetBtn = document.getElementById("dismissDeleteBudgetBtn");

let chartInstance = null;
let pendingDeleteBudgetId = null;

function loadBudgets() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.map(addMissingDefaultExpenses) : [];
  } catch (error) {
    console.error("Kunde inte läsa sparade budgetar:", error);
    return [];
  }
}

function addMissingDefaultExpenses(budget) {
  const expenses = Array.isArray(budget.expenses) ? budget.expenses : [];
  const existingNames = new Set(expenses.map((item) => String(item.name).toLowerCase()));
  const missingDefaults = DEFAULT_EXPENSES
    .filter((item) => !existingNames.has(item.name.toLowerCase()))
    .map((item) => ({
      id: createId(),
      name: item.name,
      category: item.category,
      budget: 0,
      cost: 0
    }));

  return { ...budget, expenses: [...expenses, ...missingDefaults] };
}

function persistBudgets() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState.budgets));

  if (appState.activeBudgetId) {
    localStorage.setItem(STORAGE_ACTIVE_KEY, appState.activeBudgetId);
  } else {
    localStorage.removeItem(STORAGE_ACTIVE_KEY);
  }
}

function createId() {
  return `budget-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function formatCurrency(value) {
  const safe = Number.isFinite(value) ? Math.round(Number(value)) : 0;
  return `${new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(safe)} kr`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function readBudgetIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function getBudgetById(id) {
  return appState.budgets.find((budget) => budget.id === id) || null;
}

function getActiveBudget() {
  if (!appState.activeBudgetId) {
    return null;
  }

  const activeBudget = getBudgetById(appState.activeBudgetId);
  if (!activeBudget) {
    appState.activeBudgetId = null;
    persistBudgets();
  }

  return getBudgetById(appState.activeBudgetId) || null;
}

function populateMonthSelect() {
  if (!elements.landingBudgetMonth) {
    return;
  }

  const currentMonth = new Date().getMonth();
  elements.landingBudgetMonth.innerHTML = MONTHS.map(
    (month, index) => `<option value="${month}" ${index === currentMonth ? "selected" : ""}>${month}</option>`
  ).join("");

  if (elements.landingBudgetYear) {
    elements.landingBudgetYear.value = new Date().getFullYear();
  }
}

function showSaveStatus(message) {
  if (!elements.saveStatus) {
    return;
  }

  elements.saveStatus.textContent = message;
  elements.saveStatus.classList.remove("hidden");
  clearTimeout(showSaveStatus.timeoutId);
  showSaveStatus.timeoutId = setTimeout(() => {
    elements.saveStatus.classList.add("hidden");
  }, 2200);
}

function handleStartBudgetSubmit(event) {
  event.preventDefault();

  const name = elements.landingBudgetName.value.trim();
  const month = elements.landingBudgetMonth.value;
  const year = Number(elements.landingBudgetYear.value);

  if (!name) {
    alert("Skriv in ett namn på budgeten.");
    return;
  }

  if (!month || !Number.isFinite(year)) {
    alert("Välj månad och år.");
    return;
  }

  const newBudget = {
    id: createId(),
    name,
    month,
    year,
    income: 0,
    expenses: DEFAULT_EXPENSES.map((item) => ({
      id: createId(),
      name: item.name,
      category: item.category,
      budget: 0,
      cost: 0
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  appState.budgets.push(newBudget);
  appState.activeBudgetId = newBudget.id;
  persistBudgets();

  window.location.href = `budget.html?id=${newBudget.id}`;
}

function getBudgetCategoryTotals(expenses = []) {
  const totals = {
    fixed: { budget: 0, cost: 0 },
    variable: { budget: 0, cost: 0 },
    savings: { budget: 0, cost: 0 }
  };

  expenses.forEach((item) => {
    if (!totals[item.category]) {
      return;
    }

    totals[item.category].budget += Number(item.budget || 0);
    totals[item.category].cost += Number(item.cost || 0);
  });

  return totals;
}

function getBudgetTotalBudget(expenses = []) {
  return expenses.reduce((sum, item) => sum + Number(item.budget || 0), 0);
}

function getBudgetTotalExpenses(expenses = []) {
  return expenses.reduce((sum, item) => sum + Number(item.cost || 0), 0);
}

function getRemainingAmount(income, expenses) {
  return Number(income || 0) - getBudgetTotalExpenses(expenses);
}

function getDeltaInfo(item) {
  const delta = Number(item.cost || 0) - Number(item.budget || 0);

  if (delta > 0) {
    return { className: "negative", label: `Över ${formatCurrency(Math.abs(delta))}` };
  }

  if (delta < 0) {
    return { className: "positive", label: `Under ${formatCurrency(Math.abs(delta))}` };
  }

  return { className: "warning", label: "Jämnt" };
}

function renderTableForCategory(category, expenses) {
  const tbody = elements[`${category}TableBody`];
  if (!tbody) {
    return;
  }

  const items = expenses.filter((item) => item.category === category);
  const totals = getBudgetCategoryTotals(expenses)[category];

  if (!items.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" class="empty-row">Inga kostnader ännu.</td>
      </tr>
    `;

    const budgetTotalEl = elements[`${category}BudgetTotal`];
    const costTotalEl = elements[`${category}CostTotal`];
    const diffTotalEl = elements[`${category}DiffTotal`];

    if (budgetTotalEl) budgetTotalEl.textContent = "0 kr";
    if (costTotalEl) costTotalEl.textContent = "0 kr";
    if (diffTotalEl) {
      diffTotalEl.textContent = "0 kr";
      diffTotalEl.style.color = "#475569";
    }
    return;
  }

  tbody.innerHTML = items
    .map((item) => {
      const deltaInfo = getDeltaInfo(item);
      return `
        <tr>
          <td class="name-cell">
            <div class="cost-name">${escapeHtml(item.name)}</div>
            <div class="row-actions">
              <button class="action-btn edit-btn" type="button" data-id="${item.id}">✏️ Redigera</button>
              <button class="action-btn delete-btn" type="button" data-id="${item.id}">🗑️ Ta bort</button>
            </div>
          </td>
          <td>${formatCurrency(item.budget)}</td>
          <td class="cost-cell">
            <span>${formatCurrency(item.cost)}</span>
            <span class="delta-pill ${deltaInfo.className}">${deltaInfo.label}</span>
          </td>
        </tr>
      `;
    })
    .join("");

  const diff = totals.budget - totals.cost;
  const diffText = diff >= 0 ? formatCurrency(diff) : formatCurrency(Math.abs(diff));

  if (elements[`${category}BudgetTotal`]) {
    elements[`${category}BudgetTotal`].textContent = formatCurrency(totals.budget);
  }
  if (elements[`${category}CostTotal`]) {
    elements[`${category}CostTotal`].textContent = formatCurrency(totals.cost);
  }
  if (elements[`${category}DiffTotal`]) {
    elements[`${category}DiffTotal`].textContent = diffText;
    elements[`${category}DiffTotal`].style.color = diff >= 0 ? "#22C55E" : "#EF4444";
    if (diff === 0) {
      elements[`${category}DiffTotal`].style.color = "#475569";
    }
  }
}

function renderChart(expenses) {
  const totals = getBudgetCategoryTotals(expenses);
  const data = [totals.fixed.cost, totals.variable.cost, totals.savings.cost];

  if (chartInstance) {
    chartInstance.destroy();
  }

  const ctx = document.getElementById("expensesChart");
  if (!ctx) {
    return;
  }

  chartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Fasta avgifter", "Rörliga avgifter", "Sparanden"],
      datasets: [
        {
          data,
          backgroundColor: ["#FF9F43", "#FFD93D", "#4D96FF"],
          borderWidth: 0,
          hoverOffset: 10,
          spacing: 3,
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "62%",
      animation: {
        animateRotate: true,
        animateScale: true,
        duration: 700,
        easing: "easeOutQuart"
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#10233f",
          titleColor: "#ffffff",
          bodyColor: "#dbeafe",
          padding: 12,
          cornerRadius: 10,
          displayColors: true,
          callbacks: {
            label: (context) => `${context.label}: ${formatCurrency(context.parsed)}`
          }
        }
      }
    }
  });

  if (elements.chartLegend) {
    const legendRows = [
      { label: "Fasta avgifter", value: totals.fixed.cost, color: CATEGORY_COLORS.fixed },
      { label: "Rörliga avgifter", value: totals.variable.cost, color: CATEGORY_COLORS.variable },
      { label: "Sparanden", value: totals.savings.cost, color: CATEGORY_COLORS.savings }
    ];

    elements.chartLegend.innerHTML = legendRows
      .map(
        (entry) => `
          <div class="legend-item">
            <div class="legend-left">
              <span class="legend-dot" style="background:${entry.color}"></span>
              <span>${entry.label}</span>
            </div>
            <strong>${formatCurrency(entry.value)}</strong>
          </div>
        `
      )
      .join("");
  }
}

function renderBudgetDashboard() {
  const budget = getActiveBudget();
  if (!budget) {
    if (elements.budgetTitle) elements.budgetTitle.textContent = "Ingen budget vald";
    if (elements.budgetMeta) elements.budgetMeta.textContent = "";
    return;
  }

  const expenses = budget.expenses || [];
  const categoryTotals = getBudgetCategoryTotals(expenses);
  const totalExpenses = getBudgetTotalExpenses(expenses);
  const totalBudget = getBudgetTotalBudget(expenses);
  const remaining = getRemainingAmount(budget.income || 0, expenses);

  if (elements.budgetTitle) {
    elements.budgetTitle.textContent = budget.name;
  }
  if (elements.budgetMeta) {
    elements.budgetMeta.textContent = `${budget.month} ${budget.year}`;
  }

  if (elements.salaryDisplay) elements.salaryDisplay.textContent = formatCurrency(budget.income || 0);
  if (elements.salaryInput) elements.salaryInput.value = Number(budget.income || 0);
  if (elements.totalExpensesDisplay) elements.totalExpensesDisplay.textContent = formatCurrency(totalExpenses);
  if (elements.chartTotalValue) elements.chartTotalValue.textContent = formatCurrency(totalExpenses);
  if (elements.fixedSummary) elements.fixedSummary.textContent = formatCurrency(categoryTotals.fixed.cost);
  if (elements.variableSummary) elements.variableSummary.textContent = formatCurrency(categoryTotals.variable.cost);
  if (elements.savingsSummary) elements.savingsSummary.textContent = formatCurrency(categoryTotals.savings.cost);
  if (elements.budgetSummary) elements.budgetSummary.textContent = formatCurrency(totalBudget);
  if (elements.remainingDisplay) elements.remainingDisplay.textContent = formatCurrency(remaining);
  if (elements.remainingSummary) elements.remainingSummary.textContent = formatCurrency(remaining);

  if (elements.remainingDisplay) {
    elements.remainingDisplay.classList.toggle("positive", remaining >= 0);
    elements.remainingDisplay.classList.toggle("negative", remaining < 0);
  }
  if (elements.remainingCard) {
    elements.remainingCard.classList.toggle("positive-state", remaining >= 0);
    elements.remainingCard.classList.toggle("negative-state", remaining < 0);
  }
  if (elements.budgetWarning) {
    elements.budgetWarning.classList.toggle("hidden", remaining >= 0);
  }

  renderTableForCategory("fixed", expenses);
  renderTableForCategory("variable", expenses);
  renderTableForCategory("savings", expenses);
  renderChart(expenses);
}

function saveBudget() {
  const budget = getActiveBudget();
  if (!budget) {
    return;
  }

  budget.updatedAt = new Date().toISOString();
  persistBudgets();
  showSaveStatus("Budgeten har sparats!");
  renderBudgetDashboard();
}

function saveSalary() {
  const budget = getActiveBudget();
  if (!budget) {
    return;
  }

  const value = Number(elements.salaryInput.value);
  if (!Number.isFinite(value) || value < 0) {
    alert("Lönen måste vara ett positivt tal.");
    elements.salaryInput.value = Number(budget.income || 0);
    return;
  }

  budget.income = value;
  budget.updatedAt = new Date().toISOString();
  persistBudgets();
  renderBudgetDashboard();
}

function openExpenseModal(category = "fixed", itemId = null) {
  if (!elements.costModalBackdrop) {
    return;
  }

  elements.costModalBackdrop.classList.remove("hidden");
  elements.costModalBackdrop.setAttribute("aria-hidden", "false");

  if (itemId) {
    const budget = getActiveBudget();
    const item = (budget?.expenses || []).find((entry) => entry.id === itemId);
    if (!item) {
      return;
    }

    if (elements.modalTitle) elements.modalTitle.textContent = "Redigera kostnad";
    const submitButton = elements.costForm.querySelector("button[type='submit']");
    if (submitButton) submitButton.textContent = "Spara ändringar";

    elements.costId.value = item.id;
    elements.costName.value = item.name;
    elements.costBudget.value = item.budget;
    elements.costAmount.value = item.cost;
    elements.costCategory.value = item.category;
    return;
  }

  if (elements.modalTitle) elements.modalTitle.textContent = "Lägg till kostnad";
  const submitButton = elements.costForm.querySelector("button[type='submit']");
  if (submitButton) submitButton.textContent = "Lägg till";

  elements.costId.value = "";
  elements.costName.value = "";
  elements.costBudget.value = "";
  elements.costAmount.value = "";
  elements.costCategory.value = category;
  elements.costName.focus();
}

function closeExpenseModal() {
  if (!elements.costModalBackdrop) {
    return;
  }

  elements.costModalBackdrop.classList.add("hidden");
  elements.costModalBackdrop.setAttribute("aria-hidden", "true");
  elements.costForm.reset();
  elements.costId.value = "";
}

function handleExpenseSubmit(event) {
  event.preventDefault();

  const budget = getActiveBudget();
  if (!budget) {
    return;
  }

  const name = elements.costName.value.trim();
  const budgetValue = Number(elements.costBudget.value);
  const costValue = Number(elements.costAmount.value);
  const category = elements.costCategory.value;

  if (!name) {
    alert("Kostnadstyp får inte vara tom.");
    return;
  }

  if (!Number.isFinite(budgetValue) || budgetValue < 0 || !Number.isFinite(costValue) || costValue < 0) {
    alert("Budget och kostnad måste vara positiva siffror.");
    return;
  }

  const itemId = elements.costId.value || createId();
  const item = {
    id: itemId,
    name,
    category,
    budget: budgetValue,
    cost: costValue
  };

  if (elements.costId.value) {
    budget.expenses = budget.expenses.map((entry) => (entry.id === itemId ? item : entry));
  } else {
    budget.expenses.push(item);
  }

  budget.updatedAt = new Date().toISOString();
  persistBudgets();
  closeExpenseModal();
  renderBudgetDashboard();
}

function handleDeleteExpense(itemId) {
  const budget = getActiveBudget();
  if (!budget) {
    return;
  }

  const item = budget.expenses.find((entry) => entry.id === itemId);
  if (!item) {
    return;
  }

  const confirmed = window.confirm(`Vill du ta bort "${item.name}"?`);
  if (!confirmed) {
    return;
  }

  budget.expenses = budget.expenses.filter((entry) => entry.id !== itemId);
  budget.updatedAt = new Date().toISOString();
  persistBudgets();
  renderBudgetDashboard();
}

function initStartPage() {
  if (!elements.startBudgetForm) {
    return;
  }

  populateMonthSelect();
  elements.startBudgetForm.addEventListener("submit", handleStartBudgetSubmit);
}

function renderProfile() {
  const list = document.getElementById("profileBudgetsList");
  if (!list) {
    return;
  }

  const budgets = [...appState.budgets].sort((first, second) => new Date(second.updatedAt) - new Date(first.updatedAt));
  if (!budgets.length) {
    list.innerHTML = `
      <div class="empty-state-card">
        <h3>Du har inga sparade budgetplaner ännu.</h3>
        <p>Skapa din första budget för att komma igång.</p>
        <a class="primary-btn" href="index.html">+ Skapa ny budget</a>
      </div>
    `;
    return;
  }

  list.innerHTML = budgets.map((budget) => {
    const expenses = budget.expenses || [];
    const totalExpenses = getBudgetTotalExpenses(expenses);
    const remaining = getRemainingAmount(budget.income || 0, expenses);
    return `
      <article class="profile-budget-card">
        <div class="profile-budget-heading">
          <div>
            <p class="eyebrow">Budgetplan</p>
            <h3>${escapeHtml(budget.name)}</h3>
          </div>
          <span class="budget-date">${escapeHtml(budget.month)} ${budget.year}</span>
        </div>
        <div class="profile-budget-details">
          <div><span>Lön</span><strong>${formatCurrency(budget.income || 0)}</strong></div>
          <div><span>Utgifter</span><strong>${formatCurrency(totalExpenses)}</strong></div>
          <div><span>Kvar</span><strong class="${remaining >= 0 ? "positive" : "negative"}">${formatCurrency(remaining)}</strong></div>
        </div>
        <div class="profile-budget-actions">
          <a class="primary-btn" href="budget.html?id=${encodeURIComponent(budget.id)}">Öppna budget</a>
          <button class="secondary-btn delete-budget-btn" type="button" data-id="${budget.id}">🗑 Ta bort</button>
        </div>
      </article>
    `;
  }).join("");
}

function openDeleteBudgetModal(budgetId) {
  if (!getBudgetById(budgetId) || !elements.deleteBudgetModal) {
    return;
  }

  pendingDeleteBudgetId = budgetId;
  elements.deleteBudgetModal.classList.remove("hidden");
  elements.deleteBudgetModal.setAttribute("aria-hidden", "false");
}

function closeDeleteBudgetModal() {
  pendingDeleteBudgetId = null;
  if (!elements.deleteBudgetModal) {
    return;
  }

  elements.deleteBudgetModal.classList.add("hidden");
  elements.deleteBudgetModal.setAttribute("aria-hidden", "true");
}

function deleteBudget() {
  const budget = getBudgetById(pendingDeleteBudgetId);
  if (!budget) {
    closeDeleteBudgetModal();
    return;
  }

  appState.budgets = appState.budgets.filter((item) => item.id !== pendingDeleteBudgetId);
  if (appState.activeBudgetId === pendingDeleteBudgetId) {
    appState.activeBudgetId = null;
  }
  persistBudgets();
  closeDeleteBudgetModal();
  renderProfile();
}

function initProfilePage() {
  renderProfile();

  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    button.addEventListener("click", () => setTheme(button.dataset.themeChoice));
  });

  document.addEventListener("click", (event) => {
    const deleteButton = event.target.closest(".delete-budget-btn");
    if (deleteButton) {
      openDeleteBudgetModal(deleteButton.dataset.id);
    }
  });

  if (elements.confirmDeleteBudgetBtn) {
    elements.confirmDeleteBudgetBtn.addEventListener("click", deleteBudget);
  }
  if (elements.cancelDeleteBudgetBtn) {
    elements.cancelDeleteBudgetBtn.addEventListener("click", closeDeleteBudgetModal);
  }
  if (elements.dismissDeleteBudgetBtn) {
    elements.dismissDeleteBudgetBtn.addEventListener("click", closeDeleteBudgetModal);
  }
  if (elements.deleteBudgetModal) {
    elements.deleteBudgetModal.addEventListener("click", (event) => {
      if (event.target === elements.deleteBudgetModal) {
        closeDeleteBudgetModal();
      }
    });
  }
}

function initBudgetPage() {
  const budgetId = readBudgetIdFromUrl();
  const selectedBudget = budgetId ? getBudgetById(budgetId) : getActiveBudget();

  if (!selectedBudget) {
    window.location.href = "index.html";
    return;
  }

  appState.activeBudgetId = selectedBudget.id;
  persistBudgets();
  renderBudgetDashboard();

  if (elements.saveSalaryBtn) {
    elements.saveSalaryBtn.addEventListener("click", saveSalary);
  }

  if (elements.salaryInput) {
    elements.salaryInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        saveSalary();
      }
    });
  }

  if (elements.saveBudgetBtn) {
    elements.saveBudgetBtn.addEventListener("click", saveBudget);
  }

  if (elements.backToHomeBtn) {
    elements.backToHomeBtn.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  }

  document.addEventListener("click", (event) => {
    const addButton = event.target.closest(".add-cost-btn");
    if (addButton) {
      openExpenseModal(addButton.dataset.category || "fixed");
      return;
    }

    const editButton = event.target.closest(".edit-btn");
    if (editButton) {
      openExpenseModal(null, editButton.dataset.id);
      return;
    }

    const deleteButton = event.target.closest(".delete-btn");
    if (deleteButton) {
      handleDeleteExpense(deleteButton.dataset.id);
    }
  });

  if (elements.costForm) {
    elements.costForm.addEventListener("submit", handleExpenseSubmit);
  }

  if (elements.closeModalBtn) {
    elements.closeModalBtn.addEventListener("click", closeExpenseModal);
  }

  if (elements.cancelCostBtn) {
    elements.cancelCostBtn.addEventListener("click", closeExpenseModal);
  }

  if (elements.costModalBackdrop) {
    elements.costModalBackdrop.addEventListener("click", (event) => {
      if (event.target === elements.costModalBackdrop) {
        closeExpenseModal();
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeExpenseModal();
    }
  });
}

function init() {
  const scheduleUpdateChecks = () => {
    setTimeout(checkForUpdates, 1500);
    setInterval(checkForUpdates, 6 * 60 * 60 * 1000);
  };

  if (page === "profile") {
    initProfilePage();
    scheduleUpdateChecks();
    return;
  }

  if (page === "budget") {
    initBudgetPage();
    scheduleUpdateChecks();
    return;
  }

  initStartPage();
  scheduleUpdateChecks();
}

init();
