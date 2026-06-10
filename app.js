const MANIFEST_URL = "quizzes/index.json";
const DEFAULT_LADDER = [
  "$100",
  "$200",
  "$300",
  "$500",
  "$1,000",
  "$2,000",
  "$4,000",
  "$8,000",
  "$16,000",
  "$32,000",
  "$64,000",
  "$125,000",
  "$250,000",
  "$500,000",
  "$1,000,000"
];
const SAFE_STEPS = new Set([5, 10, 15]);
const LETTERS = ["A", "B", "C", "D", "E", "F"];

const app = document.querySelector("#app");
const title = document.querySelector("#quizTitle");
const homeButton = document.querySelector("#homeButton");
const ladder = document.querySelector("#moneyLadder");
const ladderPanel = document.querySelector(".ladder-panel");
const safeLevel = document.querySelector("#safeLevel");
const loadingTemplate = document.querySelector("#loadingTemplate");
const errorTemplate = document.querySelector("#errorTemplate");

let manifest = [];
let state = createInitialState();

homeButton.addEventListener("click", () => {
  history.pushState({}, "", location.pathname);
  renderLobby();
});

window.addEventListener("popstate", () => {
  loadFromUrl();
});

app.addEventListener("click", async (event) => {
  const quizCard = event.target.closest("[data-quiz-id]");
  if (quizCard) {
    const entry = manifest.find((quiz) => quiz.id === quizCard.dataset.quizId);
    if (entry) {
      history.pushState({}, "", `?quiz=${encodeURIComponent(entry.id)}`);
      loadQuiz(entry);
    }
    return;
  }

  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;

  if (action === "reload") {
    init();
    return;
  }

  if (action === "next") {
    nextQuestion();
    return;
  }

  if (action === "restart") {
    startQuiz(state.quiz);
    return;
  }

  if (action === "start-game") {
    startQuiz(state.quiz);
    return;
  }

  if (action === "copy-link") {
    await copyQuizLink(event.target.closest("button"));
    return;
  }

  if (action === "fifty") {
    useFiftyFifty();
  }
});

function showLoading() {
  app.replaceChildren(loadingTemplate.content.cloneNode(true));
}

function showError(message) {
  const fragment = errorTemplate.content.cloneNode(true);
  fragment.querySelector("#errorMessage").textContent = message;
  app.replaceChildren(fragment);
}

async function init() {
  showLoading();
  renderLadder(DEFAULT_LADDER, -1);

  try {
    const response = await fetch(MANIFEST_URL);
    if (!response.ok) throw new Error(`Could not load ${MANIFEST_URL}`);
    manifest = await response.json();
    if (!Array.isArray(manifest) || manifest.length === 0) {
      throw new Error("The quiz manifest is empty.");
    }
    await loadFromUrl();
  } catch (error) {
    title.textContent = "Quiz Ladder";
    homeButton.hidden = true;
    showError(getLoadErrorMessage(error));
  }
}

function getLoadErrorMessage(error) {
  if (location.protocol === "file:") {
    return "Open this through a local web server so the browser can load the quiz JSON files. Run python3 -m http.server 4173 in this folder, then open http://localhost:4173.";
  }

  return error.message;
}

async function loadFromUrl() {
  const quizId = new URLSearchParams(location.search).get("quiz");
  if (!quizId) {
    renderLobby();
    return;
  }

  const entry = manifest.find((quiz) => quiz.id === quizId);
  if (!entry) {
    renderLobby();
    return;
  }

  await loadQuiz(entry);
}

function renderLobby() {
  title.textContent = "Choose a quiz";
  homeButton.hidden = true;
  state = createInitialState();
  renderLadder(DEFAULT_LADDER, -1);

  const container = document.createElement("div");
  container.className = "lobby";
  container.innerHTML = `
    <p class="lobby-intro">
      Pick a quiz, climb the ladder, and lock in an answer. Each quiz is powered by a separate JSON file, so this can host as many quiz sets as you want.
    </p>
    <div class="quiz-grid"></div>
  `;

  const grid = container.querySelector(".quiz-grid");
  manifest.forEach((quiz) => {
    const card = document.createElement("button");
    card.className = "quiz-card";
    card.type = "button";
    card.dataset.quizId = quiz.id;
    card.innerHTML = `
      <h2></h2>
      <p></p>
      <div class="quiz-meta">
        <span class="pill"></span>
        <span class="pill"></span>
      </div>
      <span class="quiz-start">Start quiz</span>
    `;
    card.querySelector("h2").textContent = quiz.title;
    card.querySelector("p").textContent = quiz.description || "A multiple choice quiz.";
    const pills = card.querySelectorAll(".pill");
    pills[0].textContent = `${quiz.questionCount || "?"} questions`;
    pills[1].textContent = quiz.category || "General";
    grid.append(card);
  });

  app.replaceChildren(container);
}

async function loadQuiz(entry) {
  showLoading();
  try {
    const response = await fetch(`quizzes/${entry.file}`);
    if (!response.ok) throw new Error(`Could not load quizzes/${entry.file}`);
    const quiz = await response.json();
    validateQuiz(quiz);
    showQuizIntro(quiz);
  } catch (error) {
    showError(error.message);
  }
}

function validateQuiz(quiz) {
  if (!quiz || typeof quiz !== "object") {
    throw new Error("Quiz JSON must be an object.");
  }
  if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) {
    throw new Error("Quiz JSON must include at least one question.");
  }
  quiz.questions.forEach((question, index) => {
    if (!question.question || !Array.isArray(question.answers) || question.answers.length < 2) {
      throw new Error(`Question ${index + 1} needs question text and at least two answers.`);
    }
    if (!Number.isInteger(question.correctIndex) || !question.answers[question.correctIndex]) {
      throw new Error(`Question ${index + 1} has an invalid correctIndex.`);
    }
  });
}

function showQuizIntro(quiz) {
  state = createInitialState(quiz);
  title.textContent = quiz.title;
  homeButton.hidden = false;
  renderLadder(getLadderValues(), -1);

  const ladderValues = getLadderValues();
  const container = document.createElement("div");
  container.className = "quiz-intro";
  container.innerHTML = `
    <div class="intro-copy">
      <p class="eyebrow">Ready room</p>
      <h2></h2>
      <p></p>
      <div class="intro-stats">
        <span><strong></strong> Questions</span>
        <span><strong></strong> Top prize</span>
        <span><strong>1</strong> Lifeline</span>
      </div>
    </div>
    <div class="intro-card">
      <div class="intro-orbit" aria-hidden="true"></div>
      <p class="eyebrow">Your climb starts at</p>
      <strong></strong>
      <div class="intro-actions">
        <button class="primary-button" type="button" data-action="start-game">Start game</button>
        <button class="ghost-button" type="button" data-action="copy-link">Copy quiz link</button>
      </div>
    </div>
  `;

  container.querySelector("h2").textContent = quiz.title;
  container.querySelector(".intro-copy > p:not(.eyebrow)").textContent = quiz.description || "A multiple choice ladder quiz.";
  const statValues = container.querySelectorAll(".intro-stats strong");
  statValues[0].textContent = String(quiz.questions.length);
  statValues[1].textContent = ladderValues[ladderValues.length - 1] || "$0";
  container.querySelector(".intro-card strong").textContent = ladderValues[0] || "$100";
  app.replaceChildren(container);
}

function startQuiz(quiz) {
  state = createInitialState(quiz);
  title.textContent = quiz.title;
  homeButton.hidden = false;
  renderGame();
}

async function copyQuizLink(button) {
  if (!state.quiz?.id || !button) return;

  const originalText = button.textContent;
  const url = getQuizUrl(state.quiz.id);

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    } else {
      fallbackCopy(url);
    }
    button.textContent = "Link copied";
  } catch (error) {
    fallbackCopy(url);
    button.textContent = "Link copied";
  }

  window.setTimeout(() => {
    button.textContent = originalText;
  }, 1800);
}

function getQuizUrl(quizId) {
  const url = new URL(location.href);
  url.search = "";
  url.searchParams.set("quiz", quizId);
  url.hash = "";
  return url.toString();
}

function fallbackCopy(text) {
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.append(field);
  field.select();
  document.execCommand("copy");
  field.remove();
}

function createInitialState(quiz = null) {
  return {
    quiz,
    questionIndex: 0,
    selectedIndex: null,
    answered: false,
    finished: false,
    winningsIndex: -1,
    hiddenAnswers: new Set(),
    usedFifty: false
  };
}

function renderGame() {
  const current = getCurrentQuestion();
  const questionNumber = state.questionIndex + 1;
  const totalQuestions = state.quiz.questions.length;
  const ladderValues = getLadderValues();
  const progress = Math.round((questionNumber / totalQuestions) * 100);
  const guaranteedIndex = getGuaranteedPrizeIndex();
  renderLadder(ladderValues, state.questionIndex);

  const container = document.createElement("div");
  container.className = "game";
  container.innerHTML = `
    <div class="game-status">
      <div class="status-card">
        <span>Question</span>
        <strong>${questionNumber} / ${totalQuestions}</strong>
      </div>
      <div class="status-card">
        <span>Current prize</span>
        <strong>${ladderValues[state.questionIndex] || "Final question"}</strong>
      </div>
      <div class="status-card">
        <span>Guaranteed</span>
        <strong>${guaranteedIndex >= 0 ? ladderValues[guaranteedIndex] : "$0"}</strong>
      </div>
    </div>
    <div class="progress-track" aria-hidden="true">
      <span style="width: ${progress}%"></span>
    </div>
    <section class="question-box">
      <p class="question-count">Question ${questionNumber}</p>
      <h2></h2>
    </section>
    <div class="answers"></div>
    <div class="feedback" hidden></div>
    <div class="controls">
      <button class="lifeline-button" type="button" data-action="fifty">50:50</button>
      <button class="primary-button" type="button" data-action="next" hidden>Next question</button>
    </div>
  `;

  container.querySelector("h2").textContent = current.question;
  const answers = container.querySelector(".answers");
  current.answers.forEach((answer, index) => {
    const button = document.createElement("button");
    button.className = "answer-button";
    button.type = "button";
    button.dataset.answerIndex = String(index);
    button.innerHTML = `
      <span class="answer-letter">${LETTERS[index] || index + 1}</span>
      <span class="answer-text"></span>
    `;
    button.querySelector(".answer-text").textContent = answer;
    button.addEventListener("click", () => answerQuestion(index));
    answers.append(button);
  });

  app.replaceChildren(container);
  updateAnswerState();
}

function renderLadder(values, currentIndex, options = {}) {
  const victory = Boolean(options.victory);
  ladderPanel.classList.toggle("is-victory", victory);
  ladder.replaceChildren();
  values.forEach((amount, index) => {
    const item = document.createElement("li");
    const step = index + 1;
    item.dataset.step = String(step).padStart(2, "0");
    item.textContent = amount;
    item.classList.toggle("is-current", victory ? index === values.length - 1 : index === currentIndex);
    item.classList.toggle("is-complete", victory ? true : index < currentIndex);
    item.classList.toggle("is-safe", SAFE_STEPS.has(step));
    ladder.append(item);
  });

  const guaranteedIndex = getGuaranteedPrizeIndex();
  safeLevel.textContent = victory ? "Champion" : guaranteedIndex >= 0 ? values[guaranteedIndex] : currentIndex < 0 ? "Start" : "Playing";
}

function answerQuestion(answerIndex) {
  if (state.answered) return;

  const current = getCurrentQuestion();
  state.selectedIndex = answerIndex;
  state.answered = true;

  if (answerIndex === current.correctIndex) {
    state.winningsIndex = state.questionIndex;
  } else {
    state.finished = true;
  }

  updateAnswerState();
}

function updateAnswerState() {
  const current = getCurrentQuestion();
  const buttons = app.querySelectorAll(".answer-button");
  buttons.forEach((button) => {
    const index = Number(button.dataset.answerIndex);
    button.disabled = state.answered || state.hiddenAnswers.has(index);
    button.classList.toggle("is-hidden", state.hiddenAnswers.has(index));
    button.classList.toggle("is-selected", state.selectedIndex === index);
    button.classList.toggle("is-correct", state.answered && index === current.correctIndex);
    button.classList.toggle("is-wrong", state.answered && state.selectedIndex === index && index !== current.correctIndex);
  });

  const lifeline = app.querySelector("[data-action='fifty']");
  if (lifeline) {
    lifeline.disabled = state.usedFifty || state.answered || current.answers.length < 4;
  }

  const feedback = app.querySelector(".feedback");
  const next = app.querySelector("[data-action='next']");
  if (!feedback || !next) return;

  if (!state.answered) {
    feedback.hidden = true;
    next.hidden = true;
    return;
  }

  const correct = state.selectedIndex === current.correctIndex;
  feedback.hidden = false;
  feedback.innerHTML = correct
    ? `<strong>Correct.</strong> ${current.explanation || "You move up the ladder."}`
    : `<strong>Not this time.</strong> ${current.explanation || "The highlighted answer was correct."}`;

  next.hidden = false;
  next.textContent = getNextButtonLabel(correct);
}

function getNextButtonLabel(correct) {
  if (!correct) return "See results";
  if (state.questionIndex === state.quiz.questions.length - 1) return "Finish quiz";
  return "Next question";
}

function nextQuestion() {
  const current = getCurrentQuestion();
  const correct = state.selectedIndex === current.correctIndex;

  if (!correct || state.questionIndex === state.quiz.questions.length - 1) {
    renderResult(correct);
    return;
  }

  state.questionIndex += 1;
  state.selectedIndex = null;
  state.answered = false;
  state.hiddenAnswers = new Set();
  renderGame();
}

function useFiftyFifty() {
  if (state.usedFifty || state.answered) return;

  const current = getCurrentQuestion();
  const wrongAnswers = current.answers
    .map((_, index) => index)
    .filter((index) => index !== current.correctIndex);

  state.hiddenAnswers = new Set(wrongAnswers.slice(0, Math.max(0, wrongAnswers.length - 1)));
  state.usedFifty = true;
  updateAnswerState();
}

function renderResult(wonFinalQuestion) {
  const ladderValues = getLadderValues();
  const amount = wonFinalQuestion
    ? ladderValues[ladderValues.length - 1]
    : state.winningsIndex >= 0
      ? ladderValues[state.winningsIndex]
      : "$0";

  renderLadder(ladderValues, wonFinalQuestion ? ladderValues.length - 1 : state.winningsIndex, {
    victory: wonFinalQuestion
  });

  const result = document.createElement("div");
  result.className = wonFinalQuestion ? "result is-champion" : "result";
  result.innerHTML = wonFinalQuestion
    ? `
      <div class="champion-badge">Ladder Champion</div>
      <p class="eyebrow">Perfect climb</p>
      <h2 class="champion-amount"></h2>
      <p></p>
      <div class="victory-rules" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div class="controls">
        <button class="primary-button" type="button" data-action="restart">Play again</button>
        <button class="ghost-button" type="button">Choose another quiz</button>
      </div>
    `
    : `
      <p class="eyebrow">Final answer</p>
      <h2></h2>
      <p></p>
      <div class="controls">
        <button class="primary-button" type="button" data-action="restart">Play again</button>
        <button class="ghost-button" type="button">Choose another quiz</button>
      </div>
    `;
  result.querySelector("h2").textContent = amount;
  result.querySelector("p:not(.eyebrow)").textContent = wonFinalQuestion
    ? `You completed ${state.quiz.title} and cleared every step of the ladder.`
    : "That is where this run ends. The next one is waiting.";
  result.querySelector(".ghost-button").addEventListener("click", () => {
    history.pushState({}, "", location.pathname);
    renderLobby();
  });
  app.replaceChildren(result);

  if (wonFinalQuestion) {
    launchConfetti();
  }
}

function launchConfetti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  document.querySelector(".confetti-canvas")?.remove();
  const canvas = document.createElement("canvas");
  canvas.className = "confetti-canvas";
  document.body.append(canvas);

  const context = canvas.getContext("2d");
  const colors = ["#f1be46", "#3bd6ff", "#f45ca4", "#5de38d", "#f7f7fb"];
  const pieces = [];
  const pieceCount = 160;
  let width = 0;
  let height = 0;
  let startTime = null;

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }

  resize();
  window.addEventListener("resize", resize, { passive: true });

  for (let index = 0; index < pieceCount; index += 1) {
    pieces.push({
      x: Math.random() * width,
      y: -20 - Math.random() * height * 0.45,
      size: 6 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      speed: 2.6 + Math.random() * 4.8,
      drift: -2 + Math.random() * 4,
      rotation: Math.random() * Math.PI,
      rotationSpeed: -0.12 + Math.random() * 0.24
    });
  }

  function drawFrame(timestamp) {
    if (startTime === null) {
      startTime = timestamp;
    }
    const elapsed = timestamp - startTime;
    context.clearRect(0, 0, width, height);

    pieces.forEach((piece) => {
      piece.x += piece.drift;
      piece.y += piece.speed;
      piece.rotation += piece.rotationSpeed;

      context.save();
      context.translate(piece.x, piece.y);
      context.rotate(piece.rotation);
      context.fillStyle = piece.color;
      context.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * 0.58);
      context.restore();

      if (piece.y > height + 30) {
        piece.y = -20;
        piece.x = Math.random() * width;
      }
    });

    if (elapsed < 4200) {
      requestAnimationFrame(drawFrame);
      return;
    }

    window.removeEventListener("resize", resize);
    canvas.remove();
  }

  requestAnimationFrame(drawFrame);
}

function getCurrentQuestion() {
  return state.quiz.questions[state.questionIndex];
}

function getLadderValues() {
  const custom = Array.isArray(state.quiz?.moneyLadder) ? state.quiz.moneyLadder : [];
  const values = custom.length ? custom : DEFAULT_LADDER;
  return values.slice(0, state.quiz?.questions.length || values.length);
}

function getGuaranteedPrizeIndex() {
  if (state.winningsIndex < 0) return -1;

  return [...SAFE_STEPS]
    .map((step) => step - 1)
    .filter((index) => index <= state.winningsIndex)
    .sort((a, b) => b - a)[0] ?? -1;
}

init();
