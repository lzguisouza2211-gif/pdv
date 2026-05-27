import pino from 'pino'

export const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:HH:MM:ss',
      ignore: 'pid,hostname',
      messageFormat: '{msg}',
    },
  },
  level: process.env.LOG_LEVEL ?? 'info',
})

// Logger silencioso para uso interno do Baileys (muito verbose por padrão)
export const baileysLogger = pino({ level: 'silent' })
