const logger = require('./logger');

const replaceConsole = (ogConsole) => {
    const rConsole = {
        console: ogConsole,
        logger,
    };
    return rConsole;
}

const PretzelConsole = replaceConsole(window.console);

window.PretzelConsole = PretzelConsole;
window.console = PretzelConsole.logger;
