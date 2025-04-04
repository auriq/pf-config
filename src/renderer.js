/**
 * PageFinder Configuration Application
 * Main UI Entry Point
 * 
 * This file serves as the entry point for the UI and initializes the modular architecture.
 * The actual functionality is split across several modules to improve maintainability.
 */

// Import the main UI controller
const UIController = require('./modules/ui/UIController');

// Initialize the UI controller
const uiController = new UIController();

// That's it! The UIController handles all the initialization and event binding.