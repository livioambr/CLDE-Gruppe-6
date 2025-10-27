// game.js
// Wörterliste
const words = [
    'JAVASCRIPT', 'PROGRAMMIEREN', 'COMPUTER', 'INTERNET', 'ENTWICKLER',
    'AMAZON', 'CLOUD', 'SERVER', 'DATABASE', 'SOFTWARE',
    'ALGORITHMUS', 'FUNKTION', 'VARIABLE', 'SCHNITTSTELLE', 'FRAMEWORK',
    'MICROSERVICE', 'KUBERNETES', 'CONTAINER', 'DEPLOYMENT', 'SICHERHEIT'
];

// DOM Elemente
const canvas = document.getElementById('hangmanCanvas');
const ctx = canvas.getContext('2d');
const wordDisplay = document.getElementById('wordDisplay');
const lettersContainer = document.getElementById('lettersContainer');
const messageElement = document.getElementById('message');
const livesElement = document.getElementById('lives');
const resetBtn = document.getElementById('resetBtn');

// Spielvariablen
let selectedWord = '';
let guessedLetters = [];
let wrongGuesses = 0;
const maxWrongGuesses = 6;
let gameOver = false;

// Buchstabenbuttons erstellen
function createLetterButtons() {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    lettersContainer.innerHTML = '';

    for (let letter of alphabet) {
        const btn = document.createElement('button');
        btn.className = 'letter-btn';
        btn.textContent = letter;
        btn.addEventListener('click', () => handleLetterClick(letter, btn));
        lettersContainer.appendChild(btn);
    }
}

// Buchstabenklick
function handleLetterClick(letter, btn) {
    if (gameOver || btn.disabled) return;

    btn.disabled = true;
    guessedLetters.push(letter);

    if (selectedWord.includes(letter)) {
        btn.classList.add('correct');
        updateWordDisplay();
        checkWin();
    } else {
        btn.classList.add('wrong');
        wrongGuesses++;
        updateLives();
        drawHangman();
        checkLose();
    }
}

// Wortanzeige aktualisieren
function updateWordDisplay() {
    const display = selectedWord
        .split('')
        .map(letter => guessedLetters.includes(letter) ? letter : '_')
        .join(' ');
    wordDisplay.textContent = display;
}

// Leben aktualisieren
function updateLives() {
    livesElement.textContent = maxWrongGuesses - wrongGuesses;
}

// Canvas leeren
function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// Hangman zeichnen
function drawHangman() {
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    switch (wrongGuesses) {
        case 1: // Galgen Basis
            ctx.beginPath();
            ctx.moveTo(20, 280);
            ctx.lineTo(180, 280);
            ctx.stroke();
            break;
        case 2: // Vertikaler Balken
            ctx.beginPath();
            ctx.moveTo(50, 280);
            ctx.lineTo(50, 20);
            ctx.stroke();
            break;
        case 3: // Horizontaler Balken
            ctx.beginPath();
            ctx.moveTo(50, 20);
            ctx.lineTo(150, 20);
            ctx.stroke();
            break;
        case 4: // Seil
            ctx.beginPath();
            ctx.moveTo(150, 20);
            ctx.lineTo(150, 50);
            ctx.stroke();
            break;
        case 5: // Kopf
            ctx.beginPath();
            ctx.arc(150, 70, 20, 0, Math.PI * 2);
            ctx.stroke();
            break;
        case 6: // Körper, Arme und Beine
            // Körper
            ctx.beginPath();
            ctx.moveTo(150, 90);
            ctx.lineTo(150, 150);
            ctx.stroke();
            // Arme
            ctx.beginPath();
            ctx.moveTo(150, 110);
            ctx.lineTo(120, 130);
            ctx.moveTo(150, 110);
            ctx.lineTo(180, 130);
            ctx.stroke();
            // Beine
            ctx.beginPath();
            ctx.moveTo(150, 150);
            ctx.lineTo(120, 190);
            ctx.moveTo(150, 150);
            ctx.lineTo(180, 190);
            ctx.stroke();
            break;
    }
}

// Gewinn prüfen
function checkWin() {
    const won = selectedWord.split('').every(letter => guessedLetters.includes(letter));
    if (won) {
        gameOver = true;
        messageElement.textContent = '🎉 Glückwunsch! Du hast gewonnen!';
        messageElement.className = 'message win';
    }
}

// Verlust prüfen
function checkLose() {
    if (wrongGuesses >= maxWrongGuesses) {
        gameOver = true;
        messageElement.textContent = '😢 Schade! Versuche es erneut!';
        messageElement.className = 'message lose';

        // Alle Buchstaben anzeigen
        selectedWord.split('').forEach(letter => {
            if (!guessedLetters.includes(letter)) guessedLetters.push(letter);
        });
        updateWordDisplay();
    }
}

// Spiel initialisieren
function initGame() {
    selectedWord = words[Math.floor(Math.random() * words.length)];
    guessedLetters = [];
    wrongGuesses = 0;
    gameOver = false;

    clearCanvas();
    createLetterButtons();
    updateWordDisplay();
    updateLives();

    messageElement.textContent = '';
    messageElement.className = 'message';
}

// Event Listener
resetBtn.addEventListener('click', initGame);

// Spiel starten
initGame();

// --- Chat Setup ---
const chatMessages = document.getElementById("chat-messages");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");

// --- LocalStorage laden ---
let chatHistory = JSON.parse(localStorage.getItem("chatHistory")) || [];

// Chatverlauf anzeigen
function renderChatHistory() {
    chatMessages.innerHTML = ""; // vorher leeren
    chatHistory.forEach(msg => addMessage(msg.user, msg.text, false));
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Nachrichten hinzufügen
function addMessage(user, text, save = true) {
    const div = document.createElement("div");
    div.classList.add("message");
    div.innerHTML = `<span class="user">${user}:</span> ${text}`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Optional speichern
    if (save) {
        chatHistory.push({ user, text });
        localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
    }
}

// --- WebSocket einrichten ---
const socket = new WebSocket("ws://localhost:8080"); // <-- Server anpassen

socket.addEventListener("open", () => {
    console.log("WebSocket verbunden!");
});

// Nachrichten vom Server empfangen
socket.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    addMessage(data.user, data.text);
});

// Nachricht senden
chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;

    const message = { user: "Spieler", text };

    // 1. Sofort anzeigen
    addMessage(message.user, message.text);

    // 2. An Server senden
    socket.send(JSON.stringify(message));

    chatInput.value = "";
});

// Verlauf beim Laden rendern
renderChatHistory();
