const winston = require('winston')
const DailyRotateFile = require('winston-daily-rotate-file')
const path = require('path')
const os = require('os')
const fs = require('fs')

const LOG_DIR = path.join(os.homedir(), '.ethsmith', 'logs')
fs.mkdirSync(LOG_DIR, { recursive: true })

const fmt = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
)

const logger = winston.createLogger({
  level: process.env.ETHSMITH_LOG_LEVEL || 'info',
  format: fmt,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const extra = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : ''
          return `${timestamp} [${level}] ${message}${extra}`
        })
      )
    }),
    new DailyRotateFile({
      dirname: LOG_DIR,
      filename: 'ethsmith-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '100m',
      maxFiles: '14d',
      format: fmt
    })
  ]
})

module.exports = logger
