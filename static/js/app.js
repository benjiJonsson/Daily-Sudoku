class SudokuGame {
    constructor() {
        this.selectedCell = null;
        this.puzzle = null;
        this.solveTime = 0;
        this.timerInterval = null;
        this.isPaused = false;
        this.mistakes = 0;
        this.solution = null;
        this.currentGame = null;  // Store current game state
        this.isNotesMode = false;
        this.notes = Array(9).fill().map(() => 
            Array(9).fill().map(() => new Set())
        );
        
        this.initializeUI();
        this.updateStatus().then(() => {
            setInterval(() => this.updateStatus(), 1000);
        });
    }

    initializeUI() {
        // Initialize difficulty buttons
        document.querySelectorAll('.difficulty-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove any existing pause states
                const grid = document.querySelector('.sudoku-grid');
                if (grid) {
                    grid.classList.remove('paused', 'game-over');
                }
                
                // If clicking the same difficulty as current game, restore it
                if (this.currentGame && this.currentGame.difficulty === btn.dataset.difficulty) {
                    document.querySelector('.difficulty-selector').classList.add('hidden');
                    document.getElementById('game-container').classList.remove('hidden');
                    document.body.classList.add('game-active');
                    this.restoreGameState();
                } else {
                    // Start new game
                    this.startGame(btn.dataset.difficulty);
                }
            });
        });

        // Initialize number pad
        document.querySelectorAll('.num-btn').forEach(btn => {
            btn.addEventListener('click', () => this.handleNumberInput(btn.dataset.num));
        });

        // Initialize control buttons
        document.getElementById('pause-btn').addEventListener('click', () => this.togglePause());
        document.getElementById('new-game-btn').addEventListener('click', () => {
            // Save current game state before hiding
            this.saveGameState();
            
            // Remove any existing pause or game over states
            const grid = document.querySelector('.sudoku-grid');
            grid.classList.remove('paused', 'game-over');
            
            // Hide game container
            document.getElementById('game-container').classList.add('hidden');
            
            // Show difficulty selector
            document.querySelector('.difficulty-selector').classList.remove('hidden');
            
            // Remove game-active class
            document.body.classList.remove('game-active');
            
            // Don't clear the timer interval - it will be handled by startTimer when needed
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
        });

        document.getElementById('notes-btn').addEventListener('click', () => {
            this.isNotesMode = !this.isNotesMode;
            document.getElementById('notes-btn').classList.toggle('notes-active', this.isNotesMode);
        });
    }

    async startGame(difficulty) {
        try {
            // Clear any existing game state if starting a new game with different difficulty
            if (!this.currentGame || this.currentGame.difficulty !== difficulty) {
                this.currentGame = null;
                this.solveTime = 0;
                if (this.timerInterval) {
                    clearInterval(this.timerInterval);
                    this.timerInterval = null;
                }
                
                // Reset pause button state
                const pauseBtn = document.getElementById('pause-btn');
                pauseBtn.textContent = 'Pause';
                pauseBtn.classList.remove('paused');
                this.isPaused = false;
            }

            const response = await fetch(`/api/puzzle/${difficulty}`);
            const data = await response.json();
            
            if (response.ok) {
                this.puzzle = data.puzzle;
                this.currentDifficulty = difficulty;
                this.mistakes = 0;
                
                // Get the solution immediately
                const solutionResponse = await fetch(`/api/validate/${difficulty}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ get_solution: true })
                });
                const solutionData = await solutionResponse.json();
                this.solution = solutionData.solution;
                
                // Update the UI
                document.querySelector('.difficulty-selector').classList.add('hidden');
                const gameContainer = document.getElementById('game-container');
                gameContainer.classList.remove('hidden');
                
                this.renderGrid();
                this.updateMistakesDisplay();
                this.startTimer();
                
                document.body.classList.add('game-active');
            } else {
                alert('Error loading puzzle: ' + data.error);
            }
        } catch (error) {
            alert('Error loading puzzle: ' + error.message);
        }
    }

    renderGrid() {
        const grid = document.querySelector('.sudoku-grid');
        grid.innerHTML = `
            <div class="horizontal-line horizontal-line-1"></div>
            <div class="horizontal-line horizontal-line-2"></div>
        `;
        
        for (let i = 0; i < 9; i++) {
            for (let j = 0; j < 9; j++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = i;
                cell.dataset.col = j;
                
                if (this.puzzle[i][j] !== 0) {
                    cell.textContent = this.puzzle[i][j];
                    cell.classList.add('fixed');
                }
                
                cell.addEventListener('click', () => this.selectCell(cell));
                grid.appendChild(cell);
            }
        }
    }

    selectCell(cell) {
        // Remove previous selection and related highlights
        document.querySelectorAll('.cell').forEach(cellElement => {
            cellElement.classList.remove('selected', 'related');
        });

        // Set new selection
        this.selectedCell = cell;
        cell.classList.add('selected');

        // Highlight related cells (same row, column, and 3x3 box)
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        const boxStartRow = Math.floor(row / 3) * 3;
        const boxStartCol = Math.floor(col / 3) * 3;

        document.querySelectorAll('.cell').forEach(cellElement => {
            const cellRow = parseInt(cellElement.dataset.row);
            const cellCol = parseInt(cellElement.dataset.col);
            
            // Same row, column, or 3x3 box
            if (cellRow === row || cellCol === col || 
                (Math.floor(cellRow / 3) === Math.floor(row / 3) && 
                 Math.floor(cellCol / 3) === Math.floor(col / 3))) {
                if (cellElement !== cell) { // Don't add related class to selected cell
                    cellElement.classList.add('related');
                }
            }
        });

        // Only allow input on non-fixed cells
        if (!cell.classList.contains('fixed')) {
            this.selectedCell = cell;
        } else {
            this.selectedCell = null;
        }
    }

    handleNumberInput(num) {
        if (!this.selectedCell || this.isPaused || this.selectedCell.classList.contains('fixed')) {
            return;
        }

        const row = parseInt(this.selectedCell.dataset.row);
        const col = parseInt(this.selectedCell.dataset.col);

        if (this.isNotesMode) {
            this.handleNoteInput(row, col, num);
            return;
        }

        // Clear any existing notes when entering a number
        if (this.notes[row][col].size > 0) {
            this.notes[row][col].clear();
            this.updateCellNotes(row, col);
        }

        if (num === '0') {
            // Erase number
            this.selectedCell.textContent = '';
            this.selectedCell.classList.remove('incorrect');
            return;
        }

        // Check if solution is available
        if (!this.solution) {
            console.error('Solution not available');
            return;
        }

        const isCorrect = this.solution[row][col] === parseInt(num);

        this.selectedCell.textContent = num;
        this.selectedCell.style.color = 'var(--user-number)';

        if (!isCorrect) {
            this.selectedCell.classList.add('incorrect');
            this.mistakes++;
            this.updateMistakesDisplay();

            if (this.mistakes >= 2) {
                this.gameOver();
                return;
            }

            // Clear the incorrect number after a short delay
            setTimeout(() => {
                this.selectedCell.textContent = '';
                this.selectedCell.classList.remove('incorrect');
            }, 1000);
        } else {
            this.selectedCell.classList.remove('incorrect');
            // Check if puzzle is complete
            if (this.isPuzzleComplete()) {
                this.showSuccess();
            }
        }
    }

    handleNoteInput(row, col, num) {
        if (num === '0') {
            // Clear all notes for this cell when using eraser
            this.notes[row][col].clear();
            this.updateCellNotes(row, col);
            return;
        }

        // Toggle the note
        if (this.notes[row][col].has(num)) {
            this.notes[row][col].delete(num);
        } else {
            this.notes[row][col].add(num);
        }
        this.updateCellNotes(row, col);
    }

    updateCellNotes(row, col) {
        const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
        
        // Clear existing content
        cell.textContent = '';
        
        if (this.notes[row][col].size > 0) {
            const notesDiv = document.createElement('div');
            notesDiv.className = 'notes';
            
            // Create all 9 spans in correct positions
            for (let i = 1; i <= 9; i++) {
                const span = document.createElement('span');
                // Only show number if it exists in notes
                if (this.notes[row][col].has(i.toString())) {
                    span.textContent = i;
                }
                notesDiv.appendChild(span);
            }
            
            cell.appendChild(notesDiv);
        }
    }

    startTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }

        // Don't reset solveTime if restoring a game
        if (!this.currentGame) {
            this.solveTime = 0;
        }
        
        this.isPaused = false;
        this.updateTimer();

        this.timerInterval = setInterval(() => {
            if (!this.isPaused) {
                this.solveTime++;
                this.updateTimer();
            }
        }, 1000);
    }

    updateTimer() {
        const minutes = Math.floor(this.solveTime / 60);
        const seconds = this.solveTime % 60;
        document.getElementById('solve-time').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        const pauseBtn = document.getElementById('pause-btn');
        const grid = document.querySelector('.sudoku-grid');
        
        pauseBtn.textContent = this.isPaused ? 'Resume' : 'Pause';
        pauseBtn.classList.toggle('paused', this.isPaused);
        grid.classList.toggle('paused', this.isPaused);
        
        // Disable number buttons and grid interaction when paused
        document.querySelectorAll('.num-btn').forEach(btn => {
            btn.disabled = this.isPaused;
        });
        
        const cells = document.querySelectorAll('.cell');
        cells.forEach(cell => {
            cell.style.pointerEvents = this.isPaused ? 'none' : 'auto';
        });

        // Save game state when pausing
        if (this.isPaused) {
            this.saveGameState();
        }
    }

    getCurrentGrid() {
        const grid = [];
        const cells = document.querySelectorAll('.cell');
        
        for (let i = 0; i < 9; i++) {
            grid[i] = [];
            for (let j = 0; j < 9; j++) {
                const cell = cells[i * 9 + j];
                grid[i][j] = cell.textContent ? parseInt(cell.textContent) : 0;
            }
        }
        
        return grid;
    }

    updateMistakesDisplay() {
        const mistakesContainer = document.querySelector('.mistakes');
        mistakesContainer.innerHTML = `
            <div class="mistake-icon ${this.mistakes >= 1 ? 'active' : ''}"></div>
            <div class="mistake-icon ${this.mistakes >= 2 ? 'active' : ''}"></div>
        `;
    }

    isPuzzleComplete() {
        const currentGrid = this.getCurrentGrid();
        return !currentGrid.some(row => row.includes(0)) && 
               currentGrid.every((row, i) => 
                   row.every((cell, j) => cell === this.solution[i][j]));
    }

    showCompletionModal(timeString) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        
        const modal = document.createElement('div');
        modal.className = 'completion-modal';
        modal.innerHTML = `
            <h2>Puzzle Completed!</h2>
            <p>You solved today's ${this.currentDifficulty} puzzle in:</p>
            <div class="time">${timeString}</div>
            <button id="view-leaderboard">View Leaderboard</button>
            <button id="new-puzzle">Try Another Difficulty</button>
        `;
        
        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        
        modal.querySelector('#view-leaderboard').addEventListener('click', () => {
            this.showLeaderboard();
            overlay.remove();
            modal.remove();
        });
        
        modal.querySelector('#new-puzzle').addEventListener('click', () => {
            overlay.remove();
            modal.remove();
            document.getElementById('game-container').classList.add('hidden');
            document.querySelector('.difficulty-selector').classList.remove('hidden');
        });
    }
    
    async showLeaderboard(difficulty = null) {
        difficulty = difficulty || this.currentDifficulty;
        document.getElementById('game-container').classList.add('hidden');
        const leaderboard = document.getElementById('leaderboard');
        leaderboard.classList.remove('hidden');
        
        try {
            const response = await fetch(`/api/leaderboard/${difficulty}`);
            const data = await response.json();
            
            if (response.ok) {
                const tbody = document.getElementById('leaderboard-body');
                tbody.innerHTML = data.scores.map((score, index) => `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${this.formatTime(score.time)}</td>
                        <td>${score.date}</td>
                    </tr>
                `).join('');
                
                // Update active tab
                document.querySelectorAll('.tab-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.difficulty === difficulty);
                });
            }
        } catch (error) {
            console.error('Error loading leaderboard:', error);
        }
    }
    
    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
    
    showSuccess() {
        clearInterval(this.timerInterval);
        
        const minutes = Math.floor(this.solveTime / 60);
        const seconds = this.solveTime % 60;
        const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // Submit score to leaderboard
        this.submitScore(this.solveTime).then(() => {
            this.showCompletionModal(timeString);
        });
        
        // Disable input
        this.isPaused = true;
        document.querySelectorAll('.num-btn').forEach(btn => btn.disabled = true);
        document.getElementById('pause-btn').disabled = true;
    }
    
    async submitScore(time) {
        try {
            await fetch('/api/submit-score', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    difficulty: this.currentDifficulty,
                    time: time
                })
            });
        } catch (error) {
            console.error('Error submitting score:', error);
        }
    }

    async updateStatus() {
        try {
            const response = await fetch('/api/status');
            const data = await response.json();
            
            if (response.ok) {
                // Update current date
                const dateElement = document.getElementById('date');
                if (dateElement) {
                    dateElement.textContent = data.current_date;
                }
                
                // Update countdown
                const countdownElement = document.getElementById('countdown');
                if (countdownElement) {
                    const hours = Math.floor(data.seconds_until_reset / 3600);
                    const minutes = Math.floor((data.seconds_until_reset % 3600) / 60);
                    const seconds = data.seconds_until_reset % 60;
                    
                    countdownElement.textContent = 
                        `${hours}h ${minutes}m ${seconds}s`;
                }
            } else {
                console.error('Error fetching status:', data.error);
            }
        } catch (error) {
            console.error('Error updating status:', error);
        }
    }

    // Add keyboard support for number input
    initializeKeyboardControls() {
        document.addEventListener('keydown', (event) => {
            if (!this.selectedCell || this.isPaused) {
                return;
            }

            if (event.key >= '1' && event.key <= '9') {
                this.handleNumberInput(event.key);
            } else if (event.key === 'Backspace' || event.key === 'Delete') {
                this.handleNumberInput('0');
            } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || 
                       event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                this.handleArrowKey(event.key);
            }
        });
    }

    handleArrowKey(key) {
        if (!this.selectedCell) return;

        const row = parseInt(this.selectedCell.dataset.row);
        const col = parseInt(this.selectedCell.dataset.col);
        let newRow = row;
        let newCol = col;

        switch (key) {
            case 'ArrowLeft': newCol = Math.max(0, col - 1); break;
            case 'ArrowRight': newCol = Math.min(8, col + 1); break;
            case 'ArrowUp': newRow = Math.max(0, row - 1); break;
            case 'ArrowDown': newRow = Math.min(8, row + 1); break;
        }

        const newCell = document.querySelector(
            `.cell[data-row="${newRow}"][data-col="${newCol}"]`
        );
        if (newCell) {
            this.selectCell(newCell);
        }
    }

    gameOver() {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
        
        // Clear current game state
        this.currentGame = null;
        
        // Add game-over class to grid
        const grid = document.querySelector('.sudoku-grid');
        grid.classList.add('game-over');
        
        // Create and add game over message box
        const messageBox = document.createElement('div');
        messageBox.className = 'game-over-message';
        messageBox.innerHTML = `
            <h2>Game Over</h2>
            <p>You made 2 mistakes!</p>
            <button id="try-again-btn">Try Again</button>
        `;
        
        // Add message box to the grid container
        document.querySelector('.sudoku-grid-container').appendChild(messageBox);
        
        // Disable all number buttons
        document.querySelectorAll('.num-btn').forEach(btn => {
            btn.disabled = true;
        });
        
        // Disable pause button
        document.getElementById('pause-btn').disabled = true;
        
        // Add try again button handler
        messageBox.querySelector('#try-again-btn').addEventListener('click', () => {
            // Remove the message box
            messageBox.remove();
            // Remove game-over class
            grid.classList.remove('game-over');
            // Enable number buttons
            document.querySelectorAll('.num-btn').forEach(btn => {
                btn.disabled = false;
            });
            // Return to difficulty selector
            document.getElementById('game-container').classList.add('hidden');
            document.querySelector('.difficulty-selector').classList.remove('hidden');
            document.body.classList.remove('game-active');
        });
    }

    // Add method to save current game state
    saveGameState() {
        if (!this.puzzle) return;
        
        this.currentGame = {
            puzzle: this.puzzle,
            solution: this.solution,
            difficulty: this.currentDifficulty,
            solveTime: this.solveTime,
            mistakes: this.mistakes,
            currentGrid: this.getCurrentGrid(),
            isPaused: this.isPaused,
            notes: this.notes.map(row => row.map(set => Array.from(set))),
            isNotesMode: this.isNotesMode
        };
    }

    // Add method to restore game state
    restoreGameState() {
        if (!this.currentGame) return;

        this.puzzle = this.currentGame.puzzle;
        this.solution = this.currentGame.solution;
        this.currentDifficulty = this.currentGame.difficulty;
        this.mistakes = this.currentGame.mistakes;
        
        // Set the time before starting timer
        this.solveTime = this.currentGame.solveTime;
        this.isPaused = this.currentGame.isPaused;

        // Update UI
        this.renderGrid();
        this.updateMistakesDisplay();
        this.updateTimer(); // Update timer display immediately
        
        // Start timer only if game wasn't paused
        if (!this.isPaused) {
            this.startTimer();
        }

        // Restore user input numbers
        const cells = document.querySelectorAll('.cell');
        const currentGrid = this.currentGame.currentGrid;
        cells.forEach(cell => {
            const row = parseInt(cell.dataset.row);
            const col = parseInt(cell.dataset.col);
            if (!cell.classList.contains('fixed') && currentGrid[row][col] !== 0) {
                cell.textContent = currentGrid[row][col];
                cell.style.color = 'var(--user-number)';
            }
        });

        // Update pause button and grid state if game was paused
        if (this.isPaused) {
            const pauseBtn = document.getElementById('pause-btn');
            const grid = document.querySelector('.sudoku-grid');
            pauseBtn.textContent = 'Resume';
            pauseBtn.classList.add('paused');
            grid.classList.add('paused');
            document.querySelectorAll('.num-btn').forEach(btn => {
                btn.disabled = true;
            });
        }

        // Restore notes
        this.notes = this.currentGame.notes.map(row => 
            row.map(arr => new Set(arr))
        );
        this.isNotesMode = this.currentGame.isNotesMode;
        document.getElementById('notes-btn').classList.toggle('notes-active', this.isNotesMode);

        // Update notes display
        for (let i = 0; i < 9; i++) {
            for (let j = 0; j < 9; j++) {
                if (this.notes[i][j].size > 0) {
                    this.updateCellNotes(i, j);
                }
            }
        }
    }

    // Update clearCell to also clear notes
    clearCell(row, col) {
        const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
        cell.textContent = '';
        this.notes[row][col].clear();
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SudokuGame();
}); 