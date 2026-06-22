// ==UserScript==
// @name         Local Minesweeper Auto-Solver Demo
// @namespace    local-minesweeper-learning
// @version      1.0.0
// @description  Demonstrates DOM-based Minesweeper automation 
// @match        http://localhost:*/*
// @match        http://127.0.0.1:*/*
// @grant        none
// ==/UserScript==

(() => {
  "use strict";

  if (!new URLSearchParams(window.location.search).has("external-solver")) return;

  const STEP_DELAY = 90;
  let solving = false;
  let stopped = false;

  const wait = (milliseconds) =>
    new Promise((resolve) => window.setTimeout(resolve, milliseconds));

  function getCells() {
    return [...document.querySelectorAll("#board .cell[id^='cell_']")];
  }

  function getPosition(cell) {
    const match = cell.id.match(/^cell_(\d+)_(\d+)$/);
    return match ? { col: Number(match[1]), row: Number(match[2]) } : null;
  }

  function getNeighbors(cell) {
    const position = getPosition(cell);
    if (!position) return [];

    const neighbors = [];

    for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
      for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
        if (rowOffset === 0 && colOffset === 0) continue;

        const neighbor = document.querySelector(
          `#cell_${position.col + colOffset}_${position.row + rowOffset}`,
        );
        if (neighbor) neighbors.push(neighbor);
      }
    }

    return neighbors;
  }

  function getNumber(cell) {
    const typeClass = [...cell.classList].find((name) => /^hdd_type[1-8]$/.test(name));
    return typeClass ? Number(typeClass.replace("hdd_type", "")) : 0;
  }

  function highlight(cell) {
    cell.classList.add("cell--auto-click");
  }

  function flag(cell) {
    cell.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        view: window,
      }),
    );
  }

  function findBestChord() {
    return getCells()
      .map((cell) => {
        const number = getNumber(cell);
        if (!cell.classList.contains("hdd_opened") || number === 0) return null;

        const neighbors = getNeighbors(cell);
        const flagCount = neighbors.filter((neighbor) =>
          neighbor.classList.contains("hdd_flag"),
        ).length;
        const hiddenCount = neighbors.filter(
          (neighbor) =>
            neighbor.classList.contains("hdd_closed") &&
            !neighbor.classList.contains("hdd_flag"),
        ).length;

        if (flagCount !== number || hiddenCount === 0) return null;
        return { cell, hiddenCount };
      })
      .filter(Boolean)
      .sort((a, b) => b.hiddenCount - a.hiddenCount)[0]?.cell;
  }

  async function solve() {
    if (solving || stopped) return;
    solving = true;
    updateStatus("Solving local board...");

    while (!stopped) {
      const chordTarget = findBestChord();
      if (chordTarget) {
        highlight(chordTarget);
        await wait(STEP_DELAY);
        chordTarget.click();
        continue;
      }

      const mineHint = document.querySelector(
        "#board .cell--hint-mine:not(.hdd_flag)",
      );
      if (mineHint) {
        highlight(mineHint);
        await wait(STEP_DELAY);
        flag(mineHint);
        continue;
      }

      const safeHint = document.querySelector(
        "#board .cell--hint-safe.hdd_closed:not(.hdd_flag)",
      );
      if (safeHint) {
        highlight(safeHint);
        await wait(STEP_DELAY);
        safeHint.click();
        continue;
      }

      break;
    }

    solving = false;
    updateStatus("Solver finished.");
  }

  function updateStatus(text) {
    const panel = document.querySelector("#local-solver-status");
    if (panel) panel.textContent = text;
  }

  function addStatusPanel() {
    const panel = document.createElement("button");
    panel.id = "local-solver-status";
    panel.type = "button";
    panel.textContent = "Local solver ready — make the first click";
    panel.style.cssText = [
      "position:fixed",
      "right:16px",
      "bottom:16px",
      "z-index:99999",
      "padding:10px 14px",
      "border:2px outset white",
      "background:#c0c0c0",
      "color:#000",
      "font:14px monospace",
      "cursor:pointer",
    ].join(";");

    panel.addEventListener("click", () => {
      stopped = !stopped;
      updateStatus(stopped ? "Solver paused — click to resume" : "Solver resumed");
      if (!stopped) void solve();
    });

    document.body.append(panel);
  }

  addStatusPanel();

  document.querySelector("#board")?.addEventListener("click", () => {
    window.setTimeout(() => void solve(), 0);
  });
})();
