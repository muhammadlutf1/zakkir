import pino, { type Logger } from "pino";

const isProduction = process.env.NODE_ENV === "production";

export function resolveLogLevel(env: NodeJS.ProcessEnv = process.env) {
	if (env.LOG_LEVEL) return env.LOG_LEVEL;
	return env.NODE_ENV === "production" ? "info" : "debug";
}

const base: Logger = isProduction
	? pino({ level: resolveLogLevel() })
	: pino({
			level: resolveLogLevel(),
			transport: { target: "pino-pretty", options: { colorize: true } },
		});

const loggers = new Map<string, Logger>();

export function createLogger(name: string) {
	let logger = loggers.get(name);

	if (!logger) {
		logger = base.child({ module: name });
		loggers.set(name, logger);
	}

	return logger;
}
