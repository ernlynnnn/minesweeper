const COLS = 30;
const ROWS = 16;
const MINE_COUNT = 99;

const boardElement = document.querySelector("#board");
const mineCounterElement = document.querySelector("#mine-counter");
const timerElement = document.querySelector("#timer");
const resetButton = document.querySelector("#reset-button");
const faceElement = document.querySelector("#face");
const messageElement = document.querySelector("#game-message");
const soundToggle = document.querySelector("#sound-toggle");

let cells = [];
let gameState = "ready";
let minesPlaced = false;
let flaggedCount = 0;
let revealedCount = 0;
let seconds = 0;
let timerId = null;
let soundEnabled = true;
let audioContext = null;
let autoSolving = false;
let autoSolveRun = 0;

function createCell(row, col) {
  return {
    row,
    col,
    isMine: false,
    isRevealed: false,
    isFlagged: false,
    adjacentMines: 0,
    element: null,
  };
}

function startGame() {
  stopTimer();
  autoSolveRun += 1;
  autoSolving = false;
  cells = [];
  gameState = "ready";
  minesPlaced = false;
  flaggedCount = 0;
  revealedCount = 0;
  seconds = 0;

  boardElement.replaceChildren();
  const fragment = document.createDocumentFragment();

  for (let row = 0; row < ROWS; row += 1) {
    const rowCells = [];

    for (let col = 0; col < COLS; col += 1) {
      const cell = createCell(row, col);
      const button = document.createElement("button");

      button.className = "cell";
      button.type = "button";
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-label", `Row ${row + 1}, column ${col + 1}, hidden`);
      button.dataset.row = row;
      button.dataset.col = col;
      cell.element = button;
      rowCells.push(cell);
      fragment.append(button);
    }

    cells.push(rowCells);
  }

  boardElement.append(fragment);
  updateCounters();
  faceElement.textContent = "🙂";
  messageElement.textContent = "Clear the field without touching a mine.";
  messageElement.className = "";
}

function getCell(row, col) {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return null;
  return cells[row][col];
}

function getNeighbors(cell) {
  const neighbors = [];

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
      if (rowOffset === 0 && colOffset === 0) continue;
      const neighbor = getCell(cell.row + rowOffset, cell.col + colOffset);
      if (neighbor) neighbors.push(neighbor);
    }
  }

  return neighbors;
}

function placeMines(safeCell) {
  const protectedCells = new Set([safeCell]);
  const candidates = cells.flat().filter((cell) => !protectedCells.has(cell));

  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[randomIndex]] = [candidates[randomIndex], candidates[i]];
  }

  candidates.slice(0, MINE_COUNT).forEach((cell) => {
    cell.isMine = true;
  });

  cells.flat().forEach((cell) => {
    cell.adjacentMines = getNeighbors(cell).filter((neighbor) => neighbor.isMine).length;
  });

  minesPlaced = true;
}

function revealCell(cell) {
  if (gameState === "won" || gameState === "lost" || cell.isFlagged || cell.isRevealed) {
    return;
  }

  const isFirstClick = !minesPlaced;

  if (isFirstClick) {
    placeMines(cell);
    gameState = "playing";
    startTimer();
    messageElement.textContent = "Green cells are safe. Red cells contain mines.";
  }

  if (cell.isMine) {
    loseGame(cell);
    return;
  }

  const queue = [cell];
  const queued = new Set([cell]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (current.isRevealed || current.isFlagged) continue;

    current.isRevealed = true;
    revealedCount += 1;
    renderCell(current);

    if (current.adjacentMines === 0) {
      getNeighbors(current).forEach((neighbor) => {
        if (!neighbor.isMine && !neighbor.isRevealed && !neighbor.isFlagged && !queued.has(neighbor)) {
          queued.add(neighbor);
          queue.push(neighbor);
        }
      });
    }
  }

  playTone(360, 0.04, "sine", 0.12);

  refreshHints();

  checkWin();

  if (isFirstClick && gameState === "playing") {
    void autoSolve(autoSolveRun);
  }
}

function refreshHints() {
  cells.flat().forEach((cell) => {
    cell.element.classList.remove("cell--hint-safe", "cell--hint-mine");
  });

  cells.flat().filter((cell) => cell.isRevealed).forEach((revealedCell) => {
    getNeighbors(revealedCell).forEach((neighbor) => {
      if (neighbor.isRevealed || neighbor.isFlagged) return;

      neighbor.element.classList.add(
        neighbor.isMine ? "cell--hint-mine" : "cell--hint-safe",
      );

      neighbor.element.setAttribute(
        "aria-label",
        `Row ${neighbor.row + 1}, column ${neighbor.col + 1}, ${
          neighbor.isMine ? "mine hint" : "safe hint"
        }`,
      );
    });
  });
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function autoSolve(runId) {
  autoSolving = true;
  messageElement.textContent = "Auto-player started...";
  await wait(350);

  while (runId === autoSolveRun && gameState === "playing") {
    const mineHint = cells.flat().find(
      (cell) => !cell.isFlagged && cell.element.classList.contains("cell--hint-mine"),
    );

    if (mineHint) {
      mineHint.element.classList.add("cell--auto-click");
      await wait(70);
      if (runId !== autoSolveRun || gameState !== "playing") break;
      toggleFlag(mineHint);
      continue;
    }

    const safeHint = cells.flat().find(
      (cell) => !cell.isRevealed && cell.element.classList.contains("cell--hint-safe"),
    );

    if (safeHint) {
      safeHint.element.classList.add("cell--auto-click");
      await wait(70);
      if (runId !== autoSolveRun || gameState !== "playing") break;
      revealCell(safeHint);
      continue;
    }

    break;
  }

  if (runId === autoSolveRun) {
    autoSolving = false;
  }
}

function chordCell(cell) {
  if (!cell.isRevealed || cell.adjacentMines === 0 || gameState !== "playing") return;

  const neighbors = getNeighbors(cell);
  const adjacentFlags = neighbors.filter((neighbor) => neighbor.isFlagged).length;

  if (adjacentFlags !== cell.adjacentMines) return;

  const mineHit = neighbors.find((neighbor) => neighbor.isMine && !neighbor.isFlagged);
  if (mineHit) {
    loseGame(mineHit);
    return;
  }

  neighbors.forEach((neighbor) => revealCell(neighbor));
}

function toggleFlag(cell) {
  if (gameState === "won" || gameState === "lost" || cell.isRevealed) return;
  if (!cell.isFlagged && flaggedCount >= MINE_COUNT) return;

  cell.isFlagged = !cell.isFlagged;
  flaggedCount += cell.isFlagged ? 1 : -1;
  renderCell(cell);
  if (minesPlaced) refreshHints();
  updateCounters();
  playTone(cell.isFlagged ? 620 : 420, 0.05, "square", 0.1);
}

function renderCell(cell) {
  const element = cell.element;
  element.className = "cell";
  element.removeAttribute("data-count");
  element.textContent = "";

  if (cell.isRevealed) {
    element.classList.add("cell--revealed");

    if (cell.isMine) {
      element.classList.add("cell--mine");
      element.setAttribute("aria-label", `Row ${cell.row + 1}, column ${cell.col + 1}, mine`);
    } else if (cell.adjacentMines > 0) {
      element.textContent = cell.adjacentMines;
      element.dataset.count = cell.adjacentMines;
      element.setAttribute(
        "aria-label",
        `Row ${cell.row + 1}, column ${cell.col + 1}, ${cell.adjacentMines} adjacent mines`,
      );
    } else {
      element.setAttribute("aria-label", `Row ${cell.row + 1}, column ${cell.col + 1}, empty`);
    }
  } else if (cell.isFlagged) {
    element.classList.add("cell--flagged");
    element.setAttribute("aria-label", `Row ${cell.row + 1}, column ${cell.col + 1}, flagged`);
  } else {
    element.setAttribute("aria-label", `Row ${cell.row + 1}, column ${cell.col + 1}, hidden`);
  }
}

function loseGame(explodedCell) {
  gameState = "lost";
  stopTimer();

  cells.flat().forEach((cell) => {
    if (cell.isMine && !cell.isFlagged) {
      cell.isRevealed = true;
      renderCell(cell);
    } else if (cell.isFlagged && !cell.isMine) {
      cell.element.className = "cell cell--wrong";
    }
  });

  explodedCell.element.classList.add("cell--exploded");
  faceElement.textContent = "😵";
  messageElement.textContent = "Mine hit. Reset and give it another shot.";
  messageElement.className = "is-loss";
  playLossSound();
}

function checkWin() {
  if (revealedCount !== ROWS * COLS - MINE_COUNT) return;

  gameState = "won";
  stopTimer();

  cells.flat().forEach((cell) => {
    if (cell.isMine && !cell.isFlagged) {
      cell.isFlagged = true;
      flaggedCount += 1;
      renderCell(cell);
    }
  });

  updateCounters();
  faceElement.textContent = "😎";
  messageElement.textContent = `Field cleared in ${seconds} seconds. Nicely done.`;
  messageElement.className = "is-win";
  playWinSound();
}

function startTimer() {
  if (timerId) return;
  timerId = window.setInterval(() => {
    seconds = Math.min(seconds + 1, 999);
    updateCounters();
  }, 1000);
}

function stopTimer() {
  if (!timerId) return;
  window.clearInterval(timerId);
  timerId = null;
}

function updateCounters() {
  const remaining = Math.max(0, MINE_COUNT - flaggedCount);
  mineCounterElement.textContent = String(remaining).padStart(3, "0");
  timerElement.textContent = String(seconds).padStart(3, "0");
}

function getAudioContext() {
  if (!soundEnabled) return null;
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

function playTone(frequency, duration, type = "sine", volume = 0.12, delay = 0) {
  const context = getAudioContext();
  if (!context) return;

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const startTime = context.currentTime + delay;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

function playWinSound() {
  [440, 554, 659, 880].forEach((frequency, index) => {
    playTone(frequency, 0.18, "sine", 0.16, index * 0.09);
  });
}

function playLossSound() {
  [180, 140, 95].forEach((frequency, index) => {
    playTone(frequency, 0.22, "sawtooth", 0.12, index * 0.1);
  });
}

boardElement.addEventListener("click", (event) => {
  const element = event.target.closest(".cell");
  if (!element || autoSolving) return;
  const cell = getCell(Number(element.dataset.row), Number(element.dataset.col));

  if (cell.isRevealed) {
    chordCell(cell);
  } else {
    revealCell(cell);
  }
});

boardElement.addEventListener("contextmenu", (event) => {
  const element = event.target.closest(".cell");
  if (!element) return;
  event.preventDefault();
  if (autoSolving) return;
  const cell = getCell(Number(element.dataset.row), Number(element.dataset.col));
  toggleFlag(cell);
});

boardElement.addEventListener("pointerdown", (event) => {
  if (event.button === 0 && gameState !== "won" && gameState !== "lost") {
    faceElement.textContent = "😮";
  }
});

window.addEventListener("pointerup", () => {
  if (gameState === "won") faceElement.textContent = "😎";
  else if (gameState === "lost") faceElement.textContent = "😵";
  else faceElement.textContent = "🙂";
});

resetButton.addEventListener("click", () => {
  playTone(520, 0.06, "sine", 0.12);
  startGame();
});

soundToggle.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundToggle.setAttribute("aria-pressed", String(soundEnabled));
  soundToggle.querySelector("span:last-child").textContent = soundEnabled ? "Sound on" : "Sound off";
  if (soundEnabled) playTone(620, 0.07, "sine", 0.12);
});

startGame();
