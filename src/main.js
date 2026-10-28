import { startApp } from './app.js';

// "?demo" opens a fixed, half-solved picture for the README screenshot; normal visits start normally.
startApp(document, { demo: new URLSearchParams(window.location.search).has('demo') });
