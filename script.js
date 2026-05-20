const STORAGE_KEY = "accountingBusinessTranslatorData";
const RECORDS_KEY = "accountingBusinessTranslatorRecords";

const businessRules = {
  invest: {
    name: "股东投入资金",
    vouchers: ["银行回单", "投资协议", "公司章程或股东决议"],
    getEntries(amount) {
      return [
        ["借", "银行存款", amount],
        ["贷", "实收资本", amount]
      ];
    },
    logic: "银行存款属于资产，增加记借方；实收资本属于所有者权益，增加记贷方。",
    reports: [
      "资产负债表：银行存款增加，实收资本增加。",
      "利润表：不影响利润，因为股东投入不是收入。",
      "现金流量表：属于筹资活动现金流入。"
    ]
  },
  bankLoan: {
    name: "银行借款到账",
    vouchers: ["借款合同", "银行回单", "贷款到账通知"],
    getEntries(amount) {
      return [
        ["借", "银行存款", amount],
        ["贷", "短期借款", amount]
      ];
    },
    logic: "银行存款增加，资产增加记借方；企业承担还款义务，负债增加记贷方。",
    reports: [
      "资产负债表：银行存款增加，短期借款增加。",
      "利润表：借款本金到账不影响利润。",
      "现金流量表：属于筹资活动现金流入。"
    ]
  },
  buyPaid: {
    name: "购买商品，已付款",
    vouchers: ["采购合同", "供应商发票", "入库单", "验收单", "付款回单"],
    getEntries(amount) {
      return [
        ["借", "库存商品", amount],
        ["贷", "银行存款", amount]
      ];
    },
    logic: "库存商品属于资产，增加记借方；银行存款减少，资产减少记贷方。",
    notice: "当前分录为基础版，默认不考虑增值税进项税额；实际采购需结合发票税率和纳税人类型处理。",
    reports: [
      "资产负债表：库存商品增加，银行存款减少。",
      "利润表：暂时不影响利润，商品卖出时才结转成本。",
      "现金流量表：属于经营活动现金流出。"
    ]
  },
  buyUnpaid: {
    name: "购买商品，未付款",
    vouchers: ["采购合同", "供应商发票", "入库单", "验收单"],
    getEntries(amount) {
      return [
        ["借", "库存商品", amount],
        ["贷", "应付账款", amount]
      ];
    },
    logic: "库存商品增加，资产增加记借方；尚未付款形成应付账款，负债增加记贷方。",
    notice: "当前分录为基础版，默认不考虑增值税进项税额；实际采购需结合发票税率和纳税人类型处理。",
    reports: [
      "资产负债表：库存商品增加，应付账款增加。",
      "利润表：暂时不影响利润。",
      "现金流量表：暂时没有现金流出。"
    ]
  },
  sellCash: {
    name: "销售商品，已收款",
    vouchers: ["销售合同", "销售发票", "出库单", "客户签收单", "收款回单"],
    getEntries(amount, cost) {
      return buildSaleEntries("银行存款", amount, cost);
    },
    logic: "收到货款使银行存款增加，资产增加记借方；销售形成收入，收入增加记贷方。若填写商品成本，还需要结转主营业务成本。",
    notice: "当前分录为基础版，默认不考虑增值税销项税额。销售库存商品通常还需要结转主营业务成本；若不填写成本，利润影响不完整。",
    reports: [
      "资产负债表：银行存款增加，库存商品可能减少。",
      "利润表：主营业务收入增加，主营业务成本可能增加。",
      "现金流量表：属于经营活动现金流入。"
    ]
  },
  sellCredit: {
    name: "销售商品，未收款",
    vouchers: ["销售合同", "销售发票", "出库单", "客户签收单"],
    getEntries(amount, cost) {
      return buildSaleEntries("应收账款", amount, cost);
    },
    logic: "客户未付款形成应收账款，资产增加记借方；商品已经销售，收入增加记贷方。若填写商品成本，还需要结转主营业务成本。",
    notice: "当前分录为基础版，默认不考虑增值税销项税额。销售库存商品通常还需要结转主营业务成本；若不填写成本，利润影响不完整。",
    reports: [
      "资产负债表：应收账款增加，库存商品可能减少。",
      "利润表：主营业务收入增加，主营业务成本可能增加。",
      "现金流量表：暂时没有现金流入。"
    ]
  },
  receiveDebt: {
    name: "收到客户前欠货款",
    vouchers: ["银行回单", "收款通知", "应收账款明细"],
    getEntries(amount) {
      return [
        ["借", "银行存款", amount],
        ["贷", "应收账款", amount]
      ];
    },
    logic: "收到客户欠款使银行存款增加，资产增加记借方；应收账款减少，资产减少记贷方。",
    reports: [
      "资产负债表：银行存款增加，应收账款减少。",
      "利润表：不影响当期利润，因为收入通常已在销售时确认。",
      "现金流量表：属于经营活动现金流入。"
    ]
  },
  paySupplier: {
    name: "支付供应商欠款",
    vouchers: ["付款申请单", "银行回单", "应付账款明细"],
    getEntries(amount) {
      return [
        ["借", "应付账款", amount],
        ["贷", "银行存款", amount]
      ];
    },
    logic: "偿还欠款使应付账款减少，负债减少记借方；银行存款减少，资产减少记贷方。",
    reports: [
      "资产负债表：应付账款减少，银行存款减少。",
      "利润表：不影响当期利润。",
      "现金流量表：属于经营活动现金流出。"
    ]
  },
  accrueSalary: {
    name: "计提工资",
    vouchers: ["工资表", "考勤记录", "工资计提审批单"],
    getEntries(amount, cost, options = {}) {
      const expense = options.expenseAccount || "管理费用";
      return [
        ["借", expense, amount],
        ["贷", "应付职工薪酬", amount]
      ];
    },
    logic: "计提工资体现权责发生制：工资费用已经发生，即使尚未支付，也应按部门或用途确认费用并形成应付职工薪酬。",
    notice: "实际业务中，工资可能按部门或用途计入管理费用、销售费用、制造费用等。",
    reports: [
      "资产负债表：应付职工薪酬增加，期末结转后未分配利润减少。",
      "利润表：相关费用增加，利润减少。",
      "现金流量表：计提本身不产生现金流。"
    ]
  },
  paySalary: {
    name: "发放工资",
    vouchers: ["工资表", "审批单", "银行代发回单"],
    getEntries(amount) {
      return [
        ["借", "应付职工薪酬", amount],
        ["贷", "银行存款", amount]
      ];
    },
    logic: "发放工资是支付已经计提的职工薪酬：应付职工薪酬减少，负债减少记借方；银行存款减少，资产减少记贷方。",
    reports: [
      "资产负债表：应付职工薪酬减少，银行存款减少。",
      "利润表：支付动作本身不一定再次影响利润，费用通常在计提工资时确认。",
      "现金流量表：属于经营活动现金流出。"
    ]
  },
  payAd: {
    name: "支付广告费",
    vouchers: ["广告合同", "广告发票", "付款回单", "费用审批单"],
    getEntries(amount) {
      return [
        ["借", "销售费用", amount],
        ["贷", "银行存款", amount]
      ];
    },
    logic: "广告费通常计入销售费用，费用增加记借方；银行存款减少，资产减少记贷方。",
    reports: [
      "资产负债表：银行存款减少，期末结转后未分配利润减少。",
      "利润表：销售费用增加，利润减少。",
      "现金流量表：属于经营活动现金流出。"
    ]
  },
  buyAsset: {
    name: "购买固定资产，已付款",
    vouchers: ["采购合同", "固定资产发票", "验收单", "付款回单"],
    getEntries(amount) {
      return [
        ["借", "固定资产", amount],
        ["贷", "银行存款", amount]
      ];
    },
    logic: "当前场景假设通过银行存款支付：固定资产增加，资产增加记借方；银行存款减少，资产减少记贷方。",
    reports: [
      "资产负债表：固定资产增加，银行存款减少。",
      "利润表：购买当期通常不直接影响利润，后续通过折旧影响费用。",
      "现金流量表：属于投资活动现金流出。"
    ]
  },
  buyAssetUnpaid: {
    name: "购买固定资产，未付款",
    vouchers: ["采购合同", "固定资产发票", "验收单", "应付账款确认资料"],
    getEntries(amount) {
      return [
        ["借", "固定资产", amount],
        ["贷", "应付账款", amount]
      ];
    },
    logic: "固定资产已经达到确认条件但尚未付款，固定资产增加记借方；对供应商形成应付账款，负债增加记贷方。",
    reports: [
      "资产负债表：固定资产增加，应付账款增加。",
      "利润表：购买当期通常不直接影响利润，后续通过折旧影响费用。",
      "现金流量表：未付款时暂不产生现金流。"
    ]
  },
  depreciation: {
    name: "计提折旧",
    vouchers: ["固定资产折旧计算表", "折旧政策资料", "固定资产卡片"],
    getEntries(amount, cost, options = {}) {
      const expense = options.expenseAccount || "管理费用";
      return [
        ["借", expense, amount],
        ["贷", "累计折旧", amount]
      ];
    },
    logic: "折旧应按资产用途归集到相应费用或成本科目；累计折旧是固定资产备抵科目，增加记贷方。",
    notice: "实际业务中，折旧可能按资产用途计入管理费用、销售费用、制造费用等。",
    reports: [
      "资产负债表：累计折旧增加，固定资产账面价值减少。",
      "利润表：相关费用或成本增加，利润减少。",
      "现金流量表：计提折旧本身没有现金流。"
    ]
  },
  accrueIncomeTax: {
    name: "计提所得税",
    vouchers: ["所得税计算表", "利润表", "纳税调整明细", "所得税计提审批资料"],
    getEntries(amount) {
      return [
        ["借", "所得税费用", amount],
        ["贷", "应交税费——应交所得税", amount]
      ];
    },
    logic: "根据应纳税所得额计算所得税费用，费用增加记借方；尚未缴纳形成应交税费，负债增加记贷方。",
    reports: [
      "资产负债表：应交税费增加，期末结转后未分配利润减少。",
      "利润表：所得税费用增加，净利润减少。",
      "现金流量表：计提本身不产生现金流，实际缴纳时产生经营活动现金流出。"
    ]
  },
  advanceFromCustomer: {
    name: "预收客户款",
    vouchers: ["收款回单", "销售合同", "预收款明细"],
    getEntries(amount) {
      return [
        ["借", "银行存款", amount],
        ["贷", "合同负债", amount]
      ];
    },
    logic: "收到款项使银行存款增加，资产增加记借方；尚未履约形成合同负债，负债增加记贷方。",
    reports: [
      "资产负债表：银行存款增加，合同负债增加。",
      "利润表：暂时不确认收入，不影响利润。",
      "现金流量表：属于经营活动现金流入。"
    ]
  },
  prepaySupplier: {
    name: "预付供应商款",
    vouchers: ["采购合同", "付款申请单", "银行回单", "预付款明细"],
    getEntries(amount) {
      return [
        ["借", "预付账款", amount],
        ["贷", "银行存款", amount]
      ];
    },
    logic: "预付款形成对供应商的债权，资产增加记借方；银行存款减少，资产减少记贷方。",
    reports: [
      "资产负债表：预付账款增加，银行存款减少。",
      "利润表：暂时不影响利润。",
      "现金流量表：属于经营活动现金流出。"
    ]
  }
};

const navButtons = document.querySelectorAll(".nav-btn");
const metricButtons = document.querySelectorAll("[data-jump-section]");
const sections = document.querySelectorAll(".section");
const toast = document.querySelector("#toast");
const entryForm = document.querySelector("#entryForm");
const businessType = document.querySelector("#businessType");
const expenseField = document.querySelector("#expenseField");
const expenseAccount = document.querySelector("#expenseAccount");
const amountInput = document.querySelector("#amount");
const costInput = document.querySelector("#cost");
const costField = document.querySelector("#costField");
const saveRecordBtn = document.querySelector("#saveRecordBtn");
const copyEntryBtn = document.querySelector("#copyEntryBtn");
const resetBtn = document.querySelector("#resetBtn");
const exportBtn = document.querySelector("#exportBtn");
const saveStatus = document.querySelector("#saveStatus");
const resultTitle = document.querySelector("#resultTitle");
const resultSummary = document.querySelector("#resultSummary");
const resultAmount = document.querySelector("#resultAmount");
const scopeNote = document.querySelector("#scopeNote");
const recordCount = document.querySelector("#recordCount");
const voucherList = document.querySelector("#voucherList");
const entryResult = document.querySelector("#entryResult");
const logicText = document.querySelector("#logicText");
const reportImpact = document.querySelector("#reportImpact");
const voucherOverview = document.querySelector("#voucherOverview");
const reportOverview = document.querySelector("#reportOverview");
const accountGuide = document.querySelector("#accountGuide");
const recordsList = document.querySelector("#recordsList");
const clearRecordsBtn = document.querySelector("#clearRecordsBtn");
const caseDemo = document.querySelector("#caseDemo");

let currentEntries = [];
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");

  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(function () {
    toast.classList.remove("show");
  }, 1800);
}

const accountGuides = [
  { name: "银行存款", type: "资产类", direction: "增加记借方，减少记贷方", use: "记录企业银行账户中的资金变动。" },
  { name: "短期借款", type: "负债类", direction: "增加记贷方，减少记借方", use: "记录企业向银行等金融机构取得的短期借款。" },
  { name: "应收账款", type: "资产类", direction: "增加记借方，减少记贷方", use: "记录客户尚未支付的销售款。" },
  { name: "预付账款", type: "资产类", direction: "增加记借方，减少记贷方", use: "记录企业预先支付给供应商的款项。" },
  { name: "库存商品", type: "资产类", direction: "增加记借方，减少记贷方", use: "记录已入库、准备销售的商品成本。" },
  { name: "固定资产", type: "资产类", direction: "增加记借方，减少记贷方", use: "记录设备、车辆、办公资产等长期资产。" },
  { name: "累计折旧", type: "资产备抵类", direction: "增加记贷方，减少记借方", use: "反映固定资产已经计提的折旧金额。" },
  { name: "应付账款", type: "负债类", direction: "增加记贷方，减少记借方", use: "记录尚未支付给供应商的采购款。" },
  { name: "应付职工薪酬", type: "负债类", direction: "增加记贷方，减少记借方", use: "记录企业应付给职工的工资、奖金、社保等薪酬。" },
  { name: "应交税费", type: "负债类", direction: "增加记贷方，减少记借方", use: "记录企业应向税务机关缴纳的各类税费。" },
  { name: "合同负债", type: "负债类", direction: "增加记贷方，减少记借方", use: "记录已收款但尚未履约的业务。" },
  { name: "实收资本", type: "所有者权益类", direction: "增加记贷方，减少记借方", use: "记录股东实际投入企业的资本。" },
  { name: "主营业务收入", type: "收入类", direction: "增加记贷方，减少记借方", use: "记录企业主要经营活动形成的收入。" },
  { name: "主营业务成本", type: "费用/成本类", direction: "增加记借方，减少记贷方", use: "记录已销售商品对应的成本。" },
  { name: "销售费用", type: "费用类", direction: "增加记借方，减少记贷方", use: "记录广告费、销售人员相关费用等。" },
  { name: "管理费用", type: "费用类", direction: "增加记借方，减少记贷方", use: "记录行政管理部门发生的日常费用。" },
  { name: "制造费用", type: "成本类", direction: "增加记借方，减少记贷方", use: "记录生产车间为组织和管理生产发生的间接费用。" },
  { name: "所得税费用", type: "费用类", direction: "增加记借方，减少记贷方", use: "记录企业当期应确认的所得税费用。" }
];

function switchSection(target) {
  navButtons.forEach(function (navButton) {
    navButton.classList.toggle("active", navButton.dataset.section === target);
  });

  sections.forEach(function (section) {
    section.classList.toggle("active-section", section.id === target);
  });
}

function buildSaleEntries(receivableAccount, amount, cost) {
  const entries = [
    ["借", receivableAccount, amount],
    ["贷", "主营业务收入", amount]
  ];

  if (cost > 0) {
    entries.push(
      ["借", "主营业务成本", cost],
      ["贷", "库存商品", cost]
    );
  }

  return entries;
}

function formatMoney(value) {
  return Number(value).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function renderVouchers(vouchers) {
  voucherList.innerHTML = vouchers
    .map(function (item) {
      return `<li>${item}</li>`;
    })
    .join("");
}

function renderEntries(entries) {
  entryResult.classList.remove("empty-state");
  entryResult.innerHTML = entries
    .map(function ([direction, account, amount]) {
      return `
        <div class="account-entry">
          <strong>${direction}</strong>
          <span>${account}</span>
          <span class="money">${formatMoney(amount)}</span>
        </div>
      `;
    })
    .join("");
}

function renderReports(reports) {
  reportImpact.innerHTML = reports
    .map(function (item) {
      const parts = item.split("：");
      const title = parts[0] || "报表";
      const content = parts.slice(1).join("：") || item;

      return `
        <div class="statement-item">
          <strong>${title}</strong>
          <span>${content}</span>
        </div>
      `;
    })
    .join("");
}

function generateAccountingResult() {
  const rule = businessRules[businessType.value];
  const amount = Number(amountInput.value);
  const cost = Number(costInput.value || 0);
  const options = {
    expenseAccount: expenseAccount.value
  };

  if (!amount || amount <= 0) {
    alert("请输入正确的金额");
    return;
  }

  const entries = rule.getEntries(amount, cost, options);
  currentEntries = entries;
  resultTitle.textContent = rule.name;
  resultAmount.textContent = formatMoney(amount);
  resultSummary.textContent = `业务类型：${rule.name}；金额：${formatMoney(amount)}${cost ? `；商品成本：${formatMoney(cost)}` : ""}；处理口径：基础版，不含增值税。`;
  scopeNote.textContent = rule.notice || "当前为基础工作辅助版，默认不考虑增值税；实际业务需结合发票税率、纳税人类型和公司会计政策处理。";
  renderVouchers(rule.vouchers);
  renderEntries(entries);
  logicText.textContent = rule.logic;
  renderReports(rule.reports);
  saveData();
}

function getCurrentResult() {
  const rule = businessRules[businessType.value];
  const amount = Number(amountInput.value);
  const cost = Number(costInput.value || 0);
  const options = {
    expenseAccount: expenseAccount.value
  };

  if (!amount || amount <= 0) {
    return null;
  }

  return {
    id: Date.now(),
    businessName: rule.name,
    amount,
    cost,
    entries: rule.getEntries(amount, cost, options),
    vouchers: rule.vouchers,
    reports: rule.reports,
    createdAt: new Date().toLocaleString("zh-CN")
  };
}

function renderOverview() {
  voucherOverview.innerHTML = Object.values(businessRules)
    .map(function (rule) {
      return `
        <article class="library-card">
          <h3>${rule.name}</h3>
          <p>${rule.vouchers.join("、")}</p>
        </article>
      `;
    })
    .join("");

  reportOverview.innerHTML = Object.values(businessRules)
    .map(function (rule) {
      return `
        <article class="report-preview-card">
          <h3>${rule.name}</h3>
          ${renderMiniStatements(rule.reports)}
          ${rule.notice ? `<p><strong>处理口径：</strong>${rule.notice}</p>` : ""}
        </article>
      `;
    })
    .join("");
}

function renderMiniStatements(reports) {
  const reportMap = reports.reduce(function (result, item) {
    const parts = item.split("：");
    result[parts[0]] = parts.slice(1).join("：") || item;
    return result;
  }, {});

  return `
    <div class="mini-statements">
      <div class="mini-statement">
        <div class="statement-head">
          <span>资产负债表</span>
          <strong>Balance Sheet</strong>
        </div>
        ${renderStatementRows(reportMap["资产负债表"] || "无直接列示变化")}
      </div>
      <div class="mini-statement">
        <div class="statement-head">
          <span>利润表</span>
          <strong>Income Statement</strong>
        </div>
        ${renderStatementRows(reportMap["利润表"] || "无直接列示变化")}
      </div>
      <div class="mini-statement">
        <div class="statement-head">
          <span>现金流量表</span>
          <strong>Cash Flow</strong>
        </div>
        ${renderStatementRows(reportMap["现金流量表"] || "无直接列示变化")}
      </div>
    </div>
  `;
}

function renderStatementRows(text) {
  return text
    .split("，")
    .filter(Boolean)
    .map(function (item) {
      const trend = item.includes("增加") || item.includes("流入")
        ? "up"
        : item.includes("减少") || item.includes("流出")
          ? "down"
          : "flat";
      const symbol = trend === "up" ? "+" : trend === "down" ? "-" : "=";

      return `
        <div class="statement-row ${trend}">
          <span>${item.replace("。", "")}</span>
          <strong>${symbol}</strong>
        </div>
      `;
    })
    .join("");
}

function renderAccountGuide() {
  accountGuide.innerHTML = accountGuides
    .map(function (item) {
      return `
        <article class="account-row">
          <strong>${item.name}</strong>
          <span class="pill">${item.type}</span>
          <p>${item.direction}。${item.use}</p>
        </article>
      `;
    })
    .join("");
}

function loadRecords() {
  const savedRecords = localStorage.getItem(RECORDS_KEY);

  if (!savedRecords) {
    return [];
  }

  try {
    return JSON.parse(savedRecords);
  } catch (error) {
    localStorage.removeItem(RECORDS_KEY);
    return [];
  }
}

function saveRecords(records) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

function renderRecords() {
  const records = loadRecords();
  recordCount.textContent = records.length;

  if (records.length === 0) {
    recordsList.innerHTML = `
      <article class="library-card">
        <h3>暂无处理记录</h3>
        <p>在“业务转分录”里生成会计处理后，点击“保存记录”即可保存在这里。</p>
      </article>
    `;
    return;
  }

  recordsList.innerHTML = records
    .map(function (record) {
      const entries = record.entries
        .map(function ([direction, account, amount]) {
          return `${direction}：${account} ${formatMoney(amount)}`;
        })
        .join("<br>");

      return `
        <article class="record-card">
          <h3>${record.businessName}</h3>
          <p>金额：${formatMoney(record.amount)} ${record.cost ? `｜成本：${formatMoney(record.cost)}` : ""}</p>
          <p>保存时间：${record.createdAt}</p>
          <div class="record-entry">${entries}</div>
        </article>
      `;
    })
    .join("");
}

function renderCaseDemo() {
  const caseSteps = [
    { title: "股东投入资金", amount: 1000000, entries: [["借", "银行存款", 1000000], ["贷", "实收资本", 1000000]] },
    { title: "采购商品，已付款", amount: 400000, entries: [["借", "库存商品", 400000], ["贷", "银行存款", 400000]] },
    { title: "销售商品，未收款", amount: 600000, entries: [["借", "应收账款", 600000], ["贷", "主营业务收入", 600000], ["借", "主营业务成本", 350000], ["贷", "库存商品", 350000]] },
    { title: "计提工资", amount: 80000, entries: [["借", "管理费用", 80000], ["贷", "应付职工薪酬", 80000]] },
    { title: "发放工资", amount: 80000, entries: [["借", "应付职工薪酬", 80000], ["贷", "银行存款", 80000]] },
    { title: "支付广告费", amount: 20000, entries: [["借", "销售费用", 20000], ["贷", "银行存款", 20000]] },
    { title: "计提所得税", amount: 37500, entries: [["借", "所得税费用", 37500], ["贷", "应交税费——应交所得税", 37500]] }
  ];

  const revenue = 600000;
  const cost = 350000;
  const salary = 80000;
  const advertising = 20000;
  const incomeTax = 37500;
  const netProfit = revenue - cost - salary - advertising - incomeTax;
  const cash = 1000000 - 400000 - 80000 - 20000;
  const receivable = 600000;
  const inventory = 400000 - 350000;
  const assets = cash + receivable + inventory;
  const liabilitiesAndEquity = 1000000 + incomeTax + netProfit;

  caseDemo.innerHTML = `
    <div class="case-summary">
      <div class="case-metric"><span>营业收入</span><strong>${formatMoney(revenue)}</strong></div>
      <div class="case-metric"><span>净利润</span><strong>${formatMoney(netProfit)}</strong></div>
      <div class="case-metric"><span>期末现金</span><strong>${formatMoney(cash)}</strong></div>
      <div class="case-metric"><span>平衡检查</span><strong>${assets === liabilitiesAndEquity ? "平衡" : "需复核"}</strong></div>
    </div>
    <article class="case-step">
      <span>利润计算</span>
      <h3>利润表推导过程</h3>
      <div class="profit-lines">
        <div><span>营业收入</span><strong>${formatMoney(revenue)}</strong></div>
        <div><span>减：主营业务成本</span><strong>${formatMoney(cost)}</strong></div>
        <div><span>减：管理费用</span><strong>${formatMoney(salary)}</strong></div>
        <div><span>减：销售费用</span><strong>${formatMoney(advertising)}</strong></div>
        <div><span>利润总额</span><strong>${formatMoney(revenue - cost - salary - advertising)}</strong></div>
        <div><span>减：所得税费用</span><strong>${formatMoney(incomeTax)}</strong></div>
        <div class="total-line"><span>净利润</span><strong>${formatMoney(netProfit)}</strong></div>
      </div>
    </article>
    ${caseSteps.map(function (step, index) {
      return `
        <article class="case-step">
          <span>${String(index + 1).padStart(2, "0")}</span>
          <h3>${step.title}</h3>
          <p>金额：${formatMoney(step.amount)}</p>
          <div class="record-entry">${getEntryText(step.entries).replace(/\n/g, "<br>")}</div>
        </article>
      `;
    }).join("")}
    <article class="case-step">
      <span>报表关系</span>
      <h3>简化报表推演</h3>
      <p>资产端：银行存款 ${formatMoney(cash)} + 应收账款 ${formatMoney(receivable)} + 库存商品 ${formatMoney(inventory)} = ${formatMoney(assets)}</p>
      <p>负债和权益端：实收资本 ${formatMoney(1000000)} + 应交所得税 ${formatMoney(incomeTax)} + 未分配利润 ${formatMoney(netProfit)} = ${formatMoney(liabilitiesAndEquity)}</p>
      <p>说明：本案例为基础演示，暂未考虑增值税、所得税缴纳时点、期间费用归属部门细分等事项。</p>
    </article>
  `;
}

function saveCurrentRecord() {
  const result = getCurrentResult();

  if (!result) {
    alert("请先输入正确金额并生成会计处理");
    return;
  }

  const records = loadRecords();
  records.unshift(result);
  saveRecords(records.slice(0, 20));
  renderRecords();
  saveStatus.textContent = "处理记录已保存";
  showToast("处理记录已保存，可以在“处理记录”模块查看");
}

function getEntryText(entries) {
  return entries
    .map(function ([direction, account, amount]) {
      return `${direction}：${account} ${formatMoney(amount)}`;
    })
    .join("\n");
}

function copyCurrentEntries() {
  if (currentEntries.length === 0) {
    alert("请先生成会计处理");
    return;
  }

  navigator.clipboard.writeText(getEntryText(currentEntries)).then(function () {
    saveStatus.textContent = "分录已复制";
    showToast("会计分录已复制到剪贴板");
  }).catch(function () {
    alert("当前浏览器不支持自动复制，可以手动选中分录复制");
  });
}

function resetCurrentInput() {
  businessType.value = "invest";
  expenseAccount.value = "管理费用";
  amountInput.value = "";
  costInput.value = "";
  currentEntries = [];
  updateCostField();
  localStorage.removeItem(STORAGE_KEY);

  resultTitle.textContent = "等待生成";
  resultSummary.textContent = "默认示例：销售商品 10,000 元，成本 6,000 元，客户未付款。";
  resultAmount.textContent = "--";
  scopeNote.textContent = "当前为基础工作辅助版，默认不考虑增值税；实际业务需结合发票税率、纳税人类型和公司会计政策处理。";
  voucherList.innerHTML = "";
  entryResult.className = "entry-result empty-state";
  entryResult.textContent = "输入金额后点击生成。";
  logicText.textContent = "系统会说明为什么借记或贷记相关科目。";
  reportImpact.innerHTML = "";
  saveStatus.textContent = "已重置";
  showToast("当前输入和生成结果已重置");
}

function exportRecords() {
  const records = loadRecords();

  if (records.length === 0) {
    showToast("暂无处理记录可以导出，请先保存一条记录");
    return;
  }

  const content = records
    .map(function (record, index) {
      return [
        `#${index + 1} ${record.businessName}`,
        `金额：${formatMoney(record.amount)}${record.cost ? `，成本：${formatMoney(record.cost)}` : ""}`,
        `保存时间：${record.createdAt}`,
        "会计分录：",
        getEntryText(record.entries),
        "凭证清单：",
        record.vouchers.join("、"),
        "财务报表列示：",
        record.reports.join("\n")
      ].join("\n");
    })
    .join("\n\n------------------------------\n\n");

  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "会计业务处理记录.txt";
  link.click();
  URL.revokeObjectURL(url);
  showToast("处理记录已导出为 TXT 文件");
}

function updateCostField() {
  const isSale = businessType.value === "sellCash" || businessType.value === "sellCredit";
  const needsExpenseAccount = businessType.value === "accrueSalary" || businessType.value === "depreciation";

  costField.style.display = isSale ? "grid" : "none";
  expenseField.style.display = needsExpenseAccount ? "grid" : "none";

  if (!isSale) {
    costInput.value = "";
  }
}

function showSavedStatus() {
  saveStatus.textContent = "已保存到本地";

  window.setTimeout(function () {
    saveStatus.textContent = "本地自动保存";
  }, 1200);
}

function saveData() {
  const data = {
    businessType: businessType.value,
    expenseAccount: expenseAccount.value,
    amount: amountInput.value,
    cost: costInput.value
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  showSavedStatus();
}

function loadSavedData() {
  const savedData = localStorage.getItem(STORAGE_KEY);

  if (!savedData) {
    updateCostField();
    return false;
  }

  try {
    const data = JSON.parse(savedData);
    businessType.value = data.businessType || "invest";
    expenseAccount.value = data.expenseAccount || "管理费用";
    amountInput.value = data.amount || "";
    costInput.value = data.cost || "";
  } catch (error) {
    localStorage.removeItem(STORAGE_KEY);
  }

  updateCostField();
  return true;
}

function loadDefaultExample() {
  businessType.value = "sellCredit";
  expenseAccount.value = "管理费用";
  amountInput.value = "10000";
  costInput.value = "6000";
  updateCostField();
  generateAccountingResult();
  saveStatus.textContent = "已加载默认示例";
}

navButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    switchSection(button.dataset.section);
  });
});

metricButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    switchSection(button.dataset.jumpSection);
    const scrollTarget = button.dataset.scrollTarget;

    if (scrollTarget) {
      document.querySelector(`#${scrollTarget}`).scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    document.querySelector(".module-tabs").scrollIntoView({ behavior: "smooth" });
  });
});

businessType.addEventListener("change", function () {
  updateCostField();
  saveData();
});

expenseAccount.addEventListener("change", saveData);
amountInput.addEventListener("input", saveData);
costInput.addEventListener("input", saveData);
entryForm.addEventListener("submit", function (event) {
  event.preventDefault();
  generateAccountingResult();
});
saveRecordBtn.addEventListener("click", saveCurrentRecord);
copyEntryBtn.addEventListener("click", copyCurrentEntries);
resetBtn.addEventListener("click", resetCurrentInput);
exportBtn.addEventListener("click", exportRecords);
clearRecordsBtn.addEventListener("click", function () {
  localStorage.removeItem(RECORDS_KEY);
  renderRecords();
  showToast("处理记录已清空");
});

const hasSavedData = loadSavedData();
renderOverview();
renderAccountGuide();
renderRecords();
renderCaseDemo();

if (!hasSavedData) {
  loadDefaultExample();
}
