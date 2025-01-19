import random
from typing import List, Optional, Tuple
import numpy as np

class Sudoku:
    def __init__(self, seed: Optional[int] = None):
        """Initialize Sudoku puzzle generator with optional seed for deterministic generation.
        
        Args:
            seed: Optional seed for random number generation
        """
        self.grid = np.zeros((9, 9), dtype=int)
        if seed is not None:
            random.seed(seed)
            np.random.seed(seed)
            
    def _is_valid(self, row: int, col: int, num: int) -> bool:
        """Check if number can be placed at position."""
        # Check row and column
        if num in self.grid[row, :] or num in self.grid[:, col]:
            return False
            
        # Check 3x3 box
        box_row, box_col = 3 * (row // 3), 3 * (col // 3)
        box = self.grid[box_row:box_row + 3, box_col:box_col + 3]
        return num not in box
        
    def _solve(self, row: int = 0, col: int = 0) -> bool:
        """Solve puzzle using backtracking."""
        if col == 9:
            row += 1
            col = 0
        if row == 9:
            return True
            
        if self.grid[row, col] != 0:
            return self._solve(row, col + 1)
            
        nums = list(range(1, 10))
        random.shuffle(nums)
        
        for num in nums:
            if self._is_valid(row, col, num):
                self.grid[row, col] = num
                if self._solve(row, col + 1):
                    return True
                self.grid[row, col] = 0
                
        return False
        
    def generate(self, difficulty: str) -> np.ndarray:
        """Generate a new puzzle with given difficulty.
        
        Args:
            difficulty: One of 'Easy', 'Medium', 'Hard', 'Very Hard', 'Expert'
            
        Returns:
            np.ndarray: 9x9 grid with puzzle (0 represents empty cells)
        """
        # Clear grid and fill diagonal boxes
        self.grid.fill(0)
        for i in range(0, 9, 3):
            nums = list(range(1, 10))
            random.shuffle(nums)
            self.grid[i:i+3, i:i+3] = np.array(nums).reshape(3, 3)
            
        # Solve the complete puzzle
        self._solve()
        solution = self.grid.copy()
        
        # Remove numbers based on difficulty
        cells_to_keep = {
            'Easy': 35,
            'Medium': 30,
            'Hard': 25,
            'Very Hard': 20,
            'Expert': 17
        }[difficulty]
        
        cells = [(i, j) for i in range(9) for j in range(9)]
        cells_to_remove = len(cells) - cells_to_keep
        for row, col in random.sample(cells, cells_to_remove):
            self.grid[row, col] = 0
            
        return self.grid, solution
        
    def validate_solution(self, grid: np.ndarray) -> bool:
        """Check if provided solution is valid.
        
        Args:
            grid: 9x9 numpy array with proposed solution
            
        Returns:
            bool: True if solution is valid
        """
        # Check rows and columns
        for i in range(9):
            if set(grid[i, :]) != set(range(1, 10)) or \
               set(grid[:, i]) != set(range(1, 10)):
                return False
                
        # Check 3x3 boxes
        for i in range(0, 9, 3):
            for j in range(0, 9, 3):
                box = grid[i:i+3, j:j+3].flatten()
                if set(box) != set(range(1, 10)):
                    return False
                    
        return True