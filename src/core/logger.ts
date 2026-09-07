import pino, { type Logger } from "pino";

const isProduction = process.env.NODE_ENV === "production";

export function resolveLogLevel(env: NodeJS.ProcessEnv = process.env) {
	if (env.LOG_LEVEL) return env.LOG_LEVEL;
	return env.NODE_ENV === "production" ? "info" : "debug";
}

function createBase(): Logger {
	if (isProduction) return pino({ level: resolveLogLevel() });
	try {
		return pino({
			level: resolveLogLevel(),
			transport: { target: "pino-pretty", options: { colorize: true } },
		});
	} catch {
		return pino({ level: resolveLogLevel() });
	}
}

const base: Logger = createBase();

const loggers = new Map<string, Logger>();

export function createLogger(name: string) {
	let logger = loggers.get(name);

	if (!logger) {
		logger = base.child({ module: name });
		loggers.set(name, logger);
	}

	return logger;
}
