// ==UserScript==
// @name         MinesweeperOnline Read-Only Logic Highlighter
// @namespace    minesweeper-learning
// @version      1.1.0
// @description  Highlights logically safe cells and definite mines. Never clicks or flags cells.
// @match        https://minesweeperonline.com/*
// @match        https://www.minesweeperonline.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
  "use strict";

  const SAFE_CLASS = "solver-safe";
  const MINE_CLASS = "solver-mine";
  const PANEL_ID = "solver-highlighter-panel";
  let enabled = true;
  let updateQueued = false;

  function getCells() {
    return [...document.querySelectorAll("#game .square[id]")];
  }

  function getPosition(cell) {
    const match = cell.id.match(/^(\d+)_(\d+)$/);
    return match
      ? { row: Number(match[1]), col: Number(match[2]) }
      : null;
  }

  function getCell(row, col) {
    return document.getElementById(`${row}_${col}`);
  }

  function getNeighbors(cell) {
    const position = getPosition(cell);
    if (!position) return [];

    const neighbors = [];

    for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
      for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
        if (rowOffset === 0 && colOffset === 0) continue;

        const neighbor = getCell(
          position.row + rowOffset,
          position.col + colOffset,
        );

        if (neighbor?.classList.contains("square")) {
          neighbors.push(neighbor);
        }
      }
    }

    return neighbors;
  }

  function getNumber(cell) {
    const numberClass = [...cell.classList].find((name) =>
      /^open[1-8]$/.test(name),
    );

    return numberClass ? Number(numberClass.replace("open", "")) : null;
  }

  function isHidden(cell) {
    return cell.classList.contains("blank");
  }

  function isFlagged(cell) {
    return cell.classList.contains("bombflagged");
  }

  function clearHighlights() {
    getCells().forEach((cell) => {
      cell.classList.remove(SAFE_CLASS, MINE_CLASS);
    });
  }

  function analyzeBoard() {
    clearHighlights();

    if (!enabled) {
      updatePanel(0, 0);
      return;
    }

    const safeCells = new Set();
    const mineCells = new Set();
    const constraints = [];

    getCells().forEach((numberCell) => {
      const number = getNumber(numberCell);
      if (number === null) return;

      const neighbors = getNeighbors(numberCell);
      const flags = neighbors.filter(isFlagged);
      const unknown = neighbors.filter(
        (cell) => isHidden(cell) && !isFlagged(cell),
      );
      const remainingMines = number - flags.length;

      if (unknown.length === 0) return;

      if (remainingMines >= 0 && remainingMines <= unknown.length) {
        constraints.push({
          cells: new Set(unknown),
          mines: remainingMines,
        });
      }

      // If every mine around the number is already flagged,
      // every remaining hidden neighbor is safe.
      if (flags.length === number) {
        unknown.forEach((cell) => safeCells.add(cell));
      }

      // If the remaining hidden cells exactly equal the remaining mines,
      // every one of those hidden cells must be a mine.
      if (remainingMines === unknown.length) {
        unknown.forEach((cell) => mineCells.add(cell));
      }
    });

    // Subset reasoning:
    // If one numbered cell's unknown neighbors are fully contained inside
    // another's, compare only the cells left over between the two groups.
    constraints.forEach((smaller) => {
      constraints.forEach((larger) => {
        if (smaller === larger || smaller.cells.size >= larger.cells.size) return;

        const isSubset = [...smaller.cells].every((cell) =>
          larger.cells.has(cell),
        );
        if (!isSubset) return;

        const difference = [...larger.cells].filter(
          (cell) => !smaller.cells.has(cell),
        );
        const minesInDifference = larger.mines - smaller.mines;

        if (minesInDifference === 0) {
          difference.forEach((cell) => safeCells.add(cell));
        } else if (minesInDifference === difference.length) {
          difference.forEach((cell) => mineCells.add(cell));
        }
      });
    });

    mineCells.forEach((cell) => {
      safeCells.delete(cell);
      cell.classList.add(MINE_CLASS);
    });

    safeCells.forEach((cell) => {
      cell.classList.add(SAFE_CLASS);
    });

    updatePanel(safeCells.size, mineCells.size);
  }

  function queueAnalysis() {
    if (updateQueued) return;
    updateQueued = true;

    window.requestAnimationFrame(() => {
      updateQueued = false;
      analyzeBoard();
    });
  }

  function isRealGameChange(mutations) {
    return mutations.some((mutation) => {
      if (mutation.type === "childList") return true;

      const oldClasses = new Set((mutation.oldValue || "").split(/\s+/).filter(Boolean));
      const newClasses = new Set(mutation.target.classList);

      oldClasses.delete(SAFE_CLASS);
      oldClasses.delete(MINE_CLASS);
      newClasses.delete(SAFE_CLASS);
      newClasses.delete(MINE_CLASS);

      if (oldClasses.size !== newClasses.size) return true;
      return [...oldClasses].some((name) => !newClasses.has(name));
    });
  }

  function updatePanel(safeCount, mineCount) {
    const panel = document.querySelector(`#${PANEL_ID}`);
    if (!panel) return;

    if (!enabled) {
      panel.textContent = "Hints paused";
    } else if (safeCount === 0 && mineCount === 0) {
      panel.textContent = "No certain moves yet";
    } else {
      panel.textContent = `Hints: ${safeCount} safe, ${mineCount} mines`;
    }
  }

  function addStyles() {
    const style = document.createElement("style");
    style.textContent = `
      #game .square.${SAFE_CLASS} {
        position: relative !important;
        z-index: 5 !important;
        outline: 3px solid #00d000 !important;
        outline-offset: -3px !important;
        box-shadow: inset 0 0 0 5px rgba(0, 255, 0, .55) !important;
        filter: brightness(1.25) sepia(.25) saturate(2) !important;
      }

      #game .square.${MINE_CLASS} {
        position: relative !important;
        z-index: 6 !important;
        outline: 3px solid #ff2020 !important;
        outline-offset: -3px !important;
        box-shadow: inset 0 0 0 5px rgba(255, 0, 0, .6) !important;
        filter: brightness(.85) sepia(.4) saturate(3) !important;
      }

      #${PANEL_ID} {
        position: fixed;
        top: 12px !important;
        right: 12px !important;
        bottom: auto !important;
        left: auto !important;
        z-index: 2147483647 !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        width: auto !important;
        height: auto !important;
        padding: 10px 14px !important;
        border: 3px solid #000 !important;
        border-radius: 4px !important;
        background: #ffff00 !important;
        color: #000 !important;
        font: bold 14px Arial, sans-serif !important;
        line-height: 18px !important;
        cursor: pointer !important;
      }
    `;
    document.head.append(style);
  }

  function addPanel() {
    document.querySelector(`#${PANEL_ID}`)?.remove();

    const panel = document.createElement("button");
    panel.id = PANEL_ID;
    panel.type = "button";
    panel.title = "Click to pause or resume hints";
    panel.textContent = "Hint script v1.1 loaded";

    panel.addEventListener("click", () => {
      enabled = !enabled;
      analyzeBoard();
    });

    (document.body || document.documentElement).append(panel);
  }

  function start() {
    const game = document.querySelector("#game");
    if (!game) {
      window.setTimeout(start, 250);
      return;
    }

    addStyles();
    addPanel();

    const observer = new MutationObserver((mutations) => {
      if (isRealGameChange(mutations)) queueAnalysis();
    });
    observer.observe(game, {
      attributes: true,
      attributeFilter: ["class"],
      attributeOldValue: true,
      childList: true,
      subtree: true,
    });

    analyzeBoard();
    console.info("[Minesweeper highlighter] v1.1 loaded successfully");
  }

  start();
})();
