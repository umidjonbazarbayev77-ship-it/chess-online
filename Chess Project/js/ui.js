/**
 * Chess UI controller: DOM binding, rendering, interaction, drag-and-drop, and game loop
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize dependencies
    const engine = new ChessEngine();

    // 2. Constants & Templates
    const PIECE_PATHS = {
        p: '<path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.93 3.84 2.38 5.03L15 36.5h15l-3.38-10.47C28.07 24.84 29 23.03 29 21c0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" />',
        r: '<path d="M15 11v4h15v-4H26v2.5h-2V11h-3v2.5h-2V11h-4zm0.5 6v3h14v-3h-14zm1.5 5l-2.5 12h19L30.5 22H17z" />',
        n: '<path d="M33,28.5 C33,28.5 35,24.5 31,21 C29,19.2 27.5,19.2 25,20 C23,20.6 21,20.6 19,19 C17.3,17.6 17.5,15.5 19,14 C20.3,12.7 22,12.5 24,13.5 C25.5,14.2 27,13.3 27,11.5 C27,9.5 24.5,8 21.5,8 C17,8 14.5,11 13.5,15 C12.5,19 12,22.5 14.5,25.5 C15.5,26.7 16,28.5 15,30 C13.5,32.2 12,34.5 15,36 C18,37.5 22.5,36.5 25.5,35.5 C28,34.7 30,34.7 31.5,33 C33,31.3 33,28.5 33,28.5 Z" />',
        b: '<path d="M22.5 8s-5 4-5 8.5c0 2.5 1.5 4.5 3.5 5.5v2.5c-3 1-5 3.5-5 6.5V36h13v-5c0-3-2-5.5-5-6.5v-2.5c2-1 3.5-3 3.5-5.5C27.5 12 22.5 8 22.5 8z" /><circle cx="22.5" cy="5.5" r="2" />',
        q: '<path d="M12.5 36h20l-1.5-12.5L37 15l-7.5 4.5L22.5 11l-7 8.5L8 15l6 8.5z" /><circle cx="8" cy="13" r="1.5" /><circle cx="15.5" cy="17" r="1.5" /><circle cx="22.5" cy="9" r="1.5" /><circle cx="29.5" cy="17" r="1.5" /><circle cx="37" cy="13" r="1.5" />',
        k: '<path d="M15 36h15v-3.5L25 29c3.5-2 4.5-5.5 4.5-8.5 0-5-3.5-8-7-8s-7 3-7 8c0 3 1 6.5 4.5 8.5l-5 3.5zm7.5-33v4.5H18v2h4.5v4.5h2V9.5H29v-2h-4.5V3z" />'
    };

    const PIECE_NAMES_UZ = {
        p: 'Piyoda', n: 'Ot', b: 'Fil', r: 'Rux', q: 'Farzin', k: 'Shoh'
    };

    // 3. State Management
    let gameMode = 'vs-pc'; // 'vs-pc' or 'vs-player'
    let activeTheme = 'glass';
    let timeControlSetting = 600; // Default 10 min in seconds
    let clockTimers = { w: 600, b: 600 };
    let clockInterval = null;
    let selectedSquareIdx = null;
    let possibleMoves = [];
    let pendingPromoMove = null; // Store {from, to} for promotion callback
    let isAiThinking = false;
    let incrementSetting = 0; // Increment in seconds

    // 4. DOM Elements
    const boardEl = document.getElementById('board');
    const wTimerEl = document.getElementById('white-timer');
    const bTimerEl = document.getElementById('black-timer');
    const wCardEl = document.getElementById('white-card');
    const bCardEl = document.getElementById('black-card');
    const wCapturedEl = document.getElementById('white-captured');
    const bCapturedEl = document.getElementById('black-captured');
    const wAdvantageEl = document.getElementById('white-advantage');
    const bAdvantageEl = document.getElementById('black-advantage');
    const historyBodyEl = document.getElementById('history-body');
    const statusBadgeEl = document.getElementById('status-badge');

    // Select elements
    const modeSelect = document.getElementById('game-mode-select');
    const timeSelect = document.getElementById('time-limit-select');
    const themeSelect = document.getElementById('theme-select');

    // Buttons
    const btnUndo = document.getElementById('btn-undo');
    const btnReset = document.getElementById('btn-reset');

    // Modals
    const modalOverlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalDesc = document.getElementById('modal-desc');
    const modalActionBox = document.getElementById('modal-action-box');
    const promoOverlay = document.getElementById('promo-overlay');
    const promoOptionsBox = document.getElementById('promo-options');
    const customTimeOverlay = document.getElementById('custom-time-overlay');
    const inputMinutes = document.getElementById('input-minutes');
    const inputIncrement = document.getElementById('input-increment');
    const btnCustomTimeCancel = document.getElementById('btn-custom-time-cancel');
    const btnCustomTimeSave = document.getElementById('btn-custom-time-save');

    // 5. Initialize Chess Board Grid
    function createBoardDOM() {
        boardEl.innerHTML = '';
        for (let idx = 0; idx < 64; idx++) {
            const row = Math.floor(idx / 8);
            const col = idx % 8;
            const isLight = (row + col) % 2 === 0;

            const sq = document.createElement('div');
            sq.className = `square ${isLight ? 'light' : 'dark'}`;
            sq.dataset.index = idx;

            // Add grid coordinates labels on edges
            if (col === 0) {
                const label = document.createElement('span');
                label.className = 'coordinate row';
                label.innerText = 8 - row;
                sq.appendChild(label);
            }
            if (row === 7) {
                const label = document.createElement('span');
                label.className = 'coordinate col';
                label.innerText = String.fromCharCode(97 + col);
                sq.appendChild(label);
            }

            // Drag-and-drop bindings
            sq.addEventListener('dragover', handleDragOver);
            sq.addEventListener('drop', handleDrop);
            sq.addEventListener('click', handleSquareClick);

            boardEl.appendChild(sq);
        }
    }

    // 6. Rendering functions
    function render() {
        const board = engine.board;

        // Clear square piece contents but preserve coordinates
        const squares = boardEl.querySelectorAll('.square');
        squares.forEach((sq, idx) => {
            // Remove previous piece element, dots, rings
            const pieceEl = sq.querySelector('.piece');
            if (pieceEl) pieceEl.remove();

            const dotEl = sq.querySelector('.move-dot');
            if (dotEl) dotEl.remove();

            const ringEl = sq.querySelector('.capture-ring');
            if (ringEl) ringEl.remove();

            // Clear special highlights
            sq.classList.remove('selected', 'last-move', 'check');

            // Draw new piece if exists
            const piece = board[idx];
            if (piece) {
                const div = document.createElement('div');
                div.className = `piece ${piece.color === 'w' ? 'white' : 'black'}`;
                div.draggable = true;

                // Render vector SVG
                div.innerHTML = `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg">${PIECE_PATHS[piece.type]}</svg>`;

                // Set dataset info
                div.dataset.index = idx;

                // Drag bindings
                div.addEventListener('dragstart', handleDragStart);
                div.addEventListener('dragend', handleDragEnd);

                sq.appendChild(div);
            }
        });

        // 6a. Highlight last move if present
        if (engine.history.length > 0) {
            const lastState = engine.history[engine.history.length - 1];
            const lm = lastState.lastMove;
            if (lm) {
                const fromSq = boardEl.querySelector(`.square[data-index="${lm.from}"]`);
                const toSq = boardEl.querySelector(`.square[data-index="${lm.to}"]`);
                if (fromSq) fromSq.classList.add('last-move');
                if (toSq) toSq.classList.add('last-move');
            }
        }

        // 6b. Highlight check state
        if (engine.isInCheck('w')) {
            const kIdx = engine.findKing('w');
            const sq = boardEl.querySelector(`.square[data-index="${kIdx}"]`);
            if (sq) sq.classList.add('check');
        } else if (engine.isInCheck('b')) {
            const kIdx = engine.findKing('b');
            const sq = boardEl.querySelector(`.square[data-index="${kIdx}"]`);
            if (sq) sq.classList.add('check');
        }

        // 6c. Refresh extra panels
        updateTurnHighlight();
        renderCaptured();
        renderHistory();
        updateGameStatus();
    }

    // Displays legal move dots and rings on clicked piece representation
    function highlightPossibleMoves() {
        // Clear previous overlays
        const dots = boardEl.querySelectorAll('.move-dot, .capture-ring');
        dots.forEach(el => el.remove());

        // Highlight selected
        const squares = boardEl.querySelectorAll('.square');
        squares.forEach(sq => sq.classList.remove('selected'));

        if (selectedSquareIdx === null) return;

        const selSq = boardEl.querySelector(`.square[data-index="${selectedSquareIdx}"]`);
        if (selSq) selSq.classList.add('selected');

        // Draw targets
        possibleMoves.forEach(move => {
            const targetSq = boardEl.querySelector(`.square[data-index="${move.to}"]`);
            if (!targetSq) return;

            const containsPiece = engine.board[move.to] !== null;

            if (containsPiece) {
                // Enemy exists: draw red capture overlay ring
                const ring = document.createElement('div');
                ring.className = 'capture-ring';
                targetSq.appendChild(ring);
            } else {
                // Empty square: draw standard centering dot
                const dot = document.createElement('div');
                dot.className = 'move-dot';
                targetSq.appendChild(dot);
            }
        });
    }

    function updateTurnHighlight() {
        if (engine.turn === 'w') {
            wCardEl.classList.add('active');
            bCardEl.classList.remove('active');
        } else {
            bCardEl.classList.add('active');
            wCardEl.classList.remove('active');
        }
    }

    // Captured pieces unicode representation mapping for visual list
    const PIECE_UNICODE = {
        p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚'
    };

    function renderCaptured() {
        wCapturedEl.innerHTML = '';
        bCapturedEl.innerHTML = '';

        // White captures contain pieces of black team taken
        const wCap = engine.capturedPieces.w;
        const bCap = engine.capturedPieces.b;

        wCap.forEach(type => {
            const el = document.createElement('span');
            el.className = 'captured-piece';
            el.innerHTML = PIECE_UNICODE[type];
            wCapturedEl.appendChild(el);
        });

        bCap.forEach(type => {
            const el = document.createElement('span');
            el.className = 'captured-piece';
            el.innerHTML = PIECE_UNICODE[type];
            bCapturedEl.appendChild(el);
        });

        // Compute material advantage differentials
        const values = { p: 1, n: 3, b: 3, r: 5, q: 9 };
        let wScore = wCap.reduce((sum, type) => sum + (values[type] || 0), 0);
        let bScore = bCap.reduce((sum, type) => sum + (values[type] || 0), 0);

        wAdvantageEl.innerText = '';
        wAdvantageEl.style.display = 'none';
        bAdvantageEl.innerText = '';
        bAdvantageEl.style.display = 'none';

        if (wScore > bScore) {
            wAdvantageEl.innerText = `+${wScore - bScore}`;
            wAdvantageEl.style.display = 'inline-block';
        } else if (bScore > wScore) {
            bAdvantageEl.innerText = `+${bScore - wScore}`;
            bAdvantageEl.style.display = 'inline-block';
        }
    }

    function renderHistory() {
        historyBodyEl.innerHTML = '';
        let rowEl = null;

        // Group moves into pairs (White move, Black move)
        engine.history.forEach((state, i) => {
            const move = state.lastMove;
            if (!move) return;

            const isWhite = state.turn === 'b'; // The state of turn flipped after move was completed
            const moveNum = Math.floor(i / 2) + 1;

            if (isWhite) {
                // White initiates a new table row
                rowEl = document.createElement('tr');

                const idxTd = document.createElement('td');
                idxTd.className = 'move-index';
                idxTd.innerText = `${moveNum}.`;
                rowEl.appendChild(idxTd);

                const whiteTd = document.createElement('td');
                whiteTd.className = 'move-algebraic';
                whiteTd.innerText = getAlgebraicString(move);
                rowEl.appendChild(whiteTd);

                // Placeholder for black move
                const blackTd = document.createElement('td');
                blackTd.className = 'move-algebraic';
                blackTd.innerText = '...';
                rowEl.appendChild(blackTd);

                historyBodyEl.appendChild(rowEl);
            } else {
                // Black move completes the row
                if (rowEl) {
                    const blackTd = rowEl.querySelectorAll('.move-algebraic')[1];
                    if (blackTd) {
                        blackTd.innerText = getAlgebraicString(move);
                    }
                }
            }
        });

        // Multi-page auto-scrolling
        const scrollBox = historyBodyEl.closest('.history-scroll');
        if (scrollBox) {
            scrollBox.scrollTop = scrollBox.scrollHeight;
        }
    }

    function getAlgebraicString(move) {
        const piece = engine.board[move.to]; // Made move
        if (!piece) return '';

        const typeChar = piece.type === 'p' ? '' : piece.type.toUpperCase();
        const dest = ChessEngine.indexToAlgebraic(move.to);
        const capture = (move.flag === 'capture' || move.flag === 'promotion-capture' || move.flag === 'en-passant') ? 'x' : '';

        if (move.flag === 'castle-kingside') return 'O-O';
        if (move.flag === 'castle-queenside') return 'O-O-O';

        let str = `${typeChar}${capture}${dest}`;
        if (move.promotion) {
            str += `=${move.promotion.toUpperCase()}`;
        }
        return str;
    }

    function updateGameStatus() {
        const isOver = engine.isGameOver();
        if (isOver) {
            stopClock();
            if (isOver.type === 'checkmate') {
                statusBadgeEl.innerText = `Mot! ${isOver.winner === 'w' ? 'Oq' : 'Qora'} g'olib`;
                showModalOverlay(
                    `Mot! O'yin tugadi`,
                    `${isOver.winner === 'w' ? 'Oq figuralar' : 'Qora figuralar'} raqib shohini mot qildi va g'alaba qozondi!`,
                    isOver.winner
                );
                if (window.sounds) window.sounds.playGameOver(gameMode === 'vs-pc' ? (isOver.winner === 'w') : true);
            } else if (isOver.type === 'stalemate') {
                statusBadgeEl.innerText = 'Pat (Durang)';
                showModalOverlay('Pat (Durang)', `O'yinda pat holati yuz berdi. Hech kimda qonuniy yurish qolmadi.`);
                if (window.sounds) window.sounds.playGameOver(false);
            } else {
                statusBadgeEl.innerText = 'Durang';
                showModalOverlay('Durang', `O'yin durang bilan yakunlandi (insufficient material / 50 moves).`);
                if (window.sounds) window.sounds.playGameOver(false);
            }
        } else {
            const hasCheck = engine.isInCheck(engine.turn);
            if (hasCheck) {
                statusBadgeEl.innerText = 'SHOH!';
            } else {
                statusBadgeEl.innerText = engine.turn === 'w' ? 'Oqlar navbati' : 'Qoralar navbati';
            }
        }
    }

    // 7. Interactive user events
    let dragStartPos = null;

    function handleDragStart(e) {
        if (isAiThinking) {
            e.preventDefault();
            return;
        }

        const idx = parseInt(e.target.dataset.index);
        const piece = engine.getPieceAtIndex(idx);

        // Can only drag if it matches player's turn
        if (!piece || piece.color !== engine.turn) {
            e.preventDefault();
            return;
        }

        // Sound contextual validation
        if (window.sounds) window.sounds.init();

        dragStartPos = idx;
        e.target.classList.add('dragging');

        // Set drag visual ghost
        e.dataTransfer.effectAllowed = 'move';

        // Highlight possible moves
        selectedSquareIdx = idx;
        possibleMoves = engine.generateLegalMovesForPiece(idx);
        highlightPossibleMoves();
    }

    function handleDragEnd(e) {
        e.target.classList.remove('dragging');
        // Clear move dots slowly
        selectedSquareIdx = null;
        possibleMoves = [];
        highlightPossibleMoves();
        dragStartPos = null;
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    function handleDrop(e) {
        e.preventDefault();

        let targetSq = e.target.closest('.square');
        if (!targetSq || dragStartPos === null) return;

        const toIdx = parseInt(targetSq.dataset.index);
        processMove(dragStartPos, toIdx);
    }

    function handleSquareClick(e) {
        if (isAiThinking) return;

        // Initialize audio
        if (window.sounds) window.sounds.init();

        const targetSq = e.target.closest('.square');
        if (!targetSq) return;

        const clickedIdx = parseInt(targetSq.dataset.index);
        const piece = engine.getPieceAtIndex(clickedIdx);

        // Click options:
        // 1. If clicking a legal target, perform move
        const possible = possibleMoves.find(m => m.to === clickedIdx);
        if (possible) {
            processMove(selectedSquareIdx, clickedIdx);
            return;
        }

        // 2. Select dynamic pieces for active team
        if (piece && piece.color === engine.turn) {
            selectedSquareIdx = clickedIdx;
            possibleMoves = engine.generateLegalMovesForPiece(clickedIdx);
            highlightPossibleMoves();
        } else {
            // Un-select click
            selectedSquareIdx = null;
            possibleMoves = [];
            highlightPossibleMoves();
        }
    }

    function processMove(fromIdx, toIdx) {
        // Find if legal
        const moves = engine.generateLegalMovesForPiece(fromIdx);
        const matched = moves.find(m => m.to === toIdx);

        if (!matched) return;

        // Pawn promotion verification
        const piece = engine.board[fromIdx];
        const isPawn = piece && piece.type === 'p';
        const promotionRow = piece.color === 'w' ? 0 : 7;
        const targetRow = Math.floor(toIdx / 8);

        if (isPawn && targetRow === promotionRow) {
            // Triggers promotion selection modal
            pendingPromoMove = { from: fromIdx, to: toIdx };

            if (gameMode === 'vs-pc' && engine.turn === 'b') {
                // AI automatically promotes to queen
                completeMove(fromIdx, toIdx, 'q');
            } else {
                showPromoOverlay(piece.color);
            }
        } else {
            completeMove(fromIdx, toIdx);
        }
    }

    function completeMove(fromIdx, toIdx, promotion = 'q') {
        const piece = engine.board[fromIdx];
        const targetPiece = engine.board[toIdx];
        const hasCapture = targetPiece !== null || (engine.enPassant === toIdx && piece.type === 'p');

        const moveDone = engine.makeMove(fromIdx, toIdx, promotion);

        if (moveDone) {
            // Add increment to the player who just moved
            const justMovedColor = engine.turn === 'w' ? 'b' : 'w'; // Turn has toggled in engine
            clockTimers[justMovedColor] += incrementSetting;
            updateTimerDisplay();

            // Trigger audio plucks
            if (window.sounds) {
                if (engine.isInCheck(engine.turn)) {
                    window.sounds.playCheck();
                } else if (hasCapture) {
                    window.sounds.playCapture();
                } else {
                    window.sounds.playMove();
                }
            }

            render();

            // Clear visual move dots
            selectedSquareIdx = null;
            possibleMoves = [];
            highlightPossibleMoves();

            // Activate countdown timer toggle
            ensureClockRunning();

            // AI invocation
            if (gameMode === 'vs-pc' && engine.turn === 'b' && !engine.isGameOver()) {
                triggerAiMove();
            }
        }
    }

    function triggerAiMove() {
        isAiThinking = true;
        statusBadgeEl.innerText = 'Kompyuter o\'ylamoqda...';
        btnUndo.disabled = true;
        btnReset.disabled = true;

        // Non-blocking loop offset
        setTimeout(() => {
            const aiMove = engine.getBestMove();
            isAiThinking = false;
            btnUndo.disabled = false;
            btnReset.disabled = false;

            if (aiMove) {
                const targetPiece = engine.board[aiMove.to];
                const hasCapture = targetPiece !== null || (engine.enPassant === aiMove.to && engine.board[aiMove.from]?.type === 'p');

                const virtualDone = engine.makeMove(aiMove.from, aiMove.to, aiMove.promotion || 'q');
                if (virtualDone) {
                    // Add increment to AI (black)
                    clockTimers.b += incrementSetting;
                    updateTimerDisplay();

                    if (window.sounds) {
                        if (engine.isInCheck(engine.turn)) {
                            window.sounds.playCheck();
                        } else if (hasCapture) {
                            window.sounds.playCapture();
                        } else {
                            window.sounds.playMove();
                        }
                    }
                    render();
                    ensureClockRunning();
                }
            }
        }, 300);
    }

    // 8. Timers & Clocks System
    function ensureClockRunning() {
        if (!clockInterval && !engine.isGameOver()) {
            clockInterval = setInterval(tickClock, 1000);
        }
    }

    function stopClock() {
        if (clockInterval) {
            clearInterval(clockInterval);
            clockInterval = null;
        }
    }

    function tickClock() {
        const activeColor = engine.turn;
        clockTimers[activeColor]--;

        // Sync visual formats
        updateTimerDisplay();

        // Flag timeout checks
        if (clockTimers[activeColor] <= 0) {
            stopClock();
            const loser = activeColor;
            statusBadgeEl.innerText = `Vaqt tugadi! ${loser === 'w' ? 'Qora' : 'Oq'} g'olib`;
            showModalOverlay(
                'Vaqt tugadi!',
                `${loser === 'w' ? 'Oq figuralar' : 'Qora figuralar'} o'yin vaqtini tugatdi. Raqib g'alaba qozondi!`,
                loser === 'w' ? 'b' : 'w'
            );
            if (window.sounds) window.sounds.playGameOver(gameMode === 'vs-pc' ? (loser === 'b') : true);
        }
    }

    function updateTimerDisplay() {
        wTimerEl.innerText = formatTime(clockTimers.w);
        bTimerEl.innerText = formatTime(clockTimers.b);

        // Low time alarm indicator (< 30 seconds)
        if (clockTimers.w < 30) wTimerEl.style.color = '#ef4444';
        else wTimerEl.style.color = '';

        if (clockTimers.b < 30) bTimerEl.style.color = '#ef4444';
        else bTimerEl.style.color = '';
    }

    function formatTime(seconds) {
        if (seconds < 0) seconds = 0;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    function resetTimers() {
        stopClock();
        clockTimers.w = timeControlSetting;
        clockTimers.b = timeControlSetting;
        updateTimerDisplay();
    }

    // 9. Modal Control Utilities
    function showModalOverlay(title, desc, winnerColor = null) {
        modalTitle.innerText = title;
        modalDesc.innerText = desc;
        modalActionBox.innerHTML = '';

        const replayBtn = document.createElement('button');
        replayBtn.className = 'btn btn-primary';
        replayBtn.innerText = 'Qayta boshlash';
        replayBtn.style.margin = '0 auto';
        replayBtn.addEventListener('click', () => {
            hideModalOverlay();
            startNewGame();
        });
        modalActionBox.appendChild(replayBtn);

        modalOverlay.classList.add('show');
    }

    function hideModalOverlay() {
        modalOverlay.classList.remove('show');
    }

    // 10. Promotion choices modal overlay
    const PROMO_PIECES = ['q', 'r', 'b', 'n'];

    function showPromoOverlay(color) {
        promoOptionsBox.innerHTML = '';
        PROMO_PIECES.forEach(type => {
            const btn = document.createElement('div');
            btn.className = 'promo-btn';

            // Set piece visual inline
            btn.innerHTML = `<svg viewBox="0 0 45 45" class="piece ${color === 'w' ? 'white' : 'black'}" xmlns="http://www.w3.org/2000/svg">${PIECE_PATHS[type]}</svg>`;

            btn.addEventListener('click', () => {
                promoOverlay.classList.remove('show');
                if (pendingPromoMove) {
                    completeMove(pendingPromoMove.from, pendingPromoMove.to, type);
                    pendingPromoMove = null;
                }
            });
            promoOptionsBox.appendChild(btn);
        });

        promoOverlay.classList.add('show');
    }

    // 11. Initial starting configuration handlers
    function startNewGame() {
        engine.reset();
        selectedSquareIdx = null;
        possibleMoves = [];
        pendingPromoMove = null;
        resetTimers();
        createBoardDOM();
        render();
        if (window.sounds) window.sounds.playStart();
    }

    // Bind configuration events
    modeSelect.addEventListener('change', (e) => {
        gameMode = e.target.value;
        startNewGame();
    });

    timeSelect.addEventListener('change', (e) => {
        if (e.target.value === 'custom') {
            customTimeOverlay.classList.add('show');
        } else {
            timeControlSetting = parseInt(e.target.value);
            incrementSetting = 0;
            startNewGame();
        }
    });

    btnCustomTimeCancel.addEventListener('click', () => {
        customTimeOverlay.classList.remove('show');
        // Revert dropdown value to reflect active timers
        if (timeControlSetting === 180 && incrementSetting === 0) timeSelect.value = '180';
        else if (timeControlSetting === 600 && incrementSetting === 0) timeSelect.value = '600';
        else if (timeControlSetting === 1800 && incrementSetting === 0) timeSelect.value = '1800';
        else timeSelect.value = 'custom';
    });

    btnCustomTimeSave.addEventListener('click', () => {
        const mins = parseInt(inputMinutes.value) || 10;
        const inc = parseInt(inputIncrement.value) || 0;

        timeControlSetting = mins * 60;
        incrementSetting = inc;

        customTimeOverlay.classList.remove('show');
        startNewGame();
    });

    themeSelect.addEventListener('change', (e) => {
        activeTheme = e.target.value;
        document.body.setAttribute('data-theme', activeTheme);
    });

    btnReset.addEventListener('click', startNewGame);

    btnUndo.addEventListener('click', () => {
        if (isAiThinking) return;

        // Undo twice if vs AI, or once if vs player
        let success = engine.undo();
        if (gameMode === 'vs-pc' && success) {
            success = engine.undo(); // Undo white user's move as well
        }

        if (success) {
            render();
            // Recount active clock timings (simply reset back clocks to standard settings or keep current)
            // Just running render is enough, clocks will tick down from where they were when history restored
            highlightPossibleMoves();
            if (window.sounds) window.sounds.playMove();
        }
    });

    // 12. Run-time Start
    startNewGame();
});
