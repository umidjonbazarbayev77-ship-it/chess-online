/**
 * Pure Chess Engine with full rules implementation & Minimax AI
 */
class ChessEngine {
    constructor() {
        this.board = Array(64).fill(null);
        this.turn = 'w'; // 'w' or 'b'
        this.castlingRights = {
            wK: true, // white kingside
            wQ: true, // white queenside
            bK: true, // black kingside
            bQ: true  // black queenside
        };
        this.enPassant = null; // square index of EP target
        this.halfMoveClock = 0;
        this.fullMoveNumber = 1;
        this.history = []; // stack of old states (board, turn, enPassant, castlingRights, halfMoveClock, fullMoveNumber, lastMove)
        this.capturedPieces = { w: [], b: [] }; // Track captures
        this.reset();
    }

    reset() {
        this.board = Array(64).fill(null);
        this.turn = 'w';
        this.castlingRights = { wK: true, wQ: true, bK: true, bQ: true };
        this.enPassant = null;
        this.halfMoveClock = 0;
        this.fullMoveNumber = 1;
        this.history = [];
        this.capturedPieces = { w: [], b: [] };

        // Set up pieces
        // Black pieces (rows 0 and 1)
        const blackOrder = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
        for (let col = 0; col < 8; col++) {
            this.board[col] = { type: blackOrder[col], color: 'b' };
            this.board[8 + col] = { type: 'p', color: 'b' };
        }

        // Empty squares are already null (rows 2 to 5)

        // White pieces (rows 6 and 7)
        for (let col = 0; col < 8; col++) {
            this.board[48 + col] = { type: 'p', color: 'w' };
            this.board[56 + col] = { type: blackOrder[col], color: 'w' };
        }
    }

    getPiece(row, col) {
        if (row < 0 || row > 7 || col < 0 || col > 7) return null;
        return this.board[row * 8 + col];
    }

    getPieceAtIndex(idx) {
        if (idx < 0 || idx > 63) return null;
        return this.board[idx];
    }

    cloneBoard() {
        return this.board.map(p => p ? { ...p } : null);
    }

    saveState(lastMove = null) {
        this.history.push({
            board: this.cloneBoard(),
            turn: this.turn,
            castlingRights: { ...this.castlingRights },
            enPassant: this.enPassant,
            halfMoveClock: this.halfMoveClock,
            fullMoveNumber: this.fullMoveNumber,
            capturedPieces: {
                w: [...this.capturedPieces.w],
                b: [...this.capturedPieces.b]
            },
            lastMove: lastMove
        });
    }

    restoreState() {
        if (this.history.length === 0) return false;
        const prev = this.history.pop();
        this.board = prev.board;
        this.turn = prev.turn;
        this.castlingRights = prev.castlingRights;
        this.enPassant = prev.enPassant;
        this.halfMoveClock = prev.halfMoveClock;
        this.fullMoveNumber = prev.fullMoveNumber;
        this.capturedPieces = prev.capturedPieces;
        return true;
    }

    undo() {
        if (this.history.length === 0) return false;
        // Undo two states if vs AI, or one if vs player
        const undone = this.restoreState();
        return undone;
    }

    isOpponentPiece(piece, color) {
        return piece !== null && piece.color !== color;
    }

    isEmptyOrOpponent(idx, color) {
        const piece = this.board[idx];
        return piece === null || piece.color !== color;
    }

    // High performance check: is this square attacked by opponent of 'color'
    isSquareAttacked(squareIdx, attackerColor) {
        const row = Math.floor(squareIdx / 8);
        const col = squareIdx % 8;

        // 1. Pawn attacks
        const pawnDir = attackerColor === 'w' ? 1 : -1; // Pawns move forward, so attackers come from opposite direction
        const attackPawnRows = [row + pawnDir];
        const attackPawnCols = [col - 1, col + 1];
        for (const c of attackPawnCols) {
            if (c >= 0 && c <= 7) {
                const r = attackPawnRows[0];
                if (r >= 0 && r <= 7) {
                    const piece = this.board[r * 8 + c];
                    if (piece && piece.type === 'p' && piece.color === attackerColor) {
                        return true;
                    }
                }
            }
        }

        // 2. Knight attacks
        const knightMoves = [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1]
        ];
        for (const [dr, dc] of knightMoves) {
            const r = row + dr;
            const c = col + dc;
            if (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
                const piece = this.board[r * 8 + c];
                if (piece && piece.type === 'n' && piece.color === attackerColor) {
                    return true;
                }
            }
        }

        // 3. Sliding Attacks: Rook / Queen (Straight)
        const straightDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of straightDirs) {
            let r = row + dr;
            let c = col + dc;
            while (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
                const piece = this.board[r * 8 + c];
                if (piece) {
                    if (piece.color === attackerColor && (piece.type === 'r' || piece.type === 'q')) {
                        return true;
                    }
                    break; // Blocked
                }
                r += dr;
                c += dc;
            }
        }

        // 4. Sliding Attacks: Bishop / Queen (Diagonal)
        const diagDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        for (const [dr, dc] of diagDirs) {
            let r = row + dr;
            let c = col + dc;
            while (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
                const piece = this.board[r * 8 + c];
                if (piece) {
                    if (piece.color === attackerColor && (piece.type === 'b' || piece.type === 'q')) {
                        return true;
                    }
                    break; // Blocked
                }
                r += dr;
                c += dc;
            }
        }

        // 5. King attacks (to prevent opposing kings touching)
        const kingDirs = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1], [0, 1],
            [1, -1], [1, 0], [1, 1]
        ];
        for (const [dr, dc] of kingDirs) {
            const r = row + dr;
            const c = col + dc;
            if (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
                const piece = this.board[r * 8 + c];
                if (piece && piece.type === 'k' && piece.color === attackerColor) {
                    return true;
                }
            }
        }

        return false;
    }

    findKing(color) {
        for (let i = 0; i < 64; i++) {
            const piece = this.board[i];
            if (piece && piece.type === 'k' && piece.color === color) {
                return i;
            }
        }
        return -1;
    }

    isInCheck(color) {
        const kingIdx = this.findKing(color);
        if (kingIdx === -1) return false;
        return this.isSquareAttacked(kingIdx, color === 'w' ? 'b' : 'w');
    }

    // Generates moves for a specific piece ignoring self-checks
    generatePseudoLegalMoves(idx) {
        const moves = [];
        const piece = this.board[idx];
        if (!piece) return moves;

        const color = piece.color;
        const row = Math.floor(idx / 8);
        const col = idx % 8;

        switch (piece.type) {
            case 'p': { // Pawn
                const dir = color === 'w' ? -1 : 1;
                const startRow = color === 'w' ? 6 : 1;
                const promotionRow = color === 'w' ? 0 : 7;

                // 1 Square Forward
                const nextRow = row + dir;
                const nextIdx = nextRow * 8 + col;
                if (nextRow >= 0 && nextRow <= 7 && !this.board[nextIdx]) {
                    if (nextRow === promotionRow) {
                        ['q', 'r', 'b', 'n'].forEach(promo => {
                            moves.push({ from: idx, to: nextIdx, flag: 'promotion', promotion: promo });
                        });
                    } else {
                        moves.push({ from: idx, to: nextIdx, flag: 'normal' });
                    }

                    // 2 Squares Forward
                    const doubleRow = row + 2 * dir;
                    const doubleIdx = doubleRow * 8 + col;
                    if (row === startRow && !this.board[doubleIdx]) {
                        moves.push({ from: idx, to: doubleIdx, flag: 'double-push' });
                    }
                }

                // Captures
                const captureCols = [col - 1, col + 1];
                for (const c of captureCols) {
                    if (c >= 0 && c <= 7) {
                        const targetIdx = nextRow * 8 + c;
                        if (nextRow >= 0 && nextRow <= 7) {
                            const p = this.board[targetIdx];
                            if (p && p.color !== color) {
                                if (nextRow === promotionRow) {
                                    ['q', 'r', 'b', 'n'].forEach(promo => {
                                        moves.push({ from: idx, to: targetIdx, flag: 'promotion-capture', promotion: promo });
                                    });
                                } else {
                                    moves.push({ from: idx, to: targetIdx, flag: 'capture' });
                                }
                            }
                            // En Passant
                            if (targetIdx === this.enPassant) {
                                moves.push({ from: idx, to: targetIdx, flag: 'en-passant' });
                            }
                        }
                    }
                }
                break;
            }

            case 'n': { // Knight
                const knightMoves = [
                    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
                    [1, -2], [1, 2], [2, -1], [2, 1]
                ];
                for (const [dr, dc] of knightMoves) {
                    const r = row + dr;
                    const c = col + dc;
                    if (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
                        const targetIdx = r * 8 + c;
                        const targetPiece = this.board[targetIdx];
                        if (!targetPiece) {
                            moves.push({ from: idx, to: targetIdx, flag: 'normal' });
                        } else if (targetPiece.color !== color) {
                            moves.push({ from: idx, to: targetIdx, flag: 'capture' });
                        }
                    }
                }
                break;
            }

            case 'b': // Bishop
            case 'r': // Rook
            case 'q': { // Queen
                const directions = [];
                if (piece.type === 'b' || piece.type === 'q') {
                    directions.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
                }
                if (piece.type === 'r' || piece.type === 'q') {
                    directions.push([-1, 0], [1, 0], [0, -1], [0, 1]);
                }

                for (const [dr, dc] of directions) {
                    let r = row + dr;
                    let c = col + dc;
                    while (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
                        const targetIdx = r * 8 + c;
                        const targetPiece = this.board[targetIdx];
                        if (!targetPiece) {
                            moves.push({ from: idx, to: targetIdx, flag: 'normal' });
                        } else {
                            if (targetPiece.color !== color) {
                                moves.push({ from: idx, to: targetIdx, flag: 'capture' });
                            }
                            break; // Collided
                        }
                        r += dr;
                        c += dc;
                    }
                }
                break;
            }

            case 'k': { // King
                const kingMoves = [
                    [-1, -1], [-1, 0], [-1, 1],
                    [0, -1], [0, 1],
                    [1, -1], [1, 0], [1, 1]
                ];
                for (const [dr, dc] of kingMoves) {
                    const r = row + dr;
                    const c = col + dc;
                    if (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
                        const targetIdx = r * 8 + c;
                        const targetPiece = this.board[targetIdx];
                        if (!targetPiece) {
                            moves.push({ from: idx, to: targetIdx, flag: 'normal' });
                        } else if (targetPiece.color !== color) {
                            moves.push({ from: idx, to: targetIdx, flag: 'capture' });
                        }
                    }
                }

                // Castling
                if (color === 'w') {
                    // White Kingside Castling
                    if (this.castlingRights.wK && !this.board[61] && !this.board[62]) {
                        if (!this.isSquareAttacked(60, 'b') && !this.isSquareAttacked(61, 'b') && !this.isSquareAttacked(62, 'b')) {
                            moves.push({ from: idx, to: 62, flag: 'castle-kingside' });
                        }
                    }
                    // White Queenside Castling
                    if (this.castlingRights.wQ && !this.board[59] && !this.board[58] && !this.board[57]) {
                        if (!this.isSquareAttacked(60, 'b') && !this.isSquareAttacked(59, 'b') && !this.isSquareAttacked(58, 'b')) {
                            moves.push({ from: idx, to: 58, flag: 'castle-queenside' });
                        }
                    }
                } else {
                    // Black Kingside Castling
                    if (this.castlingRights.bK && !this.board[5] && !this.board[6]) {
                        if (!this.isSquareAttacked(4, 'w') && !this.isSquareAttacked(5, 'w') && !this.isSquareAttacked(6, 'w')) {
                            moves.push({ from: idx, to: 6, flag: 'castle-kingside' });
                        }
                    }
                    // Black Queenside Castling
                    if (this.castlingRights.bQ && !this.board[3] && !this.board[2] && !this.board[1]) {
                        if (!this.isSquareAttacked(4, 'w') && !this.isSquareAttacked(3, 'w') && !this.isSquareAttacked(2, 'w')) {
                            moves.push({ from: idx, to: 2, flag: 'castle-queenside' });
                        }
                    }
                }
                break;
            }
        }

        return moves;
    }

    // Filters pseudo-legal moves into fully validated legal moves
    generateLegalMovesForPiece(idx) {
        const pMoves = this.generatePseudoLegalMoves(idx);
        const lMoves = [];

        pMoves.forEach(move => {
            this.saveState();
            this.executeMove(move, true); // virtual move
            const kingInCheck = this.isInCheck(this.turn === 'w' ? 'b' : 'w'); // check if the person who moved is in check now
            this.restoreState();

            if (!kingInCheck) {
                lMoves.push(move);
            }
        });

        return lMoves;
    }

    // Generates all legal moves for active player
    generateAllLegalMoves(color = this.turn) {
        const moves = [];
        for (let i = 0; i < 64; i++) {
            const piece = this.board[i];
            if (piece && piece.color === color) {
                moves.push(...this.generateLegalMovesForPiece(i));
            }
        }
        return moves;
    }

    // Internal execution of piece moving on the board, updating state details
    executeMove(move, isVirtual = false) {
        const { from, to, flag, promotion } = move;
        const piece = this.board[from];
        const targetPiece = this.board[to];

        // 1. Reset EP target for next turn (can be reassigned if pawn double-push)
        this.enPassant = null;

        // 2. Perform Capture (Add to stats if not virtual)
        if (targetPiece) {
            if (!isVirtual) {
                this.capturedPieces[targetPiece.color === 'w' ? 'b' : 'w'].push(targetPiece.type);
            }
            this.halfMoveClock = 0;
        } else if (piece.type === 'p') {
            this.halfMoveClock = 0;
        } else {
            this.halfMoveClock++;
        }

        // 3. Apply moves based on flags
        if (flag === 'normal' || flag === 'capture') {
            this.board[to] = piece;
            this.board[from] = null;
        } else if (flag === 'double-push') {
            this.board[to] = piece;
            this.board[from] = null;
            // Setup EP target: the cell behind the pawn
            const dir = piece.color === 'w' ? 1 : -1;
            this.enPassant = to + (8 * dir);
        } else if (flag === 'en-passant') {
            const dir = piece.color === 'w' ? 1 : -1;
            const capturedPawnIdx = to + (8 * dir);
            const capturedPawn = this.board[capturedPawnIdx];
            if (!isVirtual && capturedPawn) {
                this.capturedPieces[capturedPawn.color === 'w' ? 'b' : 'w'].push(capturedPawn.type);
            }
            this.board[capturedPawnIdx] = null;
            this.board[to] = piece;
            this.board[from] = null;
        } else if (flag === 'promotion' || flag === 'promotion-capture') {
            const promoPiece = promotion || 'q'; // Default to Queen if omitted
            this.board[to] = { type: promoPiece, color: piece.color };
            this.board[from] = null;
        } else if (flag === 'castle-kingside') {
            // Move King (from e1/e8 to g1/g8)
            this.board[to] = piece;
            this.board[from] = null;
            // Move Rook (from h1/h8 to f1/f8)
            const rookFrom = from + 3;
            const rookTo = from + 1;
            this.board[rookTo] = this.board[rookFrom];
            this.board[rookFrom] = null;
        } else if (flag === 'castle-queenside') {
            // Move King (from e1/e8 to c1/c8)
            this.board[to] = piece;
            this.board[from] = null;
            // Move Rook (from a1/a8 to d1/d8)
            const rookFrom = from - 4;
            const rookTo = from - 1;
            this.board[rookTo] = this.board[rookFrom];
            this.board[rookFrom] = null;
        }

        // Update castling rights if King/Rook moved or was captured
        // Rook captures
        if (to === 56) this.castlingRights.wQ = false;
        if (to === 63) this.castlingRights.wK = false;
        if (to === 0) this.castlingRights.bQ = false;
        if (to === 7) this.castlingRights.bK = false;

        // Rook moves
        if (from === 56) this.castlingRights.wQ = false;
        if (from === 63) this.castlingRights.wK = false;
        if (from === 0) this.castlingRights.bQ = false;
        if (from === 7) this.castlingRights.bK = false;

        // King moves
        if (piece.type === 'k') {
            if (piece.color === 'w') {
                this.castlingRights.wK = false;
                this.castlingRights.wQ = false;
            } else {
                this.castlingRights.bK = false;
                this.castlingRights.bQ = false;
            }
        }

        // Toggle player turn
        this.turn = this.turn === 'w' ? 'b' : 'w';

        if (this.turn === 'w') {
            this.fullMoveNumber++;
        }
    }

    // Public method to execute a move from the UI
    makeMove(from, to, promotion = 'q') {
        const moves = this.generateLegalMovesForPiece(from);
        const matchedMove = moves.find(m => m.to === to && (!m.promotion || m.promotion === promotion));

        if (!matchedMove) return null;

        this.saveState(matchedMove);
        this.executeMove(matchedMove, false);

        return matchedMove;
    }

    isGameOver() {
        const moves = this.generateAllLegalMoves();
        if (moves.length === 0) {
            if (this.isInCheck(this.turn)) {
                return { type: 'checkmate', winner: this.turn === 'w' ? 'b' : 'w' };
            } else {
                return { type: 'stalemate' };
            }
        }
        if (this.halfMoveClock >= 100) { // 50-move rule (100 plies)
            return { type: 'draw-50-moves' };
        }
        if (this.isInsufficientMaterial()) {
            return { type: 'draw-insufficient' };
        }
        return null;
    }

    isInsufficientMaterial() {
        let whitePieces = [];
        let blackPieces = [];
        for (let i = 0; i < 64; i++) {
            const p = this.board[i];
            if (p) {
                if (p.color === 'w') whitePieces.push(p.type);
                else blackPieces.push(p.type);
            }
        }
        const wCount = whitePieces.length;
        const bCount = blackPieces.length;

        // King vs King
        if (wCount === 1 && bCount === 1) return true;

        // King & Bishop vs King or King & Knight vs King
        if (wCount === 2 && bCount === 1) {
            return whitePieces.includes('b') || whitePieces.includes('n');
        }
        if (bCount === 2 && wCount === 1) {
            return blackPieces.includes('b') || blackPieces.includes('n');
        }

        // King & Bishop vs King & Bishop (same color bishops)
        // Ignoring cell color matching for absolute simplicity, just basic counts are sufficient
        return false;
    }

    // HELPER: Convert board index to Algebraic String (e.g. 56 -> 'a1', 7 -> 'h8')
    static indexToAlgebraic(idx) {
        const row = 8 - Math.floor(idx / 8);
        const col = String.fromCharCode(97 + (idx % 8));
        return `${col}${row}`;
    }

    // --- AI IMPLEMENTATION (MINIMAX WITH PEICE-SQUARE TABLES) ---
    // Evaluation utility
    evaluateBoard() {
        // Values of pieces
        const values = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

        // Position multipliers (PST tables)
        const pTable = [
            0, 0, 0, 0, 0, 0, 0, 0,
            50, 50, 50, 50, 50, 50, 50, 50,
            10, 10, 20, 30, 30, 20, 10, 10,
            5, 5, 10, 25, 25, 10, 5, 5,
            0, 0, 0, 20, 20, 0, 0, 0,
            5, -5, -10, 0, 0, -10, -5, 5,
            5, 10, 10, -20, -20, 10, 10, 5,
            0, 0, 0, 0, 0, 0, 0, 0
        ];

        const nTable = [
            -50, -40, -30, -30, -30, -30, -40, -50,
            -40, -20, 0, 0, 0, 0, -20, -40,
            -30, 0, 10, 15, 15, 10, 0, -30,
            -30, 5, 15, 20, 20, 15, 5, -30,
            -30, 0, 15, 20, 20, 15, 0, -30,
            -30, 5, 10, 15, 15, 10, 5, -30,
            -40, -20, 0, 5, 5, 0, -20, -40,
            -50, -40, -30, -30, -30, -30, -40, -50,
        ];

        const bTable = [
            -20, -10, -10, -10, -10, -10, -10, -20,
            -10, 0, 0, 0, 0, 0, 0, -10,
            -10, 0, 5, 10, 10, 5, 0, -10,
            -10, 5, 5, 10, 10, 5, 5, -10,
            -10, 0, 10, 10, 10, 10, 0, -10,
            -10, 10, 10, 10, 10, 10, 10, -10,
            -10, 5, 0, 0, 0, 0, 5, -10,
            -20, -10, -10, -10, -10, -10, -10, -20,
        ];

        const rTable = [
            0, 0, 0, 0, 0, 0, 0, 0,
            5, 10, 10, 10, 10, 10, 10, 5,
            -5, 0, 0, 0, 0, 0, 0, -5,
            -5, 0, 0, 0, 0, 0, 0, -5,
            -5, 0, 0, 0, 0, 0, 0, -5,
            -5, 0, 0, 0, 0, 0, 0, -5,
            -5, 0, 0, 0, 0, 0, 0, -5,
            0, 0, 0, 5, 5, 5, 0, 0
        ];

        const qTable = [
            -20, -10, -10, -5, -5, -10, -10, -20,
            -10, 0, 0, 0, 0, 0, 0, -10,
            -10, 0, 5, 5, 5, 5, 0, -10,
            -5, 0, 5, 5, 5, 5, 0, -5,
            0, 0, 5, 5, 5, 5, 0, -5,
            -10, 5, 5, 5, 5, 5, 0, -10,
            -10, 0, 5, 0, 0, 5, 0, -10,
            -20, -10, -10, -5, -5, -10, -10, -20
        ];

        const kTableMid = [ // King safety/castling guidance
            -30, -40, -40, -50, -50, -40, -40, -30,
            -30, -40, -40, -50, -50, -40, -40, -30,
            -30, -40, -40, -50, -50, -40, -40, -30,
            -30, -40, -40, -50, -50, -40, -40, -30,
            -20, -30, -30, -40, -40, -30, -30, -20,
            -10, -20, -20, -20, -20, -20, -20, -10,
            20, 20, 0, 0, 0, 0, 20, 20,
            20, 30, 10, 0, 0, 10, 30, 20
        ];

        let score = 0;

        for (let i = 0; i < 64; i++) {
            const piece = this.board[i];
            if (!piece) continue;

            const type = piece.type;
            const color = piece.color;
            const sign = color === 'w' ? 1 : -1;

            let evalScore = values[type];

            // Positional table (reversing indices for black)
            const tableIdx = color === 'w' ? i : (63 - i);

            switch (type) {
                case 'p': evalScore += pTable[tableIdx]; break;
                case 'n': evalScore += nTable[tableIdx]; break;
                case 'b': evalScore += bTable[tableIdx]; break;
                case 'r': evalScore += rTable[tableIdx]; break;
                case 'q': evalScore += qTable[tableIdx]; break;
                case 'k': evalScore += kTableMid[tableIdx]; break;
            }

            score += evalScore * sign;
        }

        return score;
    }

    // Minimax search with Alpha-Beta Pruning
    minimax(depth, alpha, beta, isMaximizing) {
        if (depth === 0) {
            return this.evaluateBoard();
        }

        const moves = this.generateAllLegalMoves();
        if (moves.length === 0) {
            if (this.isInCheck(this.turn)) {
                // Checkmate. Positive for white win (+100000), negative for black win (-100000)
                return isMaximizing ? -250000 + (3 - depth) : 250000 - (3 - depth); // Prefer faster mates
            } else {
                return 0; // Stalemate
            }
        }

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const move of moves) {
                this.saveState();
                this.executeMove(move, true);
                const evaluation = this.minimax(depth - 1, alpha, beta, false);
                this.restoreState();
                maxEval = Math.max(maxEval, evaluation);
                alpha = Math.max(alpha, evaluation);
                if (beta <= alpha) break; // Pruning
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const move of moves) {
                this.saveState();
                this.executeMove(move, true);
                const evaluation = this.minimax(depth - 1, alpha, beta, true);
                this.restoreState();
                minEval = Math.min(minEval, evaluation);
                beta = Math.min(beta, evaluation);
                if (beta <= alpha) break; // Pruning
            }
            return minEval;
        }
    }

    // AI chooses the best legal move
    getBestMove(depth = 3) {
        const moves = this.generateAllLegalMoves();
        if (moves.length === 0) return null;

        // Shuffle moves to add variety
        moves.sort(() => Math.random() - 0.5);

        let bestMove = null;
        const isMaximizing = this.turn === 'w';

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const move of moves) {
                this.saveState();
                this.executeMove(move, true);
                const evaluation = this.minimax(depth - 1, -Infinity, Infinity, false);
                this.restoreState();

                if (evaluation > maxEval) {
                    maxEval = evaluation;
                    bestMove = move;
                }
            }
        } else {
            let minEval = Infinity;
            for (const move of moves) {
                this.saveState();
                this.executeMove(move, true);
                const evaluation = this.minimax(depth - 1, -Infinity, Infinity, true);
                this.restoreState();

                if (evaluation < minEval) {
                    minEval = evaluation;
                    bestMove = move;
                }
            }
        }

        return bestMove;
    }
}

// Export as globally available
window.ChessEngine = ChessEngine;
