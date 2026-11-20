(() => {
  const testFilter = document.querySelector("#test-filter");
  const groupFilter = document.querySelector("#group-filter");
  const athleteFilter = document.querySelector("#athlete-filter");
  const searchInput = document.querySelector("#table-search");
  const chart = document.querySelector("#performance-chart");
  const chartStatus = document.querySelector("#chart-status");
  const tableStatus = document.querySelector("#table-status");
  const hoverDetails = document.querySelector("#hover-details");
  const tableBody = document.querySelector("#performance-table-body");
  const svgNamespace = "http://www.w3.org/2000/svg";
  const expectedHeaders = [
    "athlete",
    "maturity",
    "training_group",
    "test",
    "unit",
    "before",
    "after",
    "change"
  ];
  const groupColors = {
    Control: "#596575",
    PJT: "#236a8d"
  };
  const records = [];

  function parseCsv(csvText) {
    const lines = csvText.trim().split(/\r?\n/);
    const headers = lines.shift().split(",");
    if (headers.join("|") !== expectedHeaders.join("|")) {
      throw new Error("The Explore data file has an unexpected column layout.");
    }

    return lines.map((line, index) => {
      const values = line.split(",");
      if (values.length !== expectedHeaders.length) {
        throw new Error(`Could not read data row ${index + 2}.`);
      }

      const record = Object.fromEntries(
        expectedHeaders.map((header, column) => [header, values[column]])
      );
      for (const column of ["before", "after", "change"]) {
        record[column] = Number(record[column]);
        if (!Number.isFinite(record[column])) {
          throw new Error(`Invalid ${column} value in data row ${index + 2}.`);
        }
      }
      return record;
    });
  }

  function svgElement(name, attributes = {}, text = "") {
    const element = document.createElementNS(svgNamespace, name);
    for (const [attribute, value] of Object.entries(attributes)) {
      element.setAttribute(attribute, value);
    }
    if (text) element.textContent = text;
    return element;
  }

  function formatValue(value, unit) {
    return `${value.toFixed(unit === "kN/m" ? 3 : 2)} ${unit}`;
  }

  function matchesFilters(record) {
    return record.test === testFilter.value &&
      (groupFilter.value === "all" || record.training_group === groupFilter.value) &&
      (athleteFilter.value === "all" || record.athlete === athleteFilter.value);
  }

  function updateAthleteOptions() {
    const previousSelection = athleteFilter.value;
    const available = records.filter(record =>
      record.test === testFilter.value &&
      (groupFilter.value === "all" || record.training_group === groupFilter.value)
    );
    const athletes = new Map(available.map(record => [
      record.athlete,
      `${record.athlete} (${record.maturity}, ${record.training_group})`
    ]));

    athleteFilter.replaceChildren(new Option("All athletes", "all"));
    for (const [value, label] of [...athletes].sort(([a], [b]) => a.localeCompare(b))) {
      athleteFilter.add(new Option(label, value));
    }
    athleteFilter.value = athletes.has(previousSelection) ? previousSelection : "all";
  }

  function showDetails(record) {
    const direction = ["20-m sprint", "L-run test", "Drop jump contact time"].includes(record.test)
      ? " Lower time means better performance."
      : "";
    hoverDetails.textContent =
      `${record.athlete} · ${record.maturity}, ${record.training_group} · ${record.test}: ` +
      `before ${formatValue(record.before, record.unit)}, ` +
      `after ${formatValue(record.after, record.unit)}, ` +
      `change ${formatValue(record.change, record.unit)} (after - before).${direction}`;
  }

  function drawChart(filteredRecords) {
    chart.replaceChildren();
    const selectedTest = testFilter.value;
    const unit = filteredRecords[0]?.unit;
    chart.append(
      svgElement("title", { id: "chart-title" }, `${selectedTest} before and after`),
      svgElement(
        "desc",
        { id: "chart-description" },
        "Each thin line connects a participant's before and after values. Group mean lines are shown when all athletes are selected."
      ),
      svgElement("rect", { x: 0, y: 0, width: 900, height: 500, fill: "white" })
    );

    if (!filteredRecords.length) {
      chart.appendChild(svgElement("text", { x: 450, y: 240, "text-anchor": "middle" }, "No paired records match these filters."));
      chartStatus.textContent = "No paired records match these filters.";
      return;
    }

    const values = filteredRecords.flatMap(record => [record.before, record.after]);
    const observedMin = Math.min(...values);
    const observedMax = Math.max(...values);
    const spread = observedMax - observedMin;
    const padding = spread === 0 ? Math.max(Math.abs(observedMin) * 0.1, 0.1) : spread * 0.15;
    const min = observedMin - padding;
    const max = observedMax + padding;
    const plot = { left: 95, right: 860, top: 65, bottom: 390 };
    const xBefore = plot.left + 65;
    const xAfter = plot.right - 65;
    const yPosition = value => plot.bottom - ((value - min) / (max - min)) * (plot.bottom - plot.top);

    chart.appendChild(svgElement("text", {
      x: 450, y: 32, "text-anchor": "middle", "font-size": 18, "font-weight": "bold"
    }, `${selectedTest} (${unit})`));

    for (let tick = 0; tick <= 4; tick += 1) {
      const value = min + ((max - min) * tick) / 4;
      const y = yPosition(value);
      chart.appendChild(svgElement("line", {
        x1: plot.left, y1: y, x2: plot.right, y2: y, stroke: "#d9dee5"
      }));
      chart.appendChild(svgElement("text", {
        x: plot.left - 10, y: y + 4, "text-anchor": "end", "font-size": 12, fill: "#596575"
      }, value.toFixed(unit === "kN/m" ? 3 : 2)));
    }

    chart.append(
      svgElement("line", { x1: plot.left, y1: plot.top, x2: plot.left, y2: plot.bottom, stroke: "#596575" }),
      svgElement("line", { x1: plot.left, y1: plot.bottom, x2: plot.right, y2: plot.bottom, stroke: "#596575" }),
      svgElement("text", {
        x: 25, y: 230, "text-anchor": "middle", "font-size": 13, fill: "#303944",
        transform: "rotate(-90 25 230)"
      }, `${selectedTest} (${unit})`),
      svgElement("text", {
        x: xBefore, y: plot.bottom + 27, "text-anchor": "middle", "font-size": 14
      }, "Before"),
      svgElement("text", {
        x: xAfter, y: plot.bottom + 27, "text-anchor": "middle", "font-size": 14
      }, "After")
    );

    for (const record of filteredRecords) {
      const color = groupColors[record.training_group];
      const line = svgElement("line", {
        x1: xBefore, y1: yPosition(record.before), x2: xAfter, y2: yPosition(record.after),
        stroke: color, "stroke-opacity": 0.35, "stroke-width": 1.5
      });
      const series = svgElement("g", {
        tabindex: 0,
        role: "group",
        "aria-label": `${record.athlete}, ${record.maturity}, ${record.training_group}; before ${formatValue(record.before, unit)}, after ${formatValue(record.after, unit)}`
      });
      const title = svgElement(
        "title",
        {},
        `${record.athlete} · ${record.maturity} · ${record.training_group} · Before ${formatValue(record.before, unit)} · After ${formatValue(record.after, unit)}`
      );
      series.append(
        title,
        line,
        svgElement("circle", {
          cx: xBefore, cy: yPosition(record.before), r: 4, fill: color
        }),
        svgElement("circle", {
          cx: xAfter, cy: yPosition(record.after), r: 4, fill: color
        })
      );
      series.addEventListener("pointerenter", () => showDetails(record));
      series.addEventListener("focus", () => showDetails(record));
      chart.appendChild(series);
    }

    if (athleteFilter.value === "all") {
      const means = new Map();
      for (const record of filteredRecords) {
        const key = `${record.maturity}|${record.training_group}`;
        if (!means.has(key)) means.set(key, []);
        means.get(key).push(record);
      }
      for (const [key, groupRecords] of means) {
        const [maturity, trainingGroup] = key.split("|");
        const before = groupRecords.reduce((sum, record) => sum + record.before, 0) / groupRecords.length;
        const after = groupRecords.reduce((sum, record) => sum + record.after, 0) / groupRecords.length;
        const color = groupColors[trainingGroup];
        const meanLine = svgElement("line", {
          x1: xBefore, y1: yPosition(before), x2: xAfter, y2: yPosition(after),
          stroke: color, "stroke-width": 3,
          "stroke-dasharray": maturity === "Pre-PHV" ? "7 5" : "none"
        });
        const meanGroup = svgElement("g", {
          tabindex: 0,
          role: "group",
          "aria-label": `${maturity} ${trainingGroup} group mean; before ${formatValue(before, unit)}, after ${formatValue(after, unit)}`
        });
        meanGroup.append(
          svgElement("title", {}, `${maturity} ${trainingGroup} mean · Before ${formatValue(before, unit)} · After ${formatValue(after, unit)}`),
          meanLine,
          svgElement("circle", { cx: xBefore, cy: yPosition(before), r: 5, fill: "white", stroke: color, "stroke-width": 2.5 }),
          svgElement("circle", { cx: xAfter, cy: yPosition(after), r: 5, fill: "white", stroke: color, "stroke-width": 2.5 })
        );
        meanGroup.addEventListener("pointerenter", () => {
          hoverDetails.textContent = `${maturity} ${trainingGroup} group mean: before ${formatValue(before, unit)}, after ${formatValue(after, unit)}.`;
        });
        meanGroup.addEventListener("focus", () => {
          hoverDetails.textContent = `${maturity} ${trainingGroup} group mean: before ${formatValue(before, unit)}, after ${formatValue(after, unit)}.`;
        });
        chart.appendChild(meanGroup);
      }
    }

    chartStatus.textContent =
      `Showing ${filteredRecords.length} paired participant record${filteredRecords.length === 1 ? "" : "s"} for ${selectedTest}.`;
  }

  function renderTable(filteredRecords) {
    const query = searchInput.value.trim().toLowerCase();
    const rows = filteredRecords.filter(record =>
      Object.values(record).some(value => String(value).toLowerCase().includes(query))
    );
    tableBody.replaceChildren();
    for (const record of rows) {
      const row = document.createElement("tr");
      const values = [
        record.athlete,
        record.maturity,
        record.training_group,
        record.test,
        record.unit,
        formatValue(record.before, record.unit),
        formatValue(record.after, record.unit),
        formatValue(record.change, record.unit)
      ];
      for (const value of values) {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      }
      tableBody.appendChild(row);
    }
    tableStatus.textContent =
      `Showing ${rows.length} of ${filteredRecords.length} rows matching the selected filters.`;
  }

  function updateView() {
    const filteredRecords = records.filter(matchesFilters);
    drawChart(filteredRecords);
    renderTable(filteredRecords);
  }

  function initialize(csvText) {
    records.push(...parseCsv(csvText));
    if (records.length === 0) throw new Error("The Explore data file has no records.");

    const tests = [...new Set(records.map(record => record.test))];
    testFilter.replaceChildren();
    for (const test of tests) {
      const unit = records.find(record => record.test === test).unit;
      testFilter.add(new Option(`${test} (${unit})`, test));
    }
    updateAthleteOptions();
    updateView();
    hoverDetails.textContent = "Hover over or keyboard-focus a participant line or point to see details.";
  }

  testFilter.addEventListener("change", () => {
    updateAthleteOptions();
    updateView();
  });
  groupFilter.addEventListener("change", () => {
    updateAthleteOptions();
    updateView();
  });
  athleteFilter.addEventListener("change", updateView);
  searchInput.addEventListener("input", () => renderTable(records.filter(matchesFilters)));

  fetch(new URL("data/explore-performance.csv", document.baseURI))
    .then(response => {
      if (!response.ok) throw new Error(`The data file could not be loaded (HTTP ${response.status}).`);
      return response.text();
    })
    .then(initialize)
    .catch(error => {
      const message = error instanceof Error ? error.message : String(error);
      chartStatus.textContent = `Explore could not load its data: ${message}`;
      tableStatus.textContent = "The searchable table is unavailable until the data load.";
      hoverDetails.textContent = "Check that the website is being served with its data files.";
    });
})();
